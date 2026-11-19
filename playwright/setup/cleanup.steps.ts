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
 *
 * The sweeps find the suite's own things by name. A spec names them with
 * `ownName(kind)` (`helpers/own-name.ts`), which opens every name with
 * `pw-<kind>-`, so a sweep by the `pw-` prefix takes them, and one by an exact
 * prefix (the reports below: `pw-role-`, `pw-run-script-`, …) takes the kind of
 * that name. A spec that gives a new kind of report a fleet gitops declares
 * reports on adds its prefix here.
 */
import { test, type APIRequestContext } from '@playwright/test';
import {
  cancelUpcomingActivity,
  clearFleetOsUpdates,
  deleteAllConfigurationProfiles,
  deleteAllGlobalPolicies,
  deleteAllInstallSoftwareTitles,
  deleteAllQaTestUsers,
  deleteLeftoverApiTestUsers,
  deleteAllQueries,
  deleteAllScripts,
  deleteVariablesMatching,
  deleteAllFleetPolicies,
  deleteLabelsWithPrefix,
  deleteFleetPolicies,
  deleteFleetsWithPrefix,
  removeGlobalEnrollMarkers,
  deleteReport,
  deleteSoftwareTitle,
  disableGitOpsMode,
  failureSummary,
  findFleetByName,
  getAgentOptions,
  getFleetRecoveryLock,
  getHostRefetchRequested,
  getHostSoftwareState,
  getSoftwarePackage,
  labHostProblem,
  listFleetHosts,
  listFleetMaintainedTitles,
  listFleetPolicies,
  listHostSoftwareNames,
  listInstallableTitles,
  listLabHostRecords,
  listLabHostsAstray,
  listPoolHosts,
  listReports,
  listUpcomingActivities,
  newestRecord,
  queueAdHocScript,
  requestHostRefetch,
  resetSetupExperience,
  setAgentOptions,
  setFleetRecoveryLock,
  setPinnedVersion,
  transferHosts,
  uninstallSoftwareOnHost,
  waitForHostSoftwareStatus,
  type UpcomingActivity,
} from '@helpers/api';
import { OS_MATRIX_FLEET, labHostFleet, labHostsOfRun, type LabPackage } from '@helpers/lab-hosts';
import {
  OS_SMOKE_MSI,
  VM_DURABLE_FIXTURES,
  ensureVmFixtureUninstalled,
  findVmFixtureTitle,
  type VmPlatform,
} from '@helpers/vm-fixtures';

const WORKSTATIONS_FLEET = 'Workstations';

// A step that works on a fleet is declared on premium only: free has no fleets.
// Declared on free and skipped there, the four of them would show as skipped
// tests in a free report, once for each time this file runs, beside the tests
// that are skipped for a reason. On premium this is `test` itself, so a step's
// result still points at its own line.
type CleanupStep = (title: string, body: (args: { request: APIRequestContext }) => Promise<void>) => void;
const premiumStep: CleanupStep = process.env.SUITE === 'free' ? () => {} : test;

// Reports are global on the Fleet API (no per-fleet endpoint), so deleting
// them with the unassigned wipe also drains anything created from the
// "All fleets" UI scope. Policies are either global
// (deleteAllGlobalPolicies) or a fleet's own (deleteAllFleetPolicies, here for
// Unassigned and below for Workstations); the "All fleets" UI view is the
// union of global and Workstations' policies, so those two calls cover it.
test('wipe unassigned state', async ({ request }) => {
  // Every helper here is safe on both tiers. The MDM-related ones
  // (resetSetupExperience and its sub-helpers in helpers/api/mdm.ts)
  // absorb the 402 "Requires Premium" response on free, so they noop
  // instead of failing the Promise.all batch. deleteAllQaTestUsers only
  // touches addresses matching the QA_TEST_EMAIL_RE prefix in
  // helpers/api/users.ts, so admin/SSO accounts are untouchable, and
  // deleteLeftoverApiTestUsers only API-only users named like the specs'
  // per-run ones (QA_TEST_API_USER_NAME_RE), never the static API users.
  // Setup Experience references install-software titles, and a referenced
  // title can't be deleted (Fleet returns 409). Clear Setup Experience first
  // so the software-title wipe below isn't racing the reference removal.
  // gitops mode is a global, UI-only lock: a run that died before its teardown
  // leaves every mutating spec in this run disabled, and nothing else in the
  // suite would put it back. Clearing it here makes the run self-healing the
  // same way the resource wipes do. No-ops when the flag is already off, which
  // is every run on free.
  await disableGitOpsMode(request);
  await resetSetupExperience(request, 0);
  // Unassigned's own policies go before its software and scripts: Fleet refuses
  // to delete a title or script that a policy automation uses, so a title added
  // with "Automatic install", by a spec or by hand, would otherwise outlive
  // every wipe.
  await deleteAllFleetPolicies(request, 0);
  await Promise.all([
    deleteAllQueries(request),
    deleteAllGlobalPolicies(request),
    deleteAllInstallSoftwareTitles(request, 0),
    deleteAllConfigurationProfiles(request, 0),
    deleteAllScripts(request, 0),
    deleteAllQaTestUsers(request),
    deleteLeftoverApiTestUsers(request),
  ]);
  // Custom variables are global and nothing else removes them; the specs name
  // theirs `PW_VAR_*`, and the Variables list pages at 20. After the scripts:
  // Fleet refuses to delete a variable a script still references.
  await deleteVariablesMatching(request, 'PW_VAR_');
});

