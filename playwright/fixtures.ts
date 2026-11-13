/**
 * The suite's two test objects, one built on the other:
 *
 *   - `apiTest` carries the worker fixtures (fleet ids, the live macOS VM), the
 *     `cleanup` stack with the data fixtures built on it (`throwawayFleet`,
 *     `borrowSims`, `seed`), and nothing that needs a page. API and CLI specs
 *     import it, so none of their tests opens a browser.
 *   - `test` extends it with the page objects and the automatic `pageHealth`
 *     monitor. Browser specs import `{ test, expect }` from this file (not from
 *     `@playwright/test`) and destructure whichever page objects they need.
 *
 * To add a new fixture: build the POM under `pages/`, re-export it from
 * `pages/index.ts`, then in this file: import it, add it to `FleetFixtures`,
 * and add a `[async ({page}, use) => ..., { box: true }]` factory tuple.
 *
 * Authentication and navigation are *not* fixture responsibilities:
 *   - Auth comes from the setup projects' storage state.
 *   - Tests call `<page>.goto()` themselves so the spec body stays explicit.
 */
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import {
  monitorConsoleErrors,
  monitorNetworkFailures,
  monitorPageErrors,
} from './helpers/console';
import {
  createFleet,
  createFleetPolicy,
  createManualLabel,
  createPolicy,
  createReport,
  deleteFleet,
  deleteFleetPolicies,
  deleteLabelById,
  deletePolicies,
  deleteReport,
  deleteScript,
  failureSummary,
  findFleetByName,
  findMdmSimulations,
  findOnlineHost,
  findSimulations,
  missingRealHostReason,
  transferHosts,
  uploadScript,
  withApiRequest,
  type FleetRef,
  type OnlineHostRef,
  type ReportRef,
} from './helpers/api';
import { ownName } from './helpers/own-name';

import {
  CommandPalette,
  LoginPage,
  ForgotPasswordPage,
  DashboardPage,
  HostsListPage,
  HostDetailsPage,
  HostQueryReportPage,
  SoftwareTitlesPage,
  SoftwareLibraryPage,
  SoftwareVersionsPage,
  SoftwareTitleDetailPage,
  SoftwareVersionDetailPage,
  SoftwareOsPage,
  SoftwareOsDetailPage,
  VulnerabilitiesListPage,
  CveDetailPage,
  FleetMaintainedAppsPage,
  FleetMaintainedAppDetailPage,
  SoftwareCustomPackagePage,
  SoftwareAppStoreVppPage,
  SoftwareAppStoreAndroidPage,
  ControlsPage,
  OsUpdatesPage,
  OsSettingsPage,
  DiskEncryptionPage,
  PasswordsPage,
  ConfigurationProfilesPage,
  CertificatesPage,
  InstallSoftwarePage,
  ScriptsLibraryPage,
  ScriptsBatchProgressPage,
  ScriptBatchDetailsPage,
  VariablesPage,
  BootstrapPackagePage,
  SetupExperiencePage,
  RunScriptPage,
  SetupExperienceUsersPage,
  SetupAssistantPage,
  ReportsListPage,
  ReportEditPage,
  ReportDetailsPage,
  ReportLivePage,
  PoliciesListPage,
  PolicyEditPage,
  PolicyDetailsPage,
  PolicyLivePage,
  LabelsPage,
  PacksListPage,
  PackEditPage,
  OrganizationInfoPage,
  OrganizationAdvancedPage,
  FleetsPage,
  IntegrationsPage,
  ChangeManagementPage,
  UsersPage,
  CreateUserPage,
  CreateApiUserPage,
  EditUserPage,
} from './pages';

type BrowserWorkerFixtures = {
  /**
   * First host id (sorted by display_name ASC) within the loadtest fleet on
   * the loadtest instance. Loadtest project only — the storageState path is
   * hardcoded and the fleet is scoped via `loadtestFleetId`.
   */
  firstHostId: number;
};

