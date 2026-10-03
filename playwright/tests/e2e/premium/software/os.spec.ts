/**
 * Premium • Software • OS tab. Scope: Unassigned (all hosts on this instance
 * are unassigned; offline hosts keep their last-checkin OS records).
 *
 * Covers the OS-tab platform filter (narrows the list to a single platform),
 * the per-row "View all hosts" hand-off (lands on the Hosts list filtered by
 * that OS), the drill into a single OS's detail page, and the Hosts column's
 * sort. All are host-data reads — hosts keep their last-checkin OS records, so
 * none of this needs an online host.
 *
 * `free/software/os.spec.ts` is the free sibling of the last two.
 */
import { test, expect } from '@fixtures';

// macOS/Windows OS names embed the platform word, so a row-content check is
// deterministic. Linux is omitted here — its rows are distro-named (Ubuntu,
// Fedora, …), not "Linux".
const PLATFORMS = [
  { label: 'macOS', value: 'darwin', token: 'macOS' },
  { label: 'Windows', value: 'windows', token: 'Windows' },
] as const;

for (const { label, value, token } of PLATFORMS) {
  test(`OS tab — platform filter narrows the list to ${label}`, async ({
    softwareTitles,
    softwareOs,
    page,
  }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
    await softwareTitles.gotoOsTab();

    await softwareOs.selectPlatform(label);
    await expect(page).toHaveURL(new RegExp(`platform=${value}`));

    // The OS list keeps the previous rows while the filtered fetch is in
    // flight (react-query keepPreviousData), so assert on a retrying locator:
    // once settled, no row's Name lacks the platform word.
    const rows = softwareOs.table.table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasNotText: token })).toHaveCount(0);
  });
}

test('OS tab — "View all hosts" lands on the Hosts list filtered by that OS', async ({
  softwareTitles,
  softwareOs,
  hostsList,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoOsTab();

  // The OS row labels Windows as "Microsoft Windows …"; the Hosts filter pill
  // drops the "Microsoft " prefix (and appends a build number), so normalize
  // to the shared substring.
  const osName = (await softwareOs.firstOsName()).replace('Microsoft ', '');
  await softwareOs.viewHostsForFirstOs();

  await expect(hostsList.filterPill).toBeVisible();
  await expect(hostsList.filterPill).toContainText(osName);
});

/**
 * Columns the OS vulnerabilities table offers on premium. Three of them —
 * Severity, Probability of exploit and Published — are premium-only;
 * `free/software/os.spec.ts` asserts their absence.
 */
const VULNERABILITY_COLUMNS = [
  'Vulnerability',
  'Severity',
  'Probability of exploit',
  'Published',
  'Detected',
] as const;

/**
 * Drilling an OS row into its detail page. The two views are fed by different
 * endpoints, so this asserts they agree: the heading names the same OS and
 * version the row did, and the host and vulnerability totals match the row's.
 *
 * Anchored on a row that reports vulnerabilities — Fleet writes "---" for an OS
 * it has matched none to, and those drill into an empty table, which would make
 * the count comparison vacuous. Only macOS and Windows rows qualify: a Linux OS's
 * detail page lists its vulnerabilities per kernel, in a Kernels card, and has
 * none of the card this test asserts on.
 */
test('OS tab — a row drills into that OS with matching version and counts', async ({
  softwareTitles,
  softwareOs,
  softwareOsDetail,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoOsTab();

  const row = await softwareOs.firstNonLinuxRowWithVulnerabilities();
  // Data-availability guard: whether a macOS or Windows OS has matched any
  // vulnerabilities depends on the instance's vulnerability processing, which the
  // suite doesn't control.
  test.skip(row === null, 'no macOS or Windows OS reports vulnerabilities under Unassigned');
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

  for (const column of VULNERABILITY_COLUMNS) {
    await expect(softwareOsDetail.columnHeader(column)).toBeVisible();
  }
});

/**
 * "Hosts" is the OS table's only sortable column (`OSTableConfig.tsx` sets
 * `disableSortBy` on every other), and clicking it toggles direction. Asserted
 * on the rendered order rather than on the URL alone, so a param that changes
 * without the list following it still fails.
 */
test('OS tab — sorting by Hosts reorders the list', async ({
  softwareTitles,
  softwareOs,
  page,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
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
