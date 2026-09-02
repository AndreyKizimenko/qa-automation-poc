/**
 * Software vulnerability flows on premium — list, version, CVE detail, and
 * host-level vulnerable software click-through.
 *
 * Scope: Unassigned only (the premium variant of a tier-agnostic flow;
 * a Workstations variant isn't included because vulnerability data is
 * surfaced from osquery hosts, not from team-scoped uploads).
 *
 * Every test here drives Fleet's `vulnerable=true` software-titles query, which
 * is by far the slowest the suite issues — 8-15s per page on the QA instances
 * against 0.5s unfiltered — and it degrades sharply when requests overlap: four
 * at once measured ~60s each. Under the project's `fullyParallel` these tests
 * would be split across workers and spend that cost on each other, so the file
 * runs in one worker. `default` rather than `serial` keeps them independent, so
 * one failure doesn't skip the rest.
 */
import { test, expect } from '@fixtures';
import type { Page } from '@playwright/test';
import type { SoftwareTitlesPage } from '@pages';
import {
  getApiToken,
  findHostByPlatform,
  findVulnerableSoftwareBySources,
  type HostRef,
  type SoftwareTitleRef,
} from '@helpers/api';
import { expectRowHasVulnData, expectSingleCve, assertVulnTooltip } from '@helpers/vuln';

test.describe.configure({ mode: 'default' });

// Even unopposed, a flow that applies the filter and turns three pages spends
// most of a minute waiting on the server, which is the whole project default.
test.beforeEach(() => {
  test.setTimeout(180_000);
});

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

let softwareByOS: Partial<Record<OsKey, SoftwareTitleRef>> = {};
const hostByOS: Partial<Record<OsKey, HostRef>> = {};

test.beforeAll(async () => {
  // findVulnerableSoftwareBySources walks up to five pages of `vulnerable=true`
  // sequentially, and that query costs 8-15s per page idle on the QA instance —
  // more when a sibling worker is on it. Sequential is deliberate (the query
  // degrades sharply under concurrency), so the budget has to cover the walk;
  // at the 60s hook default a slow instance takes down every test in the file.
  test.setTimeout(240_000);

  const baseURL = process.env.FLEET_URL!;
  const token = await getApiToken(baseURL);

  // Scoped to Unassigned, which is where every title-path test below navigates.
  softwareByOS = await findVulnerableSoftwareBySources(baseURL, token, OS_SOURCES, {
    fleetId: 0,
  });

  const [macHost, linuxHost, winHost] = await Promise.all([
    findHostByPlatform(baseURL, token, 'darwin'),
    findHostByPlatform(baseURL, token, 'linux'),
    findHostByPlatform(baseURL, token, 'windows'),
  ]);

  if (macHost) hostByOS.macos = macHost;
  if (linuxHost) hostByOS.deb = linuxHost;
  if (winHost) hostByOS.windows = winHost;
});

/** Opens the vulnerable-filtered title list for Unassigned. */
async function openVulnerableTitles(
  softwareTitles: SoftwareTitlesPage,
  page: Page,
): Promise<void> {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.filter.applyVulnerable();
  await expect(page).toHaveURL(/vulnerable=true/);
}

// Fleet's `vulnerable=true` filter is not fleet-scoped: a title whose only
// vulnerable version lives on a host in another fleet is still listed here, and
// renders "---" in the Vulnerabilities column because the payload carries no
// CVEs for this scope. `fuse3` does exactly that on the premium QA instance, so
// the every-row assertion fails deterministically. Tracked in
// docs/blocked-by-product-bugs.md. The free counterpart of this assertion still
// runs — free has a single scope, so the leak can't occur there.
// TODO(fleetdm/fleet#50059): remove once the filter respects the fleet scope.
// eslint-disable-next-line playwright/no-skipped-test -- tracked in docs/blocked-by-product-bugs.md
test.skip(
  'Software Titles — every vulnerable-filtered row reports vulnerability data',
  {
    annotation: {
      type: 'blocked by product bug',
      description:
        'fleetdm/fleet#50059 — vulnerable=true is not fleet-scoped, so a title vulnerable only in another fleet renders "---"',
    },
  },
  async ({ softwareTitles, page }) => {
    await openVulnerableTitles(softwareTitles, page);

    const rows = softwareTitles.table.table.locator('tbody tr');
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await expectRowHasVulnData(page, rows.nth(i));
    }
  },
);

