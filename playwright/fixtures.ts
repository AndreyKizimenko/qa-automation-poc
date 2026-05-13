/**
 * Page-object fixtures. Specs import `{ test, expect }` from this file
 * (not from `@playwright/test`) and destructure whichever page objects they
 * need.
 *
 * To add a new fixture: build the POM under `pages/`, re-export it from
 * `pages/index.ts`, then in this file: import it, add it to `FleetFixtures`,
 * and add a `[async ({page}, use) => ..., { box: true }]` factory tuple.
 *
 * Authentication and navigation are *not* fixture responsibilities:
 *   - Auth comes from the setup projects' storage state.
 *   - Tests call `<page>.goto()` themselves so the spec body stays explicit.
 */
import { test as base } from '@playwright/test';
import { monitorConsoleErrors, monitorNetworkFailures } from './helpers/console';
import { findFleetByName, withApiRequest } from './helpers/api';

import {
  LoginPage,
  ForgotPasswordPage,
  DashboardPage,
  HostsListPage,
  HostDetailsPage,
  SoftwareTitlesPage,
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
  ConfigurationProfilesPage,
  CertificatesPage,
  InstallSoftwarePage,
  ScriptsLibraryPage,
  ScriptsBatchProgressPage,
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
  LabelsPage,
  PacksListPage,
  PackEditPage,
  OrganizationInfoPage,
  OrganizationAdvancedPage,
  IntegrationsPage,
  UsersPage,
  CreateUserPage,
  CreateApiUserPage,
  EditUserPage,
} from './pages';

type FleetWorkerFixtures = {
  /**
   * First host id (sorted by display_name ASC) within the loadtest fleet on
   * the loadtest instance. Loadtest project only — the storageState path is
   * hardcoded and the fleet is scoped via `loadtestFleetId`.
   */
  firstHostId: number;

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
   * Numeric id of the fleet (team) holding the loadtest dataset on the
   * loadtest instance. Sourced from FLEET_LOADTEST_FLEET_ID, which the
   * workflow that provisions the team sets per run. Required by the
   * loadtest project — specs fail at fixture setup if the env var is
   * missing or non-numeric.
   */
  loadtestFleetId: number;
};

type FleetFixtures = {
  // Auth
  loginPage: LoginPage;
  forgotPasswordPage: ForgotPasswordPage;

  // Core
  dashboard: DashboardPage;
  hostsList: HostsListPage;
  hostDetails: HostDetailsPage;

  // Software + vulnerabilities
  softwareTitles: SoftwareTitlesPage;
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
  configurationProfiles: ConfigurationProfilesPage;
  certificates: CertificatesPage;
  installSoftware: InstallSoftwarePage;
  scriptsLibrary: ScriptsLibraryPage;
  scriptsBatchProgress: ScriptsBatchProgressPage;
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

  // Labels + Packs
  labelsPage: LabelsPage;
  packsList: PacksListPage;
  packEdit: PackEditPage;

  // Settings
  organizationInfo: OrganizationInfoPage;
  organizationAdvanced: OrganizationAdvancedPage;
  integrationsPage: IntegrationsPage;
  usersPage: UsersPage;
  createUserPage: CreateUserPage;
  createApiUserPage: CreateApiUserPage;
  editUserPage: EditUserPage;

  /**
   * Auto-applied page-health monitor. Starts before the test body, asserts
   * at teardown that no un-ignored console errors or 5xx server
   * failures occurred. Tests that intentionally trigger errors can opt
   * out with `pageHealth.disable()`. Defaults are tuned in
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

// `box: true` collapses the fixture step in traces so failures surface at
// the real test action instead of inside this file.
export const test = base.extend<FleetFixtures, FleetWorkerFixtures>({
  workstationsFleetId: [async ({}, use) => {
    await use(await resolvePremiumFleetId('workstationsFleetId', 'Workstations'));
  }, { scope: 'worker', box: true }],

  qaFleetId: [async ({}, use) => {
    await use(await resolvePremiumFleetId('qaFleetId', 'QA'));
  }, { scope: 'worker', box: true }],

  pageHealth: [async ({ page }, use, testInfo) => {
    const errors = monitorConsoleErrors(page);
    const failures = monitorNetworkFailures(page);
    let disabled = false;

    await use({ disable: () => { disabled = true; } });

    // Don't pile on if the test already failed for another reason; the
    // primary failure is more useful. If a test explicitly opted out we
    // also stay quiet.
    if (disabled || testInfo.status !== 'passed') return;

    const errs = errors.getErrors();
    const fails = failures.getFailures();
    const messages: string[] = [];
    if (errs.length) messages.push(`Console errors:\n  ${errs.join('\n  ')}`);
    if (fails.length) messages.push(`Server errors (5xx):\n  ${fails.join('\n  ')}`);
    if (messages.length) throw new Error(`Page health issues:\n${messages.join('\n')}`);
  }, { auto: true, box: true }],

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
  softwareTitles: [async ({ page }, use) => {
    await use(new SoftwareTitlesPage(page));
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
  integrationsPage: [async ({ page }, use) => {
    await use(new IntegrationsPage(page));
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
