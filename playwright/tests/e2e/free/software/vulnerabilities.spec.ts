/**
 * Software vulnerability flows on free — list, version, CVE detail, and
 * host-level vulnerable software click-through. No team dropdown on free,
 * so navigation skips the scope-selection step.
 */
import { test, expect } from '@fixtures';
import {
  getApiToken,
  findHostByPlatform,
  findVulnerableSoftwareBySource,
  type HostRef,
  type SoftwareTitleRef,
} from '@helpers/api';
import { expectRowHasVulnData, expectSingleCve, assertVulnTooltip } from '@helpers/vuln';

const OS_KEYS = ['macos', 'deb', 'windows'] as const;
type OsKey = typeof OS_KEYS[number];

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

test.describe('Software vulnerabilities', { tag: '@free' }, () => {
  test('Software Titles — vulnerable filter, pagination, and column checks', async ({
    softwareTitles,
    page,
  }) => {
    await softwareTitles.goto();
    await softwareTitles.filter.applyVulnerable();
    await expect(page).toHaveURL(/vulnerable=true/);

    const rows = softwareTitles.table.table.locator('tbody tr');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await expectRowHasVulnData(page, rows.nth(i));
    }

    const multiRow = await softwareTitles.table.findRowByColumnPattern('Vulnerabilities', /^\d+ vulnerabilities$/);
    if (multiRow) {
      await assertVulnTooltip(page, multiRow);
    }

    const singleRow = await softwareTitles.table.findRowByColumnPattern('Vulnerabilities', /^CVE-\d{4}-\d+$/);
    if (singleRow) {
      await expectSingleCve(page, singleRow);
    }

    if (await softwareTitles.pagination.nextIfEnabled(softwareTitles.table)) {
      await softwareTitles.pagination.nextIfEnabled(softwareTitles.table);
      await softwareTitles.pagination.previousIfEnabled(softwareTitles.table);
    }
  });

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
      await cveDetail.assertOk(cveText, { clickNvdLink: osKey === 'macos' });
    });
  }

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
    await expect(vulnerabilitiesList.table.firstRowPrimaryLink).toHaveText(cveName, { useInnerText: true });

    const clickedCve = await vulnerabilitiesList.clickFirstCve();
    expect(clickedCve).toBe(cveName);

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    await cveDetail.assertOk(cveName);
  });

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
});
