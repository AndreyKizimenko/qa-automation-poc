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
  findRenderableCve,
  hostVulnerableVersions,
  type HostRef,
  type SoftwareTitleRef,
} from '@helpers/api';
import { fleetIdFromUrl } from '@helpers/team-scope';
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
    request,
  }) => {
    test.skip(!softwareByOS[osKey], `No ${OS_LABELS[osKey]} software found`);
    const ref = softwareByOS[osKey]!;

    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
    await softwareTitles.filter.applyVulnerable();
    await softwareTitles.searchByName(ref.name);
    await softwareTitles.clickSoftwareTitle(ref.name);

    await softwareTitleDetail.waitForReady();
    await softwareTitleDetail.clickFirstVersionWithVulnerabilities();

    await softwareVersionDetail.waitForReady();
    // Fleet links every CVE it has matched to this version, but 404s the
    // detail page for any the vulnerability feeds carry no metadata for yet,
    // and the newest match sorts to the top (fleetdm/fleet#49913). Drill into
    // one the detail endpoint can serve, so this covers the click-through
    // rather than racing NVD enrichment.
    const cveText = await findRenderableCve(
      request,
      await softwareVersionDetail.cveNames(),
      fleetIdFromUrl(page.url()),
    );
    test.skip(
      !cveText,
      'Every CVE on this version 404s its detail page — fleetdm/fleet#49913',
    );
    await softwareVersionDetail.clickCve(cveText!);

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    await cveDetail.assertOk(cveText!, { clickNvdLink: osKey === 'macos' });
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
    request,
  }) => {
    test.skip(!hostByOS[osKey], `No ${OS_LABELS[osKey]} host with vulnerable software`);
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

    const softwareName = await hostDetails.clickFirstSoftware();

    await softwareTitleDetail.waitForReady();
    // Follow the version this host has. The title page lists every version in
    // the fleet's scope, and a fleet-scoped list can still carry a version whose
    // hosts only passed through (a simulation a label-targeting spec borrowed
    // onto the fleet): its first vulnerable row isn't necessarily this host's.
    const [version] = await hostVulnerableVersions(request, host.id, softwareName);
    expect(version, `${host.displayName} should report a vulnerable version of ${softwareName}`).toBeDefined();
    await softwareTitleDetail.clickVersion(version);

    await softwareVersionDetail.waitForReady();
    // Fleet links every CVE it has matched to this version, but 404s the
    // detail page for any the vulnerability feeds carry no metadata for yet,
    // and the newest match sorts to the top (fleetdm/fleet#49913). Drill into
    // one the detail endpoint can serve, so this covers the click-through
    // rather than racing NVD enrichment.
    const cveText = await findRenderableCve(
      request,
      await softwareVersionDetail.cveNames(),
      fleetIdFromUrl(page.url()),
    );
    test.skip(
      !cveText,
      'Every CVE on this version 404s its detail page — fleetdm/fleet#49913',
    );
    await softwareVersionDetail.clickCve(cveText!);

    await expect(page).toHaveURL(/\/software\/vulnerabilities\/CVE-/);
    await cveDetail.assertOk(cveText!);
  });
}

/**
 * A CVE's "Vulnerable software" table hands off to the hosts running each
 * affected version. The count on the row and the count on the hosts list come
 * from different endpoints, so they can disagree — that agreement is the
 * assertion, together with the filter pill naming the version.
 *
 * The CVE is resolved through `findRenderableCve`, not read off the top of the
 * list: Fleet matches CVEs faster than its feeds enrich them and 404s the detail
 * page for any it has no metadata for, with the newest match sorting first
 * (fleetdm/fleet#49913).
 *
 * The source flow instead summed every row's host count and compared it to
 * "Affected hosts", paging each row's hosts list to do it. That sum is not a
 * contract — a host running two affected versions is counted once in the CVE
 * total and twice in the sum — so it is dropped rather than ported.
 */
test('Vulnerabilities — a CVE hands off to the hosts running each affected version', async ({
  softwareTitles,
  vulnerabilitiesList,
  cveDetail,
  hostsList,
  request,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoVulnerabilitiesTab();

  const listed = await vulnerabilitiesList.cveNames();
  const cve = await findRenderableCve(request, listed, fleetIdFromUrl(page.url()));
  test.skip(!cve, 'No listed CVE has a renderable detail page — fleetdm/fleet#49913');

  await cveDetail.goto(cve!);
  await expect(cveDetail.vulnerableSoftwareHeading).toBeVisible();
  await expect(cveDetail.table.firstRow).toBeVisible();

  // Affected hosts is a real figure, not a placeholder — the table below lists
  // what makes it up.
  expect(await cveDetail.affectedHostCount()).toBeGreaterThan(0);

  const row = cveDetail.table.firstRow;
  const software = await cveDetail.softwareRowValues(row);
  expect(software.hosts, `expected "${software.name}" to report affected hosts`).toBeGreaterThan(0);

  await cveDetail.viewAllHostsFor(row);

  await expect(hostsList.filterPill).toBeVisible();
  await expect(hostsList.filterPill).toContainText(software.name);
  await expect(hostsList.filterPill).toContainText(software.version);
  await expect(page).toHaveURL(/software_version_id=\d+/);

  // The hand-off lands on a populated list. The two counts are read from the
  // shared host population seconds apart, and sibling specs delete and transfer
  // hosts while this runs, so they are not required to agree exactly — the
  // filter contract above is the behaviour, and a non-zero result is what
  // proves the version id resolved to real hosts.
  await expect.poll(() => hostsList.hostCount()).toBeGreaterThan(0);
});

/**
 * The vulnerable-software filter's severity dropdown, which is premium-only
 * (`SoftwareFiltersModal` renders it behind `isPremiumTier`). Fleet builds the
 * list from `SEVERITY_DROPDOWN_OPTIONS` — "Any" first, then the CVSS bands from
 * Critical down, then "Custom" — and each option carries its band as help text.
 * The whole list is asserted in order, because the ordering *is* the behaviour:
 * a band appearing out of sequence would still pass a membership check.
 *
 * Nothing is applied; the modal is cancelled, so the list underneath is left
 * unfiltered for whatever runs next.
 */
const SEVERITY_OPTIONS = [
  'Any severity CVSS score 0-10',
  'Critical severity CVSS score 9.0-10',
  'High severity CVSS score 7.0-8.9',
  'Medium severity CVSS score 4.0-6.9',
  'Low severity CVSS score 0.1-3.9',
  'Custom severity Custom CVSS score range',
];

test('Software Titles — the severity filter lists the CVSS bands from Critical down', async ({
  softwareTitles,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');

  await softwareTitles.filter.open();
  await expect(softwareTitles.filter.modal).toBeVisible();

  // The severity controls only become usable once the list is narrowed to
  // vulnerable software — Fleet passes `disabled={!vulnSoftwareFilterEnabled}`.
  await expect(softwareTitles.filter.severityTrigger).toHaveClass(/is-disabled/);
  await softwareTitles.filter.vulnerableSwitch.click();
  await expect(softwareTitles.filter.severityTrigger).not.toHaveClass(/is-disabled/);
  await expect(softwareTitles.filter.severityValue).toHaveText('Any severity');

  expect(await softwareTitles.filter.severityOptions()).toEqual(SEVERITY_OPTIONS);

  await softwareTitles.filter.cancel();
});
