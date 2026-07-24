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

  const name = await hostDetails.firstSoftwareName();
  expect(name.length).toBeGreaterThan(0);
  const token = firstToken(name);

  // Search narrows the host's software table to a matching row (retrying
  // locator absorbs the keepPreviousData refetch).
  await hostDetails.searchSoftware(token);
  await expect(hostDetails.table.rowWith(token)).toBeVisible();

  // Drill the first matching software → its title → filtered hosts list.
  await hostDetails.clickFirstSoftware();
  await expect(softwareTitleDetail.displayHeading).toBeVisible();
  const titleName = await softwareTitleDetail.displayName();

  await softwareTitleDetail.viewHosts();
  await expect(hostsList.filterPill).toBeVisible();
  await expect(hostsList.filterPill).toContainText(firstToken(titleName));
});