type ApiWorkerFixtures = {
  /**
   * Resolved id of the Workstations fleet on the premium instance — fetched
   * once per worker via the Fleet API. Used by premium specs that need to
   * call `page.goto({ fleetId })` for the Workstations scope variant.
   * Throws with a `premium-only` error if requested on any other tier.
   */
  workstationsFleetId: number;

  /**
   * Resolved id of the QA fleet on the premium instance — fetched once per
   * worker via the Fleet API. Used by premium role-access specs that need a
   * second fleet alongside Workstations to verify cross-fleet denial.
   * Throws with a `premium-only` error if requested on any other tier.
   */
  qaFleetId: number;

  /**
   * Resolved id of the "VMs" fleet on the premium instance — home of the real
   * (non-simulated) QA VMs, and the second fleet the `team-admin` static user
   * administers. Throws with a `premium-only` error if requested on any other
   * tier.
   */
  vmsFleetId: number;

  /**
   * Numeric id of the fleet (team) holding the loadtest dataset on the
   * loadtest instance. Sourced from FLEET_LOADTEST_FLEET_ID, set by hand per
   * run (see `gitops/loadtest/README.md` step 7). Required by the
   * loadtest project — specs fail at fixture setup if the env var is
   * missing or non-numeric.
   */
  loadtestFleetId: number;

  /**
   * The online **real** macOS VM, resolved once per worker via the Fleet API,
   * with the vitals a spec asserts against. Backs every spec that needs genuine
   * device behaviour — live reports that actually run the query's SQL, refetch,
   * real local users and agent versions.
   *
   * Resolved by platform + online status + hardware model rather than by name or
   * a pinned id, since ids change on re-enrollment. A virtualized hardware model
   * is what separates the real VMs from the osquery-perf load fleet sharing these
   * instances (see `HostKind`); on premium the VMs also live in their own "VMs"
   * fleet, but free has no fleets, so the hardware model is the cross-tier signal.
   *
   * Specs needing *volume* rather than fidelity (bulk select/transfer/delete)
   * should draw from the simulated pool via `findSimulatedHostIds` instead —
   * there are only a couple of real VMs per tier and they must not be destroyed.
   *
   * Fails loud when none is online, so a downed VM surfaces as a clear setup
   * error instead of a puzzling mid-spec assertion failure.
   */
  liveMacosHost: OnlineHostRef;
};

/** What a test registers to undo something it made on the instance: the `cleanup` fixture. */
export interface Cleanup {
  /**
   * Registers how to undo what the test just made. `undo` gets an API context
   * of its own, which is still open when the test's own context isn't.
   * Register right after the thing exists, before anything that can fail.
   */
  add(what: string, undo: (request: APIRequestContext) => Promise<unknown>): void;
}

type ApiTestFixtures = {
  /**
   * The test's undo stack. Everything registered with `cleanup.add` runs
   * after the test, last registered first, whether it passed, failed or timed
   * out: Playwright skips the rest of a timed-out test, its `finally` blocks
   * included, but still tears its fixtures down, giving this one a budget of
   * its own. Each undo runs as a report step; one that fails doesn't stop the
   * rest, and the test then fails with every undo that didn't take. A retry
   * starts on an instance its failed attempt has already put back.
   *
   * An undo meets what the test may have removed itself (a delete step), so it
   * treats "already gone" as done: `deleteFleet(r, id, { ignoreMissing: true })`.
   *
   * It belongs to one test. What a serial lifecycle's later steps still use
   * isn't registered here, or it is gone before they run: the lifecycle's own
   * delete step removes it, and the cleanup projects' sweep after a dead run.
   */
  cleanup: Cleanup;

  /**
   * A fleet of the test's own, `ownName(kind)`, deleted after the test: the
   * place for a fleet-level write, which on a standing fleet would collide
   * with every other spec that writes it (premium only). Ask for it before the
   * first page load: the fleet dropdown reads the fleet list once, at boot.
   * Its delete is retried for 30 s: the instances' gateway serves the
   * odd 502, and a stray fleet sits in every fleet picker until the sweep.
   */
  throwawayFleet: (kind: string) => Promise<FleetRef>;

  /**
   * Moves `count` online simulations onto fleet `to` and returns them to
   * Unassigned after the test (premium only). `offset` is this spec's slice of
   * the pool, claimed in the registry on `findSimulations` in
   * `helpers/api/hosts.ts`, so no two specs are handed the same hosts. `mdm`
   * draws from the MDM-enrolled simulations, a scarce pool kept for profile
   * targeting (`findMdmSimulations`). Throws when the pool can't cover the
   * slice.
   */
  borrowSims: (opts: BorrowSims) => Promise<number[]>;

  /**
   * Creates what a test stands on, named `ownName(kind)`, and deletes it after
   * the test. For anything it doesn't make, create through the helper and
   * register the delete with `cleanup.add`.
   */
  seed: Seed;
};

