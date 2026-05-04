import { test, expect } from '@fixtures';
import {
  getApiToken,
  findHostByPlatform,
  findVulnerableSoftwareBySource,
  type HostRef,
  type SoftwareTitleRef,
} from '@helpers/api';
import { expectRowHasVulnData, expectSingleCve, assertVulnTooltip } from '@helpers/vuln';

// ── Shared state populated by beforeAll (all via API, no UI scraping) ────────

const OS_KEYS = ['macos', 'deb', 'windows'] as const;
type OsKey = typeof OS_KEYS[number];

// osquery source values per platform (see helpers/api.ts)
const OS_SOURCES: Record<OsKey, string[]> = {
  macos: ['apps'],
  deb: ['deb_packages'],
  windows: ['programs', 'chocolatey_packages'],
};

const OS_LABELS: Record<OsKey, string> = {
  macos: 'macOS',
  deb: 'Linux (deb)',
  windows: 'Windows',
};

const softwareByOS: Partial<Record<OsKey, SoftwareTitleRef>> = {};
const hostByOS: Partial<Record<OsKey, HostRef>> = {};

test.beforeAll(async () => {
  const baseURL = process.env.FLEET_URL!;
  const token = await getApiToken(baseURL);

  const [macSw, debSw, winSw, macHost, linuxHost, winHost] = await Promise.all([
    findVulnerableSoftwareBySource(baseURL, token, OS_SOURCES.macos),
    findVulnerableSoftwareBySource(baseURL, token, OS_SOURCES.deb),
    findVulnerableSoftwareBySource(baseURL, token, OS_SOURCES.windows),
    findHostByPlatform(baseURL, token, 'darwin'),
    findHostByPlatform(baseURL, token, 'linux'),
    findHostByPlatform(baseURL, token, 'windows'),
  ]);

  if (macSw) softwareByOS.macos = macSw;
  if (debSw) softwareByOS.deb = debSw;
  if (winSw) softwareByOS.windows = winSw;

  if (macHost) hostByOS.macos = macHost;
  if (linuxHost) hostByOS.deb = linuxHost;
  if (winHost) hostByOS.windows = winHost;
});

// ═════════════════════════════════════════════════════════════════════════════
// Software Titles — filter, column assertions, pagination (standalone)
// ═════════════════════════════════════════════════════════════════════════════

test('Software Titles — vulnerable filter, pagination, and column checks', async ({
  softwareTitles,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.filter.applyVulnerable();
  await expect(page).toHaveURL(/vulnerable=true/);

  // Every row should show vulnerability data
  const rows = softwareTitles.table.table.locator('tbody tr');
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    await expectRowHasVulnData(page, rows.nth(i));
  }

  // Multi-vulnerability tooltip
  const multiRow = await softwareTitles.table.findRowByColumnPattern('Vulnerabilities', /^\d+ vulnerabilities$/);
  if (multiRow) {
    await assertVulnTooltip(page, multiRow);
  }

  // Single vulnerability — CVE displayed directly
  const singleRow = await softwareTitles.table.findRowByColumnPattern('Vulnerabilities', /^CVE-\d{4}-\d+$/);
  if (singleRow) {
    await expectSingleCve(page, singleRow);
  }

  // Pagination
  if (await softwareTitles.pagination.nextIfEnabled(softwareTitles.table)) {
    await softwareTitles.pagination.nextIfEnabled(softwareTitles.table);
    await softwareTitles.pagination.previousIfEnabled(softwareTitles.table);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Per-OS click-through flow — titles → version → CVE
// ═════════════════════════════════════════════════════════════════════════════
// All three tests can run in parallel: they share no state, only `softwareByOS`
// populated in beforeAll. The first to click "Visit NVD page" wins the NVD check.

for (const osKey of OS_KEYS) {
  test(`${OS_LABELS[osKey]} — software titles → version → CVE detail flow`, async ({
    softwareTitles,
    softwareTitleDetail,
    softwareVersionDetail,
    cveDetail,
    page,
  }) => {
    test.skip(!softwareByOS[osKey], `No ${OS_LABELS[osKey]} software found`);
    const ref = softwareByOS[osKey]!;

    await softwareTitles.goto();
    await softwareTitles.filter.applyVulnerable();
    await softwareTitles.searchByName(ref.name);
    await softwareTitles.clickSoftwareTitle(ref.name);

    await softwareTitleDetail.waitForReady();
    await softwareTitleDetail.clickFirstVersionWithVulnerabilities();

    await softwareVersionDetail.waitForReady();
    const cveText = await softwareVersionDetail.clickFirstCve();

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    // Only the macOS flow verifies the NVD link click (to avoid hitting nvd.nist.gov
    // three times per run); the other flows still verify the href attribute.
    await cveDetail.assertOk(cveText, { clickNvdLink: osKey === 'macos' });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Vulnerabilities tab — list, pagination, CVE detail
// ═════════════════════════════════════════════════════════════════════════════

test('Vulnerabilities tab — list, pagination, and CVE detail flow', async ({
  softwareTitles,
  vulnerabilitiesList,
  cveDetail,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.gotoVulnerabilitiesTab();

  const cveName = await vulnerabilitiesList.firstCveName();

  if (await vulnerabilitiesList.pagination.nextIfEnabled(vulnerabilitiesList.table)) {
    await vulnerabilitiesList.pagination.nextIfEnabled(vulnerabilitiesList.table);
  }

  await vulnerabilitiesList.vulnerabilitiesTab.click();
  // Tab click re-fetches page 1 — wait for the original CVE to be back on top.
  await expect(vulnerabilitiesList.table.firstRowPrimaryLink).toHaveText(cveName, { useInnerText: true });

  const clickedCve = await vulnerabilitiesList.clickFirstCve();
  expect(clickedCve).toBe(cveName);

  await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
  await cveDetail.assertOk(cveName);
});

// ═════════════════════════════════════════════════════════════════════════════
// Host Details — vulnerable software flow (per OS)
// ═════════════════════════════════════════════════════════════════════════════

for (const osKey of OS_KEYS) {
  test(`${OS_LABELS[osKey]} host — vulnerable software → version → CVE flow`, async ({
    hostDetails,
    softwareTitleDetail,
    softwareVersionDetail,
    cveDetail,
    page,
  }) => {
    test.skip(!hostByOS[osKey], `No ${OS_LABELS[osKey]} host with vulnerable software`);
    const host = hostByOS[osKey]!;

    await hostDetails.goto(host.id);
    await hostDetails.openSoftwareTab();

    await hostDetails.applyVulnerableFilter();
    // Wait for the filter to finish applying (row OR empty state must appear)
    // before deciding whether to skip — bare isVisible() can race the render.
    await expect(hostDetails.table.rowOrEmpty()).toBeVisible();
    const hasRows = await hostDetails.table.firstRow.isVisible();
    test.skip(!hasRows, `No vulnerable software on ${OS_LABELS[osKey]} host`);

    await hostDetails.clickFirstSoftware();

    await softwareTitleDetail.waitForReady();
    await softwareTitleDetail.clickFirstVersionWithVulnerabilities();

    await softwareVersionDetail.waitForReady();
    const cveText = await softwareVersionDetail.clickFirstCve();

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    await cveDetail.assertOk(cveText);
  });
}
