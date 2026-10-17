/**
 * Shared • Hosts • Filters: the status filter inside a label, and search.
 *
 * Both run on the server, and both are judged on hosts this spec picks, never on
 * a count of the shared list:
 *
 *  - **Status within a label.** A throwaway manual label holds one online and
 *    one offline simulation, so each status leaves exactly one host, and All
 *    hosts brings both back. The label route (`/hosts/manage/labels/<id>`) and
 *    `status=` both have to survive a reload, which is how a user shares a
 *    filtered list. The online host is Linux slice 8 of `findSimulations` (read
 *    only); the offline one is the newest abandoned macOS simulation
 *    (`findOfflineSimulations`, darwin 1), which stays offline until host expiry
 *    deletes it a day later and which no other spec reads or moves. Simulations,
 *    never a real VM: on free the VMs sit in the same global scope a label does.
 *  - **Search.** Linux slice 9, found by its name and by its UUID (two of the
 *    fields Fleet searches; names are 12 random characters, so nothing else
 *    matches). The box trims what it sends, so leading spaces still find the
 *    host, and the search stays in `query=`, which a reload puts back in the
 *    box. A search that matches nothing shows the empty state.
 *
 * The Hosts list rewrites its URL just after it loads, which can undo a filter
 * chosen before then, so every choice goes through a page-object method that
 * repeats it until the URL holds it (`selectLabel`, `filterByStatus`,
 * `searchFor`, which is told the trimmed value to expect for the padded search).
 *
 * The label is deleted in an `afterEach`, which runs even when the test times
 * out; on free nothing sweeps `pw-*` labels. The scope is All fleets on premium
 * (a no-op on free), so the hosts are found wherever they are.
 *
 * Grounded in frontend/pages/hosts/ManageHostsPage/components/HostsFilterBlock
 * and server/datastore/mysql/hosts.go (`hostSearchColumns`, the status filters).
 */
import { test, expect } from '@fixtures';
import {
  createManualLabel,
  deleteLabelById,
  findOfflineSimulations,
  findSimulations,
  getHostDisplayName,
  getHostSummary,
} from '@helpers/api';

test.describe('Hosts • Filters', () => {
  let labelId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (labelId !== undefined) await deleteLabelById(request, labelId);
    labelId = undefined;
  });

  test('Hosts — the status filter narrows a label to its online or its offline host, and a reload keeps both filters', async ({
    hostsList,
    request,
    page,
  }) => {
    const [onlineId] = await findSimulations(request, 'linux', 1, 8);
    const [offlineId] = await findOfflineSimulations(request, 'darwin', 1);
    expect(onlineId, 'no online Linux simulation at slice 8').toBeDefined();
    expect(offlineId, 'no offline macOS simulation on Unassigned').toBeDefined();
    const online = await getHostDisplayName(request, onlineId);
    const offline = await getHostDisplayName(request, offlineId);
    const labelName = `pw-hosts-status-${Date.now()}`;
    labelId = await createManualLabel(request, labelName, [onlineId, offlineId]);

    await hostsList.goto();
    await hostsList.teamDropdown.select('All fleets');
    await hostsList.labelFilter.selectLabel(labelName);
    await hostsList.table.waitForSettled();
    await expect.poll(async () => (await hostsList.hostNames()).sort()).toEqual([online, offline].sort());

    await hostsList.filterByStatus('Online hosts');
    await expect.poll(() => hostsList.hostNames()).toEqual([online]);
    await expect.poll(() => hostsList.table.columnTexts('Status')).toEqual(['Online']);
    await expect.poll(() => hostsList.hostCount()).toBe(1);

    await hostsList.filterByStatus('Offline hosts');
    await expect.poll(() => hostsList.hostNames()).toEqual([offline]);
    await expect.poll(() => hostsList.table.columnTexts('Status')).toEqual(['Offline']);

    await page.reload();
    await expect(hostsList.hostLink(offline)).toBeVisible();
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/hosts/manage/labels/${labelId}`);
    expect(url.searchParams.get('status')).toBe('offline');
    await expect.poll(() => hostsList.hostNames()).toEqual([offline]);

    await hostsList.filterByStatus('All hosts');
    await expect.poll(async () => (await hostsList.hostNames()).sort()).toEqual([online, offline].sort());
  });

  test('Hosts — search finds a host by name or UUID, ignores leading spaces, survives a reload, and shows the empty state when nothing matches', async ({
    hostsList,
    request,
    page,
  }) => {
    const [hostId] = await findSimulations(request, 'linux', 1, 9);
    expect(hostId, 'no online Linux simulation at slice 9').toBeDefined();
    const { displayName: name, uuid } = await getHostSummary(request, hostId);

    await hostsList.goto();
    await hostsList.teamDropdown.select('All fleets');

    await hostsList.searchFor(name);
    await expect.poll(() => hostsList.hostNames()).toEqual([name]);

    await hostsList.searchFor(uuid);
    await expect.poll(() => hostsList.hostNames()).toEqual([name]);

    await hostsList.searchFor(`   ${name}`, name);
    await expect.poll(() => hostsList.hostNames()).toEqual([name]);

    await page.reload();
    await expect(hostsList.hostLink(name)).toBeVisible();
    await expect(hostsList.search).toHaveValue(name);
    await expect.poll(() => hostsList.hostNames()).toEqual([name]);

    await hostsList.searchFor(`pw-no-such-host-${Date.now()}`);
    await expect(hostsList.table.emptyState).toContainText('No hosts match your filters');
    await expect.poll(() => hostsList.hostCount()).toBe(0);
  });
});