export interface BorrowSims {
  platform: 'darwin' | 'windows' | 'linux';
  count: number;
  offset: number;
  /** The fleet the simulations are moved to. */
  to: number;
  /** From the MDM-enrolled pool; macOS and Windows only. */
  mdm?: boolean;
}

export interface Seed {
  /** A manual label holding `hostIds`. */
  label(kind: string, hostIds: number[]): Promise<{ id: number; name: string }>;
  /** A policy, global or (with `fleetId`, 0 for Unassigned) a fleet's own. */
  policy(kind: string, opts?: { fleetId?: number; query?: string; platform?: string }): Promise<{ id: number; name: string }>;
  /** A report, global unless `teamId` is given; `createReport`'s options. */
  report(kind: string, opts?: Omit<Parameters<typeof createReport>[1], 'name'>): Promise<ReportRef>;
  /** A library script on `fleetId` (0 for Unassigned), named `ownName(kind)` plus `extension`. */
  script(
    kind: string,
    opts: { fleetId: number; content: string; extension?: '.sh' | '.ps1' },
  ): Promise<{ id: number; name: string }>;
}

type FleetFixtures = {
  /**
   * Fleet spotlight. A component object rather than a page object, and the
   * only one exposed as a fixture: `CoreLayout` mounts the palette on every
   * authenticated page, so it belongs to no page object and every spec that
   * drives it would otherwise construct it by hand. Components owned by a
   * page (Toast, DataTable) stay composed onto that page instead.
   */
  palette: CommandPalette;

  // Auth
  loginPage: LoginPage;
  forgotPasswordPage: ForgotPasswordPage;

  // Core
  dashboard: DashboardPage;
  hostsList: HostsListPage;
  hostDetails: HostDetailsPage;
  hostQueryReport: HostQueryReportPage;

  // Software + vulnerabilities
  softwareTitles: SoftwareTitlesPage;
  softwareLibrary: SoftwareLibraryPage;
  softwareVersions: SoftwareVersionsPage;
  softwareTitleDetail: SoftwareTitleDetailPage;
  softwareVersionDetail: SoftwareVersionDetailPage;
  softwareOs: SoftwareOsPage;
  softwareOsDetail: SoftwareOsDetailPage;
  vulnerabilitiesList: VulnerabilitiesListPage;
  cveDetail: CveDetailPage;
  fleetMaintainedApps: FleetMaintainedAppsPage;
  fleetMaintainedAppDetail: FleetMaintainedAppDetailPage;
  softwareCustomPackage: SoftwareCustomPackagePage;
  softwareAppStoreVpp: SoftwareAppStoreVppPage;
  softwareAppStoreAndroid: SoftwareAppStoreAndroidPage;

  // Controls
  controls: ControlsPage;
  osUpdates: OsUpdatesPage;
  osSettings: OsSettingsPage;
  diskEncryption: DiskEncryptionPage;
  passwords: PasswordsPage;
  configurationProfiles: ConfigurationProfilesPage;
  certificates: CertificatesPage;
  installSoftware: InstallSoftwarePage;
  scriptsLibrary: ScriptsLibraryPage;
  scriptsBatchProgress: ScriptsBatchProgressPage;
  scriptBatchDetails: ScriptBatchDetailsPage;
  variables: VariablesPage;
  bootstrapPackage: BootstrapPackagePage;
  setupExperience: SetupExperiencePage;
  runScript: RunScriptPage;
  setupExperienceUsers: SetupExperienceUsersPage;
  setupAssistant: SetupAssistantPage;

  // Reports + Policies
  reportsList: ReportsListPage;
  reportEdit: ReportEditPage;
  reportDetails: ReportDetailsPage;
  reportLive: ReportLivePage;
  policiesList: PoliciesListPage;
  policyEdit: PolicyEditPage;
  policyDetails: PolicyDetailsPage;
  policyLive: PolicyLivePage;

  // Labels + Packs
  labelsPage: LabelsPage;
  packsList: PacksListPage;
  packEdit: PackEditPage;

  // Settings
  organizationInfo: OrganizationInfoPage;
  organizationAdvanced: OrganizationAdvancedPage;
  fleetsPage: FleetsPage;
  integrationsPage: IntegrationsPage;
  changeManagement: ChangeManagementPage;
  usersPage: UsersPage;
  createUserPage: CreateUserPage;
  createApiUserPage: CreateApiUserPage;
  editUserPage: EditUserPage;

  /**
   * Auto-applied page-health monitor. Starts before the test body, asserts
   * at teardown that no uncaught page exceptions, un-ignored console errors
   * or 5xx server failures occurred. Tests that intentionally trigger errors
   * can opt out with `pageHealth.disable()`. Defaults are tuned in
   * `helpers/console.ts`.
   */
  pageHealth: { disable: () => void };
};

