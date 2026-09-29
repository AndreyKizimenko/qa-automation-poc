/**
 * Shared wipe steps for both the pre-test (cleanup-setup) and post-test
 * (cleanup-teardown) projects. Idempotent — every helper either returns
 * early on a missing resource (404) or no-ops when the endpoint isn't
 * available (free).
 *
 * Picking up where gitops can't: `fleetctl gitops` with empty-list
 * directives doesn't delete profiles/scripts/etc. that weren't applied
 * via gitops in the first place. Running these wipes before tests start
 * means a Playwright run is self-healing regardless of how the live
 * instance got into its current state.
 */
import { test } from '@playwright/test';
import {
  cancelUpcomingActivity,
  clearFleetOsUpdates,
  deleteAllConfigurationProfiles,
  deleteAllGlobalPolicies,
  deleteAllInstallSoftwareTitles,
  deleteAllPacks,
  deleteAllQaTestUsers,
  deleteAllQueries,
  deleteAllScripts,
  deleteAllTeamPolicies,
  deleteLabelsWithPrefix,
  deleteFleetPolicies,
  deleteReport,
  deleteSoftwareTitle,
  disableGitOpsMode,
  enableScriptExecution,
  findFleetByName,
  findOnlineHost,
  getAgentOptions,
  getSoftwarePackage,
  listFleetHosts,
  listFleetMaintainedTitles,
  listFleetPolicies,
  listHostSoftwareNames,
  listInstallableTitles,
  listReports,
  listUpcomingActivities,
  queueAdHocScript,
  resetSetupExperience,
  setAgentOptions,
  setPinnedVersion,
  transferHosts,
  type UpcomingActivity,
} from '@helpers/api';
import { VM_SOFTWARE_FIXTURES, ensureVmFixtureUninstalled, findVmFixtureTitle, type VmPlatform } from '@helpers/vm-fixtures';

const WORKSTATIONS_FLEET = 'Workstations';

// Queries and packs are global on the Fleet API (no per-team endpoint),
// so deleting them with the unassigned wipe also drains anything created
// from the "All fleets" UI scope. Policies are either global
// (deleteAllGlobalPolicies) or team-scoped (deleteAllTeamPolicies on
// Workstations); the "All fleets" UI view is the union of both, so the
// two calls together cover it.
test('wipe unassigned state', async ({ request }) => {
  // Every helper here is safe on both tiers. The MDM-related ones
  // (resetSetupExperience and its sub-helpers in helpers/api/mdm.ts)
  // absorb the 402 "Requires Premium" response on free, so they noop
  // instead of failing the Promise.all batch. deleteAllQaTestUsers only
  // touches addresses matching the QA_TEST_EMAIL_RE prefix in
  // helpers/api/users.ts, so admin/SSO accounts are untouchable.
  // Setup Experience references install-software titles, and a referenced
  // title can't be deleted (Fleet returns 409). Clear Setup Experience first
  // so the software-title wipe below isn't racing the reference removal.
  // gitops mode is a global, UI-only lock: a run that died before its teardown
  // leaves every mutating spec in this run disabled, and nothing else in the
  // suite would put it back. Clearing it here makes the run self-healing the
  // same way the resource wipes do. No-ops when the flag is already off, which
  // is every run on free.
  await disableGitOpsMode(request);
  // Script execution is the other global switch a dead run can strand: an
  // exclusive spec turns it off, and nothing else in the suite turns it back on.
  await enableScriptExecution(request);
  await resetSetupExperience(request, 0);
  await Promise.all([
    deleteAllQueries(request),
    deleteAllGlobalPolicies(request),
    deleteAllPacks(request),
    deleteAllInstallSoftwareTitles(request, 0),
    deleteAllConfigurationProfiles(request, 0),
    deleteAllScripts(request, 0),
    deleteAllQaTestUsers(request),
  ]);
});