// A spec that needs a fleet of its own creates a throwaway `pw-*` one and deletes
// it in an afterEach (`fleets-lifecycle`, `historical-data-collection`, the fleet
// failing-policies webhook in `policy-automations`). A run killed hard skips even that, and a stray fleet sits in
// every fleet picker; this removes them. No standing fleet starts `pw-`. A
// failure here only logs: a stray fleet is a nuisance, and failing cleanup-setup
// over one would skip the whole run.
premiumStep('sweep throwaway pw-* fleets', async ({ request }) => {
  await deleteFleetsWithPrefix(request, 'pw-').catch((err) =>
    console.warn('[cleanup] pw-* fleet sweep failed; the next run retries:', err),
  );
});

// `shared/settings/enroll-secrets.spec.ts` adds a marker secret to the global
// list and removes it in its afterEach. A killed run can leave it; this removes
// only secrets carrying the marker, never another (the simulations re-enroll
// with the global secret). Logs rather than fails, like the fleet sweep.
test('remove test-added global enroll secrets', async ({ request }) => {
  await removeGlobalEnrollMarkers(request).catch((err) =>
    console.warn('[cleanup] global enroll-secret marker sweep failed; the next run retries:', err),
  );
});

premiumStep('wipe Workstations team state', async ({ request }) => {
  const workstations = await findFleetByName(request, WORKSTATIONS_FLEET);
  if (!workstations) {
    // Workstations is provisioned by gitops; if it's missing the instance
    // is misconfigured. Fail loud rather than silently noop.
    throw new Error(
      `Workstations team not found on premium instance — gitops apply likely missing`,
    );
  }

  // Clear Setup Experience, then the policies, before the software and scripts
  // (see the unassigned step for why each must go first).
  await resetSetupExperience(request, workstations.id);
  await deleteAllFleetPolicies(request, workstations.id);
  // Its reports are gitops's, so only the ones specs save here go, by exact
  // prefix: the role specs' Save-as-new copy and `save-as-new.spec`'s copy into
  // this fleet, each deleted by its own test unless the test died first.
  const reports = await listReports(request, workstations.id);
  await Promise.all([
    deleteAllInstallSoftwareTitles(request, workstations.id),
    deleteAllConfigurationProfiles(request, workstations.id),
    deleteAllScripts(request, workstations.id),
    ...reports
      .filter((r) => r.name.startsWith('pw-role-') || r.name.startsWith('Copy of playwright-saveasnew-'))
      .map((r) => deleteReport(request, r.id)),
  ]);
  // The OS updates specs enforce versions and deadlines here — the one fleet
  // with no real hosts to update — and clear them in a `finally` a timed-out
  // test never reaches.
  await clearFleetOsUpdates(request, workstations.id);
  // The fleet holds no hosts of its own. `host-delete.spec` stages simulations
  // here and counts on them being the only ones, so any a dead run left goes
  // back to Unassigned.
  const stranded = (await listFleetHosts(request, workstations.id)).filter((h) => !h.real).map((h) => h.id);
  await transferHosts(request, 0, stranded);
});