/**
 * Resolves a premium fleet id by name via the Fleet API, gated to the premium
 * tier. A free spec that accidentally requests one of the premium-only
 * fixtures below fails here with a clear "premium-only" error instead of
 * surfacing a misleading "fleet not found" later in the call.
 */
async function resolvePremiumFleetId(
  fixtureName: string,
  teamName: string,
): Promise<number> {
  if (process.env.SUITE !== 'premium') {
    throw new Error(
      `[${fixtureName}] premium-only fixture — must not be requested on SUITE=${process.env.SUITE}. ` +
      `Free/loadtest specs have no fleet concept; if you need this id, move the spec under tests/e2e/premium/.`,
    );
  }
  const fleet = await withApiRequest((request) => findFleetByName(request, teamName));
  if (!fleet) {
    throw new Error(
      `[${fixtureName}] '${teamName}' fleet not found on premium instance — gitops apply likely missing.`,
    );
  }
  return fleet.id;
}

/** Throws on any tier but premium: the fixtures that create or fill a fleet have none to act on there. */
function requirePremium(fixtureName: string): void {
  if (process.env.SUITE !== 'premium') {
    throw new Error(`[${fixtureName}] premium-only fixture — SUITE=${process.env.SUITE} has no fleets`);
  }
}

// `box: true` collapses the fixture step in traces so failures surface at
// the real test action instead of inside this file.
export const apiTest = base.extend<ApiTestFixtures, ApiWorkerFixtures>({
  cleanup: [async ({}, use) => {
    const undos: Array<{ what: string; undo: (request: APIRequestContext) => Promise<unknown> }> = [];
    await use({ add: (what, undo) => { undos.push({ what, undo }); } });
    if (!undos.length) return;

    const failures: string[] = [];
    await withApiRequest(async (request) => {
      for (const { what, undo } of undos.reverse()) {
        try {
          await base.step(`cleanup: ${what}`, async () => { await undo(request); }, { box: true });
        } catch (error) {
          // The report keeps the step's own error; the summary that reaches the job log is one line.
          failures.push(`${what}: ${failureSummary(error)}`);
        }
      }
    });
    if (failures.length) {
      throw new Error(`[cleanup] ${failures.length} undo(s) failed; what each was to remove is still on the instance:\n  ${failures.join('\n  ')}`);
    }
  // Its own budget, apart from the test's: a test that used its whole timeout
  // still gets its undo actions run. Not boxed: a boxed fixture hides the
  // steps inside it, and each undo is a step the report should show.
  }, { timeout: 120_000 }],

  throwawayFleet: [async ({ request, cleanup }, use) => {
    await use(async (kind) => {
      requirePremium('throwawayFleet');
      const fleet = await createFleet(request, ownName(kind));
      cleanup.add(`delete fleet ${fleet.name}`, (r) =>
        expect
          .poll(() => deleteFleet(r, fleet.id, { ignoreMissing: true }).then(() => true, () => false), {
            timeout: 30_000,
            message: `throwaway fleet ${fleet.id} could not be deleted and is still on the instance`,
          })
          .toBe(true),
      );
      return fleet;
    });
  }, { box: true }],

  borrowSims: [async ({ request, cleanup }, use) => {
    await use(async ({ platform, count, offset, to, mdm }) => {
      requirePremium('borrowSims');
      if (mdm && platform === 'linux') throw new Error('[borrowSims] no MDM-enrolled Linux simulations exist');
      const ids = mdm
        ? await findMdmSimulations(request, platform as 'darwin' | 'windows', count, offset)
        : await findSimulations(request, platform, count, offset);
      if (ids.length < count) {
        throw new Error(
          `[borrowSims] needs ${count} online ${mdm ? 'MDM-enrolled ' : ''}${platform} simulations at offset ${offset}; the pool has ${ids.length}`,
        );
      }
      // Registered before the move, so a move that fails halfway still sends back what it moved.
      cleanup.add(`return simulations ${ids.join(', ')} to Unassigned`, (r) => transferHosts(r, 0, ids));
      await transferHosts(request, to, ids);
      return ids;
    });
  }, { box: true }],

  seed: [async ({ request, cleanup }, use) => {
    await use({
      async label(kind, hostIds) {
        const name = ownName(kind);
        const id = await createManualLabel(request, name, hostIds);
        cleanup.add(`delete label ${name}`, async (r) => {
          const status = await deleteLabelById(r, id);
          if (status >= 300) throw new Error(`[seed.label] deleting label ${id} answered ${status}`);
        });
        return { id, name };
      },
      async policy(kind, { fleetId, ...fields } = {}) {
        const name = ownName(kind);
        if (fleetId === undefined) {
          const policy = await createPolicy(request, { name, ...fields });
          cleanup.add(`delete global policy ${name}`, (r) => deletePolicies(r, [policy.id]));
          return policy;
        }
        const policy = await createFleetPolicy(request, fleetId, { name, ...fields });
        cleanup.add(`delete policy ${name} on fleet ${fleetId}`, (r) => deleteFleetPolicies(r, fleetId, [policy.id]));
        return { id: policy.id, name: policy.name };
      },
      async report(kind, opts = {}) {
        const report = await createReport(request, { ...opts, name: ownName(kind) });
        cleanup.add(`delete report ${report.name}`, (r) => deleteReport(r, report.id));
        return report;
      },
      async script(kind, { fleetId, content, extension = '.sh' }) {
        const name = `${ownName(kind)}${extension}`;
        const id = await uploadScript(request, fleetId, name, content);
        cleanup.add(`delete script ${name}`, (r) => deleteScript(r, id));
        return { id, name };
      },
    });
  }, { box: true }],

  workstationsFleetId: [async ({}, use) => {
    await use(await resolvePremiumFleetId('workstationsFleetId', 'Workstations'));
  }, { scope: 'worker', box: true }],

  qaFleetId: [async ({}, use) => {
    await use(await resolvePremiumFleetId('qaFleetId', 'QA'));
  }, { scope: 'worker', box: true }],

  vmsFleetId: [async ({}, use) => {
    await use(await resolvePremiumFleetId('vmsFleetId', 'VMs'));
  }, { scope: 'worker', box: true }],

  liveMacosHost: [async ({}, use) => {
    const host = await withApiRequest((request) =>
      findOnlineHost(request, 'darwin', { kind: 'real' }),
    );
    if (!host) {
      const reason = await withApiRequest((request) => missingRealHostReason(request, 'darwin'));
      throw new Error(
        `[liveMacosHost] no online macOS VM on ${process.env.FLEET_URL}: ${reason}. ` +
        'Real-device specs need one; a VM is found by its hardware model, not by MDM enrolment.',
      );
    }
    await use(host);
  }, { scope: 'worker', box: true }],

  loadtestFleetId: [async ({}, use) => {
    const raw = process.env.FLEET_LOADTEST_FLEET_ID;
    const id = Number(raw);
    if (!raw || !Number.isInteger(id) || id <= 0) {
      throw new Error(
        `[loadtestFleetId fixture] FLEET_LOADTEST_FLEET_ID must be a positive integer (got ${JSON.stringify(raw)}). Set it in .env.loadtest to the id of the team holding the loadtest dataset.`,
      );
    }
    await use(id);
  }, { scope: 'worker', box: true }],
});

