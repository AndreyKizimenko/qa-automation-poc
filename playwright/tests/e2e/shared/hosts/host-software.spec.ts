/**
 * Shared • Hosts • Host software tab.
 *
 * On a host's Software tab: searching by name filters the table, and drilling a
 * software title → clicking its "Hosts" count lands on the hosts list filtered
 * by that software (the filter pill names it). Host-independent — offline hosts
 * keep their last-reported software inventory — and tier-agnostic → shared. The
 * host is chosen via the API (first host reporting software) so the test never
 * depends on a fragile "first host" pick.
 */
import { test, expect } from '@fixtures';
import { findHostWithSoftware } from '@helpers/api';

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

  const names = await hostDetails.softwareNames();
  expect(names.length, 'expected the host to list software titles').toBeGreaterThan(0);

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
