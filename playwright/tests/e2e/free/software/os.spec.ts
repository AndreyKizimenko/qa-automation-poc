/**
 * Free • Software • OS tab. Free has no fleet dropdown, so the list is the one
 * global scope — otherwise the tab is the same component premium renders.
 *
 * Covers the two reads that cross a boundary: drilling an OS row into its
 * detail page (which is fed by a different endpoint, so the two views can
 * disagree) and the Hosts column's sort. The free sibling of
 * `premium/software/os.spec.ts` — kept as its own file rather than a shared one
 * with a tier conditional, because the premium variants select a fleet scope
 * first and free has none to select.
 */
import { test, expect } from '@fixtures';

/**
 * What the OS vulnerabilities table offers on free. `SoftwareVulnerabilitiesTableConfig`
 * drops `cvss_score`, `epss_probability` and `cve_published` off-premium, so the
 * three columns they back are premium-only and their absence is part of the
 * free contract.
 */
const FREE_COLUMNS = ['Vulnerability', 'Detected'] as const;
const PREMIUM_ONLY_COLUMNS = ['Severity', 'Probability of exploit', 'Published'] as const;

test('OS tab — a row drills into that OS with matching version and counts', async ({
  softwareTitles,
  softwareOs,
  softwareOsDetail,
}) => {
  await softwareTitles.goto();
  await softwareTitles.gotoOsTab();

  // Anchored on a row reporting vulnerabilities: Fleet writes "---" where it
  // has matched none, and those drill into an empty table, which would make the
  // count comparison vacuous.
  const row = await softwareOs.firstRowWithVulnerabilities();
  expect(row, 'expected an OS row reporting vulnerabilities').not.toBeNull();
  const listed = await softwareOs.rowValues(row!);

  await softwareOs.openOs(row!);

  // The detail page titles itself with name and version as one string. Windows
  // rows are named "Microsoft Windows …" in the list and lose the vendor prefix
  // in the heading, so both are normalized to the shared substring.
  await expect(softwareOsDetail.nameHeading).toContainText(
    listed.name.replace('Microsoft ', ''),
  );
  await expect(softwareOsDetail.nameHeading).toContainText(listed.version);

  await expect(softwareOsDetail.vulnerabilitiesHeading).toBeVisible();
  await softwareOsDetail.waitForReady();

  // The list row and the detail page are read seconds apart from a host population
  // that sibling specs delete from, so the two counts are not required to be equal.
  // Hosts only ever leave during a run — nothing enrols mid-run — so the detail
  // count being non-zero and no larger than the list's is the invariant that holds,
  // and a detail page showing a different OS would still break it.
  const detailHosts = await softwareOsDetail.hostCount();
  expect(detailHosts, `${listed.name} reports no hosts on its detail page`).toBeGreaterThan(0);
  expect(detailHosts).toBeLessThanOrEqual(listed.hosts);
  expect(await softwareOsDetail.vulnerabilityCount()).toBe(listed.vulnerabilities);

  for (const column of FREE_COLUMNS) {
    await expect(softwareOsDetail.columnHeader(column)).toBeVisible();
  }
  for (const column of PREMIUM_ONLY_COLUMNS) {
    await expect(softwareOsDetail.columnHeader(column)).toHaveCount(0);
  }
});

test('OS tab — sorting by Hosts reorders the list', async ({
  softwareTitles,
  softwareOs,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.gotoOsTab();

  await softwareOs.sortByHosts();
  await expect(page).toHaveURL(/order_key=hosts_count/);
  await expect(page).toHaveURL(/order_direction=asc/);
  // The list keeps the previous rows under a loading overlay for the whole
  // round trip, so the re-sorted order is only on screen once it clears.
  await softwareOs.table.waitForSettled();
  const ascending = await softwareOs.hostCounts();
  expect(ascending.length, 'expected the OS list to render rows').toBeGreaterThan(1);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await softwareOs.sortByHosts();
  await expect(page).toHaveURL(/order_direction=desc/);
  await softwareOs.table.waitForSettled();
  const descending = await softwareOs.hostCounts();
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
  // Only assert the two directions differ when the data can tell them apart: if
  // every OS reports the same host count, ascending and descending are legitimately
  // the same list and a difference check would fail on correct behaviour.
  if (Math.min(...ascending) !== Math.max(...ascending)) {
    expect(descending).not.toEqual(ascending);
  }
});