test('wipe Workstations team state', async ({ request }) => {
  test.skip(
    process.env.SUITE === 'free',
    'Workstations team only exists on premium',
  );

  const workstations = await findFleetByName(request, WORKSTATIONS_FLEET);
  if (!workstations) {
    // Workstations is provisioned by gitops; if it's missing the instance
    // is misconfigured. Fail loud rather than silently noop.
    throw new Error(
      `Workstations team not found on premium instance — gitops apply likely missing`,
    );
  }

  // Clear Setup Experience before the software wipe (see the unassigned step).
  await resetSetupExperience(request, workstations.id);
  await Promise.all([
    deleteAllTeamPolicies(request, workstations.id),
    deleteAllInstallSoftwareTitles(request, workstations.id),
    deleteAllConfigurationProfiles(request, workstations.id),
    deleteAllScripts(request, workstations.id),
  ]);
  // The OS updates specs enforce versions and deadlines here — the one fleet
  // with no real hosts to update — and clear them in a `finally` a timed-out
  // test never reaches.
  await clearFleetOsUpdates(request, workstations.id);
});

// A narrow exception to "cleanup touches only Unassigned and Workstations": on
// the two fleets that hold durable Fleet-maintained apps, it clears version
// pins — and nothing else, never deleting. QA holds the version-pinning shelf
// (gitops/premium-fleetqa/fleets/qa.yml), VMs holds Claude for the update spec
// (fleets/vms.yml). Both specs unpin in a `finally`, but Playwright aborts a
// timed-out test before its `finally` runs, and an exact pin left behind stops
// Fleet's hourly auto-update cron for that title: the version history those
// specs rely on stops growing, for every later run.
test('clear stranded version pins on the durable app fleets', async ({ request }) => {
  test.skip(process.env.SUITE === 'free', 'Fleet-maintained apps and fleets are premium-only');

  for (const name of ['QA', 'VMs']) {
    const fleet = await findFleetByName(request, name);
    if (!fleet) {
      throw new Error(`${name} fleet not found on premium instance — gitops apply likely missing`);
    }
    for (const title of await listFleetMaintainedTitles(request, fleet.id)) {
      const pin = (await getSoftwarePackage(request, fleet.id, title.titleId))?.pinnedVersion;
      if (pin) await setPinnedVersion(request, fleet.id, title.titleId, '');
    }
  }
});

// The host-execution and label-targeting specs add per-run scripts, installers,
// reports, install policies, profiles and labels to the VMs fleet — the only
// fleet with real hosts — and move simulations onto it as the "outside the label"
// host, undoing all of it in a `finally` a timed-out test never reaches. This
// sweeps only those, all named `fleet-pw-*` / `pw-*`; everything gitops declares
// for the fleet — Claude and its policies, the durable install/uninstall fixtures
// (helpers/vm-fixtures.ts), pw-host-report-results — is left alone.
//
// Deleting a profile is what takes it off the VMs: Fleet sends the removal on its
// next reconciler tick. Labels go last, because Fleet refuses to delete one a
// profile still targets.
//
// Deleting a title never uninstalls it, and a per-run .deb never comes back to
// be uninstalled by a later run — so the Ubuntu VM's own `fleet-pw-*` packages
// are purged here, by a script queued only when its inventory lists one. A host
// runs scripts and installs from one queue, so the purge finishes before any
// install this run queues after it.
const OWN_PACKAGE = /^fleet-pw-/;