test('Software Titles — vulnerable filter, pagination, and column checks', async ({
  softwareTitles,
  page,
}) => {
  await openVulnerableTitles(softwareTitles, page);

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
    // The first vulnerable deb title on both QA instances is `accountsservice`,
    // whose newest CVEs (CVE-2026-61897/61898) are matched to host software but
    // absent from `cve_meta`; Fleet's premium CVE detail endpoint inner-joins
    // that table and 404s, so this variant deterministically lands on a
    // "Vulnerability not detected" page. Same product bug as the host-path deb
    // variant below. Tracked in docs/blocked-by-product-bugs.md.
    // TODO(fleetdm/fleet#49913): remove once the detail endpoint renders
    // matched-but-unenriched CVEs consistently with the vulnerabilities list.
    test.skip(osKey === 'deb', 'Blocked by fleetdm/fleet#49913 — CVE detail 404 for matched-but-unenriched CVE');
    const ref = softwareByOS[osKey]!;

    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
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

test('Vulnerabilities tab — search narrows to a single CVE', async ({
  softwareTitles,
  vulnerabilitiesList,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoVulnerabilitiesTab();

  // Searching a full CVE id (unique) must collapse the list to that one row.
  const cveName = await vulnerabilitiesList.firstCveName();
  await vulnerabilitiesList.search.fill(cveName);
  await expect(vulnerabilitiesList.table.table.locator('tbody tr')).toHaveCount(1);
  await expect(vulnerabilitiesList.table.firstRowPrimaryLink).toHaveText(cveName, {
    useInnerText: true,
  });
});

test('Vulnerabilities tab — exploited-vulnerabilities filter', async ({
  softwareTitles,
  vulnerabilitiesList,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoVulnerabilitiesTab();

  // Selecting the "Exploited" option drives the `exploit=true` query param and
  // re-fetches; the filtered list may be empty, so assert row-or-empty.
  await vulnerabilitiesList.selectExploitedFilter('Exploited vulnerabilities');
  await expect(page).toHaveURL(/exploit=true/);
  await expect(vulnerabilitiesList.table.rowOrEmpty()).toBeVisible();
});

test('Vulnerabilities tab — list, pagination, and CVE detail flow', async ({
  softwareTitles,
  vulnerabilitiesList,
  cveDetail,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
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
    // Fleet's CVE detail endpoint 404s for CVEs matched to host software but
    // absent from cve_meta (NVD metadata); the deb host's accountsservice
    // package carries such CVEs, so this variant deterministically lands on a
    // "Vulnerability not detected" detail page. Tracked in
    // docs/blocked-by-product-bugs.md.
    // TODO(fleetdm/fleet#49913): remove once the detail endpoint renders
    // matched-but-unenriched CVEs consistently with the vulnerabilities list.
    test.skip(osKey === 'deb', 'Blocked by fleetdm/fleet#49913 — CVE detail 404 for matched-but-unenriched CVE');
    const host = hostByOS[osKey]!;

    await hostDetails.goto(host.id);
    await hostDetails.openSoftwareTab();
    // macOS hosts default to the "Applications" view, which hides non-app
    // packages (most vulnerable items); switch to the full list.
    await hostDetails.showFullInventory();

    // Retrying waits, not `isVisible()` reads. The host is chosen via the API
    // *because* it reports vulnerable software, so an empty table here is a real
    // failure — and a one-shot `isVisible()` can catch the previous view's empty
    // state mid-refetch and skip the test on a false negative, which is how this
    // silently stopped covering anything.
    await expect(hostDetails.table.firstRow).toBeVisible();

    await hostDetails.applyVulnerableFilter();
    await expect(hostDetails.table.firstRow).toBeVisible();

    await hostDetails.clickFirstSoftware();

    await softwareTitleDetail.waitForReady();
    await softwareTitleDetail.clickFirstVersionWithVulnerabilities();

    await softwareVersionDetail.waitForReady();
    const cveText = await softwareVersionDetail.clickFirstCve();

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    await cveDetail.assertOk(cveText);
  });
}