// A narrow exception to "cleanup touches only Unassigned and Workstations": on
// the two fleets that hold durable Fleet-maintained apps, it clears version
// pins — and nothing else, never deleting. QA holds the version-pinning shelf
// (gitops/premium-fleetqa/fleets/qa.yml), VMs holds Claude for the update spec
// (fleets/vms.yml). Both specs unpin in a `finally`, but Playwright aborts a
// timed-out test before its `finally` runs, and an exact pin left behind stops
// Fleet's hourly auto-update cron for that title: the version history those
// specs rely on stops growing, for every later run.
premiumStep('clear stranded version pins on the durable app fleets', async ({ request }) => {
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
// be uninstalled by a later run — so each Ubuntu pool VM's own `fleet-pw-*`
// packages are purged here, by a script queued only when its inventory lists
// one. Every member, not only the one a test ran on: a Deploy install policy
// (`install-on-host`) installs its package on each Linux host of the fleet that
// runs its policies while the policy exists, and the spec uninstalls only its
// own. A host runs scripts and installs from one queue, so the purge finishes
// before any install this run queues after it.
const OWN_PACKAGE = /^fleet-pw-/;

/**
 * What takes the suite's own per-run packages off a host whose fleet no longer
 * holds their titles, by the host's package type. Each is a no-op where none is
 * installed.
 */
const OWN_PACKAGE_PURGE: { deb: string; rpm: string } & Partial<Record<LabPackage, string>> = {
  deb: "#!/bin/sh\ndpkg-query -W -f='${Package}\\n' 'fleet-pw-*' 2>/dev/null | xargs -r dpkg --purge\n",
  rpm: "#!/bin/sh\nrpm -qa 'fleet-pw-*' | xargs -r rpm -e\n",
};

premiumStep('sweep host-execution leftovers from the VMs fleet', async ({ request }) => {
  const vms = await findFleetByName(request, 'VMs');
  if (!vms) throw new Error('VMs fleet not found on premium instance — gitops apply likely missing');

  const titles = await listInstallableTitles(request, vms.id);
  const policies = await listFleetPolicies(request, vms.id);
  const reports = await listReports(request, vms.id);
  const borrowed = (await listFleetHosts(request, vms.id)).filter((h) => !h.real).map((h) => h.id);
  // The policies first: Fleet refuses to delete a script a policy automation
  // still runs, and a title an install policy points at (below).
  await deleteFleetPolicies(
    request,
    vms.id,
    policies
      .filter((p) => p.name.startsWith('[Install software] fleet-pw-') || p.name.startsWith('pw-'))
      .map((p) => p.id),
  );
  await Promise.all([
    deleteAllConfigurationProfiles(request, vms.id, (name) => name.startsWith('pw-')),
    transferHosts(request, 0, borrowed),
    deleteAllScripts(request, vms.id, (name) => name.startsWith('pw-')),
    // By exact prefix: gitops declares `pw-host-report-results` on this fleet too.
    ...reports
      .filter(
        (r) =>
          r.name.startsWith('pw-run-script-') || r.name.startsWith('pw-rl-') || r.name.startsWith('pw-stored-results-'),
      )
      .map((r) => deleteReport(request, r.id)),
  ]);
  await Promise.all(
    titles
      .filter((t) => OWN_PACKAGE.test(t.packageName))
      .map((t) => deleteSoftwareTitle(request, vms.id, t.titleId)),
  );
  // After the profiles and titles: Fleet refuses to delete a label either targets.
  await deleteLabelsWithPrefix(request, 'pw-');

  await Promise.all(
    (await listPoolHosts(request, 'linux')).map(async (linux) => {
      if (!(await listHostSoftwareNames(request, linux.id, 'fleet-pw-')).some((n) => n.startsWith('fleet-pw-'))) return;
      await queueAdHocScript(request, linux.id, OWN_PACKAGE_PURGE.deb);
    }),
  );
});

// The per-OS smokes (`tests/e2e/premium/matrix/os-smokes.spec.ts`) are the one
// thing that puts anything on the OS matrix fleet, which gitops declares empty:
// per test, a library script and a package nothing installs until the test asks
// its own host to, and for the policy automation a policy with the label that
// holds it to that host. Each test removes what it made, even when it times out;
// a killed run doesn't, and this takes what it left, by the smokes' names
// (`pw-*`, `fleet-pw-*`, and the one `.msi`, whose title is fixed). Nothing
// else is touched: what a person put on the fleet is the next gitops apply's to
// remove, and its verify's to report.
//
// On the fleet: the policies first (Fleet refuses to delete a title or a script
// a policy automation uses), then the scripts, then the titles, each uninstalled
// first from any host a dead run left it installed on. A title still on the
// fleet is the one thing that knows how to take itself off a host, with the
// uninstall script Fleet stored for it. The labels go last, once nothing targets
// them (the VMs step sweeps `pw-*` labels too, and can meet one before its
// policy is gone).
//
// On the hosts (every online lab host of the fleet): the smokes' queued scripts
// and installs are cancelled, and a per-run `.deb` or `.rpm` whose title is
// already gone (a gitops apply since the dead run deleted it) is purged by a
// script, as on the Ubuntu pool. Only where the host's inventory lists one and
// no refetch is outstanding: after an uninstall the inventory lists the package
// until the host's next collection, which Fleet has asked for by then. The
// `.msi` and the tarball need no purge: their names don't change, so the next
// smoke's install lands on what was left and its uninstall removes it.
premiumStep("sweep the per-OS smokes' leftovers from the OS matrix fleet and its hosts", async ({ request }) => {
  // An uninstall a dead run left to do is a queued action on its host.
  test.setTimeout(600_000);
  const matrix = await findFleetByName(request, OS_MATRIX_FLEET);
  if (!matrix) throw new Error(`${OS_MATRIX_FLEET} fleet not found on premium instance — gitops apply likely missing`);

  const entries = labHostsOfRun().filter((entry) => labHostFleet(entry) === OS_MATRIX_FLEET);
  const records = await listLabHostRecords(request, entries);
  const hosts = entries
    .filter((entry) => labHostProblem(entry, records) === null)
    .map((entry) => newestRecord(entry, records)!);

  const policies = await listFleetPolicies(request, matrix.id);
  await deleteFleetPolicies(
    request,
    matrix.id,
    policies.filter((p) => p.name.startsWith('pw-')).map((p) => p.id),
  );
  await deleteAllScripts(request, matrix.id, (name) => name.startsWith('pw-'));

  const titles = (await listInstallableTitles(request, matrix.id)).filter(
    (t) => OWN_PACKAGE.test(t.packageName) || t.packageName === OS_SMOKE_MSI.packageName,
  );
  for (const title of titles) {
    await Promise.all(
      hosts.map(async (host) => {
        if ((await getHostSoftwareState(request, host.id, title.titleId))?.status !== 'installed') return;
        console.warn(`[os matrix] ${title.packageName} was left installed on ${host.displayName} — uninstalling it`);
        await uninstallSoftwareOnHost(request, host.id, title.titleId);
        await waitForHostSoftwareStatus(request, host.id, title.titleId, null);
      }),
    );
    await deleteSoftwareTitle(request, matrix.id, title.titleId);
  }
  await deleteLabelsWithPrefix(request, 'pw-');

  await Promise.all(
    hosts.map(async (host) => {
      for (const activity of (await listUpcomingActivities(request, host.id)).filter(OWN_QUEUED)) {
        await cancelUpcomingActivity(request, host.id, activity.uuid);
      }
      const purge = OWN_PACKAGE_PURGE[host.entry.package];
      if (!purge) return;
      if (!(await listHostSoftwareNames(request, host.id, 'fleet-pw-')).some((n) => n.startsWith('fleet-pw-'))) return;
      if (await getHostRefetchRequested(request, host.id)) return;
      console.warn(`[os matrix] ${host.displayName} still lists a fleet-pw-* package with no title — purging it`);
      await queueAdHocScript(request, host.id, purge);
    }),
  );
});

// Every run starts the real VMs in the same state, and ends them there too
// (the teardown project runs this file again). "The real VMs" are the pool's
// online members, every one of them: each worker is handed its own
// (`requireRealHost`), so any of them may be what a dead run left mid-install.
//
//  - on premium, every lab host is on the fleet its role puts it on
//    (`returnLabHostsToTheirFleets`, below);
//  - nothing of the suite's is still queued on a VM — a dead run's installs
//    and scripts would otherwise hold each VM's one queue ahead of this run's;
//  - the script timeout is Fleet's default — `script-execution-timeout.spec.ts`
//    lowers it to 60 s for every host on the fleet, and a run killed before that
//    test's cleanup leaves it there;
//  - on premium, every durable install/uninstall fixture is uninstalled on
//    every pool VM of its platform, with no failed install or uninstall on
//    record — its resting state, which a dead run, or a test that failed
//    partway, can leave otherwise;
//  - on premium, Recovery Lock enforcement is off on the VMs fleet —
//    `recovery-lock.spec.ts` turns it on and off, and Fleet clears each Mac's
//    password on its next cron tick once it's off.
//
// It repairs what the suite itself leaves behind and nothing else. A pool VM
// that's offline is left out: the lab preflight (`tests/api/lab-hosts.spec.ts`)
// names it, and the workers go on with the rest of the pool.
const OWN_QUEUED = (a: UpcomingActivity): boolean =>
  !!a.scriptName?.startsWith('pw-') ||
  !!a.softwarePackage?.startsWith('fleet-pw-') ||
  a.softwarePackage === OS_SMOKE_MSI.packageName ||
  VM_DURABLE_FIXTURES.some(
    (f) => (f.packageName && f.packageName === a.softwarePackage) || f.fleetMaintainedName === a.softwareTitle,
  );

// Every lab host enrolled with the VMs fleet's enroll secret, so one that
// re-enrolls (deleted and back, fleetd reinstalled) lands on VMs whatever it is
// for: a matrix host there would receive every install and profile the
// real-host specs put on that fleet, and a pool host anywhere else is one no
// worker is handed. This moves each manifest host that is off its role's fleet
// back onto it (the pool on VMs; the matrix and special hosts on OS matrix),
// and is the one thing in the suite that moves a host onto or off OS matrix. A
// returned host is asked for a refetch, which re-runs its fleet's policies:
// that is what puts Claude back on a pool Mac or Windows VM without waiting out
// the hourly policy interval. The refetch only hurries that along, so one Fleet
// doesn't queue is logged and left to the hourly run. Free has no fleets, so
// there this does nothing.
async function returnLabHostsToTheirFleets(request: APIRequestContext): Promise<void> {
  const astray = new Map<string, number[]>();
  for (const record of await listLabHostsAstray(request, labHostsOfRun())) {
    console.warn(
      `[lab hosts] ${record.displayName} (id ${record.id}, ${record.entry.role}) is on ${record.fleetName ?? 'Unassigned'} — returning it to ${record.belongsOn}`,
    );
    astray.set(record.belongsOn, [...(astray.get(record.belongsOn) ?? []), record.id]);
  }
  for (const [name, hostIds] of astray) {
    const fleet = await findFleetByName(request, name);
    if (!fleet) throw new Error(`${name} fleet not found on premium instance — gitops apply likely missing`);
    await transferHosts(request, fleet.id, hostIds);
    await Promise.all(
      hostIds.map((id) =>
        requestHostRefetch(request, id).catch((error) =>
          console.warn(`[lab hosts] no refetch queued for host ${id}: ${failureSummary(error)}`),
        ),
      ),
    );
  }
}

test('bring the real VMs to their resting state', async ({ request }) => {
  // Only as long as a dead run left work for it to do: each uninstall is a
  // queued action and an inventory refetch.
  test.setTimeout(900_000);
  const premium = process.env.SUITE !== 'free';
  const vms = premium ? await findFleetByName(request, 'VMs') : null;
  if (premium && !vms) throw new Error('VMs fleet not found on premium instance — gitops apply likely missing');
  const fleetId = vms?.id ?? 0;

  await returnLabHostsToTheirFleets(request);

  const { script_execution_timeout: timeout, ...options } = await getAgentOptions(request, fleetId);
  if (timeout !== undefined) await setAgentOptions(request, options, fleetId);

  const pool = new Map<VmPlatform, number[]>();
  for (const platform of ['darwin', 'windows', 'linux'] as const) {
    const members = await listPoolHosts(request, platform);
    if (!members.length) console.warn(`[vm preflight] no online real ${platform} VM`);
    pool.set(platform, members.map((member) => member.id));
    for (const member of members) {
      for (const activity of (await listUpcomingActivities(request, member.id)).filter(OWN_QUEUED)) {
        await cancelUpcomingActivity(request, member.id, activity.uuid);
      }
    }
  }

  if (!vms) return;
  if (await getFleetRecoveryLock(request, vms.id)) {
    console.warn('[vm preflight] Recovery Lock was on for the VMs fleet — turning it off');
    await setFleetRecoveryLock(request, vms.id, false);
  }
  await Promise.all(
    VM_DURABLE_FIXTURES.map(async (fixture) => {
      const members = pool.get(fixture.platform) ?? [];
      if (!members.length) return;
      const title = await findVmFixtureTitle(request, vms.id, fixture);
      await Promise.all(members.map((hostId) => ensureVmFixtureUninstalled(request, hostId, title)));
    }),
  );
});