// Everything below needs a page (or, for `firstHostId`, a browser), so it
// lives on the test object only browser specs import: an automatic fixture
// that asks for `page` gives every test a page, whether or not it uses one.
export const test = apiTest.extend<FleetFixtures, BrowserWorkerFixtures>({
  pageHealth: [async ({ page }, use, testInfo) => {
    const errors = monitorConsoleErrors(page);
    const exceptions = monitorPageErrors(page);
    const failures = monitorNetworkFailures(page);
    let disabled = false;

    await use({ disable: () => { disabled = true; } });

    // Don't pile on if the test already failed for another reason; the
    // primary failure is more useful. If a test explicitly opted out we
    // also stay quiet.
    if (disabled || testInfo.status !== 'passed') return;

    const errs = errors.getErrors();
    const excs = exceptions.getErrors();
    const fails = failures.getFailures();
    const messages: string[] = [];
    // Listed first: an uncaught exception means the page itself broke, which
    // explains any console or network noise reported alongside it.
    if (excs.length) messages.push(`Uncaught page exceptions:\n  ${excs.join('\n  ')}`);
    if (errs.length) messages.push(`Console errors:\n  ${errs.join('\n  ')}`);
    if (fails.length) messages.push(`Server errors (5xx):\n  ${fails.join('\n  ')}`);
    if (messages.length) throw new Error(`Page health issues:\n${messages.join('\n')}`);
  }, { auto: true, box: true }],

  firstHostId: [async ({ browser, loadtestFleetId }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/loadtest-admin.json',
    });
    const page = await context.newPage();
    await page.goto(`/hosts/manage?fleet_id=${loadtestFleetId}&order_key=display_name&order_direction=asc`);
    const firstLink = page.getByRole('table').locator('tbody tr').first().getByRole('link').first();
    const href = (await firstLink.getAttribute('href')) ?? '';
    const id = parseInt(href.match(/\/hosts\/(\d+)/)?.[1] ?? '0', 10);
    await context.close();
    await use(id);
  }, { scope: 'worker', box: true }],

  palette: [async ({ page }, use) => {
    await use(new CommandPalette(page));
  }, { box: true }],
  loginPage: [async ({ page }, use) => {
    await use(new LoginPage(page));
  }, { box: true }],
  forgotPasswordPage: [async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  }, { box: true }],
  dashboard: [async ({ page }, use) => {
    await use(new DashboardPage(page));
  }, { box: true }],
  hostsList: [async ({ page }, use) => {
    await use(new HostsListPage(page));
  }, { box: true }],
  hostDetails: [async ({ page }, use) => {
    await use(new HostDetailsPage(page));
  }, { box: true }],
  hostQueryReport: [async ({ page }, use) => {
    await use(new HostQueryReportPage(page));
  }, { box: true }],
  softwareTitles: [async ({ page }, use) => {
    await use(new SoftwareTitlesPage(page));
  }, { box: true }],
  softwareLibrary: [async ({ page }, use) => {
    await use(new SoftwareLibraryPage(page));
  }, { box: true }],
  softwareVersions: [async ({ page }, use) => {
    await use(new SoftwareVersionsPage(page));
  }, { box: true }],
  softwareTitleDetail: [async ({ page }, use) => {
    await use(new SoftwareTitleDetailPage(page));
  }, { box: true }],
  softwareVersionDetail: [async ({ page }, use) => {
    await use(new SoftwareVersionDetailPage(page));
  }, { box: true }],
  softwareOs: [async ({ page }, use) => {
    await use(new SoftwareOsPage(page));
  }, { box: true }],
  softwareOsDetail: [async ({ page }, use) => {
    await use(new SoftwareOsDetailPage(page));
  }, { box: true }],
  vulnerabilitiesList: [async ({ page }, use) => {
    await use(new VulnerabilitiesListPage(page));
  }, { box: true }],
  cveDetail: [async ({ page }, use) => {
    await use(new CveDetailPage(page));
  }, { box: true }],
  fleetMaintainedApps: [async ({ page }, use) => {
    await use(new FleetMaintainedAppsPage(page));
  }, { box: true }],
  fleetMaintainedAppDetail: [async ({ page }, use) => {
    await use(new FleetMaintainedAppDetailPage(page));
  }, { box: true }],
  softwareCustomPackage: [async ({ page }, use) => {
    await use(new SoftwareCustomPackagePage(page));
  }, { box: true }],
  softwareAppStoreVpp: [async ({ page }, use) => {
    await use(new SoftwareAppStoreVppPage(page));
  }, { box: true }],
  softwareAppStoreAndroid: [async ({ page }, use) => {
    await use(new SoftwareAppStoreAndroidPage(page));
  }, { box: true }],

  // Controls
  controls: [async ({ page }, use) => {
    await use(new ControlsPage(page));
  }, { box: true }],
  osUpdates: [async ({ page }, use) => {
    await use(new OsUpdatesPage(page));
  }, { box: true }],
  osSettings: [async ({ page }, use) => {
    await use(new OsSettingsPage(page));
  }, { box: true }],
  diskEncryption: [async ({ page }, use) => {
    await use(new DiskEncryptionPage(page));
  }, { box: true }],
  passwords: [async ({ page }, use) => {
    await use(new PasswordsPage(page));
  }, { box: true }],
  configurationProfiles: [async ({ page }, use) => {
    await use(new ConfigurationProfilesPage(page));
  }, { box: true }],
  certificates: [async ({ page }, use) => {
    await use(new CertificatesPage(page));
  }, { box: true }],
  installSoftware: [async ({ page }, use) => {
    await use(new InstallSoftwarePage(page));
  }, { box: true }],
  scriptsLibrary: [async ({ page }, use) => {
    await use(new ScriptsLibraryPage(page));
  }, { box: true }],
  scriptsBatchProgress: [async ({ page }, use) => {
    await use(new ScriptsBatchProgressPage(page));
  }, { box: true }],
  scriptBatchDetails: [async ({ page }, use) => {
    await use(new ScriptBatchDetailsPage(page));
  }, { box: true }],
  variables: [async ({ page }, use) => {
    await use(new VariablesPage(page));
  }, { box: true }],
  bootstrapPackage: [async ({ page }, use) => {
    await use(new BootstrapPackagePage(page));
  }, { box: true }],
  setupExperience: [async ({ page }, use) => {
    await use(new SetupExperiencePage(page));
  }, { box: true }],
  runScript: [async ({ page }, use) => {
    await use(new RunScriptPage(page));
  }, { box: true }],
  setupExperienceUsers: [async ({ page }, use) => {
    await use(new SetupExperienceUsersPage(page));
  }, { box: true }],
  setupAssistant: [async ({ page }, use) => {
    await use(new SetupAssistantPage(page));
  }, { box: true }],

  // Reports + Policies
  reportsList: [async ({ page }, use) => {
    await use(new ReportsListPage(page));
  }, { box: true }],
  reportEdit: [async ({ page }, use) => {
    await use(new ReportEditPage(page));
  }, { box: true }],
  reportDetails: [async ({ page }, use) => {
    await use(new ReportDetailsPage(page));
  }, { box: true }],
  reportLive: [async ({ page }, use) => {
    await use(new ReportLivePage(page));
  }, { box: true }],
  policiesList: [async ({ page }, use) => {
    await use(new PoliciesListPage(page));
  }, { box: true }],
  policyEdit: [async ({ page }, use) => {
    await use(new PolicyEditPage(page));
  }, { box: true }],
  policyDetails: [async ({ page }, use) => {
    await use(new PolicyDetailsPage(page));
  }, { box: true }],
  policyLive: [async ({ page }, use) => {
    await use(new PolicyLivePage(page));
  }, { box: true }],

  // Labels + Packs
  labelsPage: [async ({ page }, use) => {
    await use(new LabelsPage(page));
  }, { box: true }],
  packsList: [async ({ page }, use) => {
    await use(new PacksListPage(page));
  }, { box: true }],
  packEdit: [async ({ page }, use) => {
    await use(new PackEditPage(page));
  }, { box: true }],

  // Settings
  organizationInfo: [async ({ page }, use) => {
    await use(new OrganizationInfoPage(page));
  }, { box: true }],
  organizationAdvanced: [async ({ page }, use) => {
    await use(new OrganizationAdvancedPage(page));
  }, { box: true }],
  fleetsPage: [async ({ page }, use) => {
    await use(new FleetsPage(page));
  }, { box: true }],
  integrationsPage: [async ({ page }, use) => {
    await use(new IntegrationsPage(page));
  }, { box: true }],
  changeManagement: [async ({ page }, use) => {
    await use(new ChangeManagementPage(page));
  }, { box: true }],
  usersPage: [async ({ page }, use) => {
    await use(new UsersPage(page));
  }, { box: true }],
  createUserPage: [async ({ page }, use) => {
    await use(new CreateUserPage(page));
  }, { box: true }],
  createApiUserPage: [async ({ page }, use) => {
    await use(new CreateApiUserPage(page));
  }, { box: true }],
  editUserPage: [async ({ page }, use) => {
    await use(new EditUserPage(page));
  }, { box: true }],
});

export { expect } from '@playwright/test';

/**
 * Retries for a describe whose tests wait on a real VM. CI retries every test
 * twice, but a VM test's attempt runs 10–15 minutes and a wedged host fails
 * every attempt the same way, so two such tests at three attempts each are 90
 * of a run's ~300 worker-minutes and can reach the run's globalTimeout. One
 * retry still turns a transient into `flaky` in the report; locally there are
 * none, so a repeated run shows a test's real spread.
 */
export const HOST_RETRIES = process.env.CI ? 1 : 0;
