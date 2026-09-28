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
  deleteAllConfigurationProfiles,
  deleteAllGlobalPolicies,
  deleteAllInstallSoftwareTitles,
  deleteAllPacks,
  deleteAllQaTestUsers,
  deleteAllQueries,
  deleteAllScripts,
  deleteAllTeamPolicies,
  deleteFleetPolicies,
  deleteReport,
  deleteSoftwareTitle,
  disableGitOpsMode,
  enableScriptExecution,
  findFleetByName,
  getSoftwarePackage,
  listFleetMaintainedTitles,
  listFleetPolicies,
  listInstallableTitles,
  listReports,
  resetSetupExperience,
  setPinnedVersion,
} from '@helpers/api';

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

// The host-execution specs add scripts, installers, reports and install
// policies to the VMs fleet — the only fleet with real hosts — and delete them in
// a `finally`, which a timed-out test never reaches. This sweeps only what those
// specs name as their own; everything gitops declares for the fleet (Claude, its
// "Claude is installed" policies, pw-host-report-results) is left alone, and
// nothing is uninstalled from a host — a spec that reinstalls clears that itself.
const OWN_PACKAGE = /^(fleet-pw-|fleet-playwright-)|^7z2601-arm64\.exe$/;
const OWN_FMA_TITLES = new Set(['Itsycal']);

test('sweep host-execution leftovers from the VMs fleet', async ({ request }) => {
  test.skip(process.env.SUITE === 'free', 'fleets are premium-only');

  const vms = await findFleetByName(request, 'VMs');
  if (!vms) throw new Error('VMs fleet not found on premium instance — gitops apply likely missing');

  const titles = await listInstallableTitles(request, vms.id);
  const policies = await listFleetPolicies(request, vms.id);
  const reports = await listReports(request, vms.id);
  await Promise.all([
    deleteFleetPolicies(
      request,
      vms.id,
      policies.filter((p) => p.name.startsWith('[Install software] fleet-pw-')).map((p) => p.id),
    ),
    deleteAllScripts(request, vms.id, (name) => name.startsWith('pw-')),
    ...reports.filter((r) => r.name.startsWith('pw-run-script-')).map((r) => deleteReport(request, r.id)),
  ]);
  // After the policies: a title an install policy points at can't be deleted.
  await Promise.all(
    titles
      .filter((t) => OWN_PACKAGE.test(t.packageName) || (t.fleetMaintained && OWN_FMA_TITLES.has(t.name)))
      .map((t) => deleteSoftwareTitle(request, vms.id, t.titleId)),
  );
});