test('sweep host-execution leftovers from the VMs fleet', async ({ request }) => {
  test.skip(process.env.SUITE === 'free', 'fleets are premium-only');

  const vms = await findFleetByName(request, 'VMs');
  if (!vms) throw new Error('VMs fleet not found on premium instance — gitops apply likely missing');

  const titles = await listInstallableTitles(request, vms.id);
  const policies = await listFleetPolicies(request, vms.id);
  const reports = await listReports(request, vms.id);
  const borrowed = (await listFleetHosts(request, vms.id)).filter((h) => !h.real).map((h) => h.id);
  await Promise.all([
    deleteAllConfigurationProfiles(request, vms.id, (name) => name.startsWith('pw-')),
    transferHosts(request, 0, borrowed),
    deleteFleetPolicies(
      request,
      vms.id,
      policies
        .filter((p) => p.name.startsWith('[Install software] fleet-pw-') || p.name.startsWith('pw-'))
        .map((p) => p.id),
    ),
    deleteAllScripts(request, vms.id, (name) => name.startsWith('pw-')),
    // By exact prefix: gitops declares `pw-host-report-results` on this fleet too.
    ...reports
      .filter((r) => r.name.startsWith('pw-run-script-') || r.name.startsWith('pw-rl-'))
      .map((r) => deleteReport(request, r.id)),
  ]);
  // After the policies: a title an install policy points at can't be deleted.
  await Promise.all(
    titles
      .filter((t) => OWN_PACKAGE.test(t.packageName))
      .map((t) => deleteSoftwareTitle(request, vms.id, t.titleId)),
  );
  // After the profiles and titles: Fleet refuses to delete a label either targets.
  await deleteLabelsWithPrefix(request, 'pw-');

  const linux = await findOnlineHost(request, 'linux', { kind: 'real' });
  if (linux && (await listHostSoftwareNames(request, linux.id, 'fleet-pw-')).some((n) => n.startsWith('fleet-pw-'))) {
    await queueAdHocScript(
      request,
      linux.id,
      "#!/bin/sh\ndpkg-query -W -f='${Package}\\n' 'fleet-pw-*' 2>/dev/null | xargs -r dpkg --purge\n",
    );
  }
});

// Every run starts the real VMs in the same state, and ends them there too
// (the teardown project runs this file again):
//
//  - nothing of the suite's is still queued on a VM — a dead run's installs
//    and scripts would otherwise hold each VM's one queue ahead of this run's;
//  - the script timeout is Fleet's default — the timeout case lowers it to 60 s
//    and restores it in a `finally` a timed-out test never reaches;
//  - on premium, every durable install/uninstall fixture is uninstalled — its
//    resting state, which a dead run can leave the other way.
//
// It repairs what the suite itself leaves behind and nothing else. A VM that's
// offline is only logged: its specs fail on it with a message of their own.
const OWN_QUEUED = (a: UpcomingActivity): boolean =>
  !!a.scriptName?.startsWith('pw-') ||
  !!a.softwarePackage?.startsWith('fleet-pw-') ||
  VM_SOFTWARE_FIXTURES.some(
    (f) => (f.packageName && f.packageName === a.softwarePackage) || f.fleetMaintainedName === a.softwareTitle,
  );

test('bring the real VMs to their resting state', async ({ request }) => {
  // Only as long as a dead run left work for it to do: each uninstall is a
  // queued action and an inventory refetch.
  test.setTimeout(900_000);
  const premium = process.env.SUITE !== 'free';
  const vms = premium ? await findFleetByName(request, 'VMs') : null;
  if (premium && !vms) throw new Error('VMs fleet not found on premium instance — gitops apply likely missing');
  const fleetId = vms?.id ?? 0;

  // Uninstalls run as scripts, so they need script execution on.
  await enableScriptExecution(request);

  const { script_execution_timeout: timeout, ...options } = await getAgentOptions(request, fleetId);
  if (timeout !== undefined) await setAgentOptions(request, options, fleetId);

  const hosts = new Map<VmPlatform, number>();
  for (const platform of ['darwin', 'windows', 'linux'] as const) {
    const host = await findOnlineHost(request, platform, { kind: 'real' });
    if (!host) {
      console.warn(`[vm preflight] no online real ${platform} VM`);
      continue;
    }
    hosts.set(platform, host.id);
    for (const activity of (await listUpcomingActivities(request, host.id)).filter(OWN_QUEUED)) {
      await cancelUpcomingActivity(request, host.id, activity.uuid);
    }
  }

  if (!vms) return;
  await Promise.all(
    VM_SOFTWARE_FIXTURES.filter((f) => hosts.has(f.platform)).map(async (fixture) => {
      const title = await findVmFixtureTitle(request, vms.id, fixture);
      await ensureVmFixtureUninstalled(request, hosts.get(fixture.platform)!, title);
    }),
  );
});
