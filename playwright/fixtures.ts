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
} from './pages';

type FleetWorkerFixtures = {
  /**
   * First host id (sorted by display_name ASC) on the loadtest instance.
   * Loadtest project only — the storageState path is hardcoded.
   */
  firstHostId: number;

  /**
   * Resolved id of the Workstations fleet on the premium instance — fetched
   * once per worker via the Fleet API. Used by premium specs that need to
   * call `page.goto({ fleetId })` for the Workstations scope variant.
   * Throws on free; free specs must not request this fixture.
   */
  workstationsFleetId: number;
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

  /**
   * Auto-applied page-health monitor. Starts before the test body, asserts
   * at teardown that no un-ignored console errors or 5xx server
   * failures occurred. Tests that intentionally trigger errors can opt
   * out with `pageHealth.disable()`. Defaults are tuned in
   * `helpers/console.ts`.
   */
  pageHealth: { disable: () => void };
};

// `box: true` collapses the fixture step in traces so failures surface at
// the real test action instead of inside this file.
export const test = base.extend<FleetFixtures, FleetWorkerFixtures>({
  workstationsFleetId: [async ({}, use) => {
    const baseURL = process.env.FLEET_URL;
    const token = process.env.FLEET_API_TOKEN;
    if (!baseURL || !token) {
      throw new Error('[workstationsFleetId fixture] FLEET_URL and FLEET_API_TOKEN must be set');
    }
    const res = await fetch(`${baseURL}/api/latest/fleet/teams?query=Workstations&per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`[workstationsFleetId fixture] teams lookup failed: HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = (data.fleets ?? data.teams ?? []) as Array<{ id: number; name: string }>;
    const wk = list.find((t) => t.name === 'Workstations');
    if (!wk) {
      throw new Error(
        '[workstationsFleetId fixture] Workstations fleet not found — premium gitops likely not applied',
      );
    }
    await use(wk.id);
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

  firstHostId: [async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: '.auth/loadtest-admin.json',
    });
    const page = await context.newPage();
    await page.goto('/hosts/manage?order_key=display_name&order_direction=asc');
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
});

export { expect } from '@playwright/test';
