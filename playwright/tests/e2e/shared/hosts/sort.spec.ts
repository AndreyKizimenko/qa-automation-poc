/**
 * Shared • Hosts • Sorting.
 *
 * A column header sorts the hosts list on the server. Fleet's table sorts a
 * column ascending on its first click and flips it on every click after (it
 * never clears a sort), and writes the sort into `order_key` /
 * `order_direction`, which a reload restores. Host is the default sort
 * (ascending), so its first click goes to descending.
 *
 * The rows sorted are a throwaway manual label's, not the whole list. On both
 * instances each platform's ~200 simulations report one OS version, so the
 * first page of the whole list sorted by Operating system is a single value in
 * either direction, and an order check there passes whatever the sort does. The
 * label holds hosts with **different** values: one macOS and one Windows
 * simulation, and up to four Linux ones on different Ubuntu releases (the
 * Linux simulations report about 25). With no ties, every sort has exactly one
 * right order, so the test compares the whole row order rather than checking
 * neighbours. Ties are also what fleetdm/fleet#55845 is about (hosts repeated
 * across pages), which a label this small never reaches.
 *
 * The expected order is computed with the comparison MySQL's utf8mb4_unicode_ci
 * collation makes, which is case-insensitive. For OS versions (letters, digits,
 * spaces, dots) lower-cased code-unit order agrees with it. For host names, which
 * carry `_`, `-` and `.`, `Intl.Collator('en', { sensitivity: 'base' })` does,
 * where code-unit order would put `_` after the digits. Both matched the API's
 * own order over every Unassigned host on both instances (~600 each) when this
 * spec was written.
 *
 * The hosts are simulations on their own slices of `findSimulations` (darwin 7,
 * windows 3, linux 20–29), only read, never a real VM: on free the VMs sit in the
 * same global scope a label does. The label is deleted in an `afterEach`, which
 * runs even when the test times out; on free nothing sweeps `pw-*` labels.
 *
 * Grounded in frontend/pages/hosts/ManageHostsPage/HostTableConfig.tsx (the
 * columns, their `id`s and the raw `os_version` cell) and
 * components/TableContainer/DataTable/DataTable.tsx (`disableSortRemove`).
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@fixtures';
import { createManualLabel, deleteLabelById, findSimulations, getHostSummary, type HostSummary } from '@helpers/api';

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' });
const byHostName = (a: HostSummary, b: HostSummary) => nameCollator.compare(a.displayName, b.displayName);
const byOsVersion = (a: HostSummary, b: HostSummary) => {
  const x = a.osVersion.toLowerCase();
  const y = b.osVersion.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};
const names = (hosts: HostSummary[]) => hosts.map((h) => h.displayName);

/**
 * One macOS, one Windows and up to four Linux simulations, no two on the same
 * OS version, labelled under `labelName`.
 */
async function labelOfDistinctOsVersions(
  request: APIRequestContext,
  labelName: string,
): Promise<{ labelId: number; hosts: HostSummary[] }> {
  const ids = [
    ...(await findSimulations(request, 'darwin', 1, 7)),
    ...(await findSimulations(request, 'windows', 1, 3)),
    ...(await findSimulations(request, 'linux', 10, 20)),
  ];
  const byVersion = new Map<string, HostSummary>();
  for (const id of ids) {
    const host = await getHostSummary(request, id);
    const key = host.osVersion.toLowerCase();
    const linuxCount = [...byVersion.values()].filter((h) => /ubuntu/i.test(h.osVersion)).length;
    if (byVersion.has(key) || (/ubuntu/i.test(host.osVersion) && linuxCount >= 4)) continue;
    byVersion.set(key, host);
  }
  const hosts = [...byVersion.values()];
  expect(hosts.length, `only ${hosts.length} distinct OS versions among the simulations ${ids.join(', ')}`).toBeGreaterThanOrEqual(4);
  return { labelId: await createManualLabel(request, labelName, hosts.map((h) => h.id)), hosts };
}

test.describe('Hosts • Sorting', () => {
  let labelId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (labelId !== undefined) await deleteLabelById(request, labelId);
    labelId = undefined;
  });

  test('Hosts — sorting by Operating system orders the rows by OS version both ways, and a reload keeps it', async ({
    hostsList,
    request,
    page,
  }) => {
    const labelName = `pw-hosts-sort-os-${Date.now()}`;
    const fixture = await labelOfDistinctOsVersions(request, labelName);
    labelId = fixture.labelId;
    const ascending = names([...fixture.hosts].sort(byOsVersion));

    await hostsList.goto();
    await hostsList.teamDropdown.select('All fleets');
    await hostsList.labelFilter.selectLabel(labelName);

    await hostsList.sortBy('Operating system', 'os_version', 'asc');
    await expect.poll(() => hostsList.hostNames()).toEqual(ascending);

    await hostsList.sortBy('Operating system', 'os_version', 'desc');
    await expect.poll(() => hostsList.hostNames()).toEqual([...ascending].reverse());

    await page.reload();
    await expect(hostsList.hostLink(ascending[0])).toBeVisible();
    const params = new URL(page.url()).searchParams;
    expect([params.get('order_key'), params.get('order_direction')]).toEqual(['os_version', 'desc']);
    await expect.poll(() => hostsList.hostNames()).toEqual([...ascending].reverse());
  });

  test('Hosts — sorting by Host orders the rows by host name, descending, then back to ascending', async ({
    hostsList,
    request,
  }) => {
    const labelName = `pw-hosts-sort-name-${Date.now()}`;
    const fixture = await labelOfDistinctOsVersions(request, labelName);
    labelId = fixture.labelId;
    const ascending = names([...fixture.hosts].sort(byHostName));

    await hostsList.goto();
    await hostsList.teamDropdown.select('All fleets');
    await hostsList.labelFilter.selectLabel(labelName);

    // Host name, ascending, is the list's default sort.
    await expect.poll(() => hostsList.hostNames()).toEqual(ascending);

    await hostsList.sortBy('Host', 'display_name', 'desc');
    await expect.poll(() => hostsList.hostNames()).toEqual([...ascending].reverse());

    await hostsList.sortBy('Host', 'display_name', 'asc');
    await expect.poll(() => hostsList.hostNames()).toEqual(ascending);
  });
});
