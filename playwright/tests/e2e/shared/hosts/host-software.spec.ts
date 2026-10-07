/**
 * Shared • Hosts • Host software tab.
 *
 * On a host's Software tab: searching by name filters the table, and drilling a
 * software title → clicking its "Hosts" count lands on the hosts list filtered
 * by that software (the filter pill names it). Host-independent — offline hosts
 * keep their last-reported software inventory — and tier-agnostic → shared. The
 * host is chosen via the API (first host reporting software) so the test never
 * depends on a fragile "first host" pick.
 *
 * The full inventory's columns and its paging are read on the way; not its cells, which a simulation leaves partly empty ("Last opened").
 *
 * The macOS `/Applications` view filter is covered separately at the bottom of
 * this file, and that one *does* need the real VM — see its own header.
 */
import { test, expect } from '@fixtures';
import { findHostWithSoftware } from '@helpers/api';

// The full inventory's columns (`HostSoftwareTableConfig`), Name first.
const INVENTORY_COLUMNS = ['Name', 'Installed version', 'Type', 'Last opened', 'Vulnerabilities', 'File path', 'Hash'];

// First alphanumeric word of length >= 3 — a stable search token derived from a
// software name (e.g. "Google Chrome.app" -> "Google").
const firstToken = (name: string): string =>
  name.split(/[^A-Za-z0-9]+/).find((t) => t.length >= 3) ?? name;

test('Hosts — software tab search filters, and a title links to filtered hosts', async ({
  hostDetails,
  softwareTitleDetail,
  hostsList,
  request,
}) => {
  const host = await findHostWithSoftware(request);
  expect(host, 'expected a host reporting software inventory').not.toBeNull();

  await hostDetails.goto(host!.id);
  await hostDetails.openSoftwareTab();
  await hostDetails.showFullInventory();

  // Retrying wait, not a one-shot read: switching to full inventory updates the
  // URL as soon as the option is picked, while the table only repaints when the
  // response lands, so reading names straight after it captures the previous
  // view's empty tbody. The host is API-chosen because it reports software, so
  // an empty table here is a real failure.
  await expect(hostDetails.softwareNameLinks.first()).toBeVisible();

  const names = await hostDetails.softwareNames();
  expect(names.length, 'expected the host to list software titles').toBeGreaterThan(0);

  // The full inventory's columns, and its paging: 20 titles a page, and a host
  // chosen for reporting software reports far more than that.
  for (const column of INVENTORY_COLUMNS) {
    await expect(hostDetails.softwareColumnHeader(column), `the ${column} column`).toBeVisible();
  }
  expect(await hostDetails.softwareItemCount(), 'more titles than one page holds').toBeGreaterThan(20);
  expect(names).toHaveLength(20);
  await hostDetails.turnSoftwarePage('Next');
  const secondPage = await hostDetails.softwareNames();
  expect(secondPage.filter((n) => names.includes(n)), 'titles on both pages').toEqual([]);
  await hostDetails.turnSoftwarePage('Previous');
  await expect.poll(() => hostDetails.softwareNames()).toEqual(names);

  const name = names[0];
  const token = firstToken(name);

  // A listed title the token cannot match. Asserting it disappears is what
  // proves the search reached the server and narrowed the table — the searched
  // title is on the page before the filter lands too, so its presence alone
  // would also hold against the unfiltered list.
  const filteredOut = names.find((n) => !n.toLowerCase().includes(token.toLowerCase()));
  expect(filteredOut, `expected a listed title not matching "${token}"`).toBeDefined();

  await hostDetails.searchSoftware(token);
  await expect(hostDetails.softwareNameLink(name)).toBeVisible();
  await expect(hostDetails.softwareNameLink(filteredOut!)).toHaveCount(0);

  // Drill the searched title → its title page → filtered hosts list.
  await hostDetails.softwareNameLink(name).click();
  await expect(softwareTitleDetail.displayHeading).toBeVisible();
  const titleName = await softwareTitleDetail.displayName();

  await softwareTitleDetail.viewHosts();
  await expect(hostsList.filterPill).toBeVisible();
  await expect(hostsList.filterPill).toContainText(firstToken(titleName));
});

/**
 * macOS hosts default the Software tab to "Applications" — top-level apps only
 * — and offer "Full inventory" to see every reported package
 * (`HostSoftwareTable.tsx`, `showApplicationsFilter`). The filter is platform-
 * gated, not tier-gated, so this runs on both tiers against the real macOS VM:
 * an osquery-perf simulation reports a synthetic inventory with no application
 * paths, which makes the narrowing meaningless.
 *
 * Asserted as set membership rather than on fixed titles. Both are searched for
 * explicitly in each view, so the result doesn't depend on which page of a
 * paginated inventory a title happens to land on.
 */
test('Hosts — the Applications view narrows the inventory to top-level applications', async ({
  hostDetails,
  liveMacosHost,
}) => {
  await hostDetails.goto(liveMacosHost.id);
  await hostDetails.openSoftwareTab();

  await expect(hostDetails.softwareViewValue).toHaveText('Applications');
  await expect(hostDetails.softwareNameLinks.first()).toBeVisible();

  const appCount = await hostDetails.softwareItemCount();
  const appNames = await hostDetails.softwareNames();
  expect(appNames.length, 'expected the VM to report a top-level application').toBeGreaterThan(0);
  const application = appNames[0];

  await hostDetails.selectSoftwareView('Full inventory');
  // The table keeps the previous view's rows under a loading overlay for the
  // whole round trip, so the count is polled rather than read once.
  await expect.poll(() => hostDetails.softwareItemCount()).toBeGreaterThan(appCount);

  const fullNames = await hostDetails.softwareNames();
  const packageOnly = fullNames.find((name) => !appNames.includes(name));
  expect(
    packageOnly,
    'expected the full inventory to list something the Applications view does not',
  ).toBeDefined();

  await hostDetails.searchSoftware(packageOnly!);
  await expect(hostDetails.softwareNameLink(packageOnly!)).toBeVisible();

  // The same search under the Applications view returns nothing: the entry is
  // reported by the host but is not a top-level application.
  await hostDetails.selectSoftwareView('Applications');
  await hostDetails.searchSoftware(packageOnly!);
  await expect(hostDetails.softwareTable.locator('.empty-state')).toBeVisible();
  await expect(hostDetails.softwareNameLink(packageOnly!)).toHaveCount(0);

  // An application still resolves there, so the empty result above is the
  // filter at work and not a broken search.
  await hostDetails.searchSoftware(application);
  await expect(hostDetails.softwareNameLink(application)).toBeVisible();
});
