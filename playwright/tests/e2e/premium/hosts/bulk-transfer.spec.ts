/**
 * Premium • Hosts • Bulk transfer between fleets. C1 #10/#12/#13(salvage)/#25.
 *
 * QA Wolf's original created two throwaway fleets and moved 50 hosts between
 * them. Reworked to the gitops model: no fleet is created or deleted, the hosts
 * are **simulated** ones (bulk work — the individual host is incidental, and a
 * real VM must never be shuffled around), and they're staged into the **QA**
 * fleet rather than Workstations because QA is the least-trafficked fleet and
 * cleanup doesn't touch it.
 *
 * The staging is the safety property: the fleet holds exactly this test's hosts,
 * so "select all on this page" can only ever act on them. The UI transfer back
 * to Unassigned *is* the restore, and the teardown re-asserts it via the API —
 * `cleanup.steps.ts` does not move hosts, so a leaked transfer would persist.
 *
 * "Select all matching hosts" widens the selection to every matching host,
 * which on Unassigned is the entire load fleet that sibling specs are reading,
 * so there it is only ever *observed*. It is clicked once, on a throwaway
 * `pw-transfer-*` fleet holding only the 51 offline simulations this spec staged
 * there (`findOfflineSimulations`: yesterday's abandoned set, which host expiry
 * deletes and nothing else touches), behind a request guard that lets the
 * transfer through only when its filter is that fleet. Deleting the fleet
 * returns anything left on it to Unassigned, so its `afterEach` doubles as the
 * hosts' restore, and the cleanup projects sweep a fleet a killed run left.
 *
 * Under a filter Fleet's server can't transfer by (policy, software, OS, low
 * disk space, vulnerability, MDM), Fleet withholds the button: the request
 * would carry the filter, the server would ignore it and move every host the
 * remaining filters match (`showMarkAllPages={!unsupportedFilter}` in
 * `ManageHostsPage.tsx`; the server reads only query, status, label and fleet).
 *
 * The suite runs fully parallel, so only the first and last tests here stage
 * hosts; the others work off an unstaged selection and mutate nothing. Sibling
 * specs that do mutate hosts should claim a different platform's simulations
 * (see `findSimulatedHostIds`) so the pools can't overlap.
 *
 * C1 #10 and #12 (round 3, batch C) are the withheld button and the transfer
 * by filter; C5 #10's "every listed host is on the selected fleet" is the first
 * test's Fleet column.
 */
import { test, expect } from '@fixtures';
import {
  createFleet,
  deleteFleet,
  findFleetByName,
  findOfflineSimulations,
  findSimulatedHostIds,
  getHostFleetId,
  listFleetHosts,
  transferHosts,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';

const HOST_COUNT = 3;

test.describe('Premium • Hosts • bulk transfer', () => {
  test('transfers the selected hosts to another fleet', async ({
    hostsList,
    qaFleetId,
    request,
  }) => {
    const hosts = await findSimulatedHostIds(request, 'darwin', HOST_COUNT);
    expect(hosts, 'expected simulated macOS hosts to stage').toHaveLength(HOST_COUNT);
    const hostIds = hosts.map((h) => h.id);

    await transferHosts(request, qaFleetId, hostIds);

    try {
      await hostsList.goto({ fleetId: qaFleetId });
      await hostsList.teamDropdown.selectByLabel('QA');
      await expect(hostsList.table.firstRowWithLink).toBeVisible();

      // The list under a fleet is that fleet's hosts: exactly the staged ones,
      // each with the fleet in its Fleet cell (matched by content, since the
      // column's index is read from a header that re-renders).
      const rows = hostsList.table.table.locator('tbody').getByRole('row');
      await expect(rows).toHaveCount(HOST_COUNT);
      for (const row of await rows.all()) {
        await expect(row.getByRole('cell', { name: 'QA', exact: true })).toBeVisible();
      }

      await hostsList.selectAllOnPage();
      await expect(hostsList.selectedCount).toHaveText(`${HOST_COUNT} selected`);

      // Only a full page of selections offers widening past the page, and the
      // staged fleet holds far fewer than one page.
      await expect(hostsList.selectAllMatchingButton).toBeHidden();

      await hostsList.openTransferForSelection();
      await expect(hostsList.transferModal.transferButton).toBeDisabled();
      await expect(hostsList.transferModal.addFleetLink).toBeVisible();

      await hostsList.transferModal.transferTo('Unassigned');

      await hostsList.toast.expectSuccess('Hosts successfully removed');

      // The fleet the hosts left is now empty, and Fleet agrees they are unassigned.
      await expect(hostsList.table.table.locator('tbody').getByRole('row')).toHaveCount(0);
      for (const id of hostIds) {
        expect(await getHostFleetId(request, id)).toBeNull();
      }
    } finally {
      await transferHosts(request, null, hostIds);
    }
  });

  test('fleet dropdown filters to a single match as you type', async ({ hostsList }) => {
    // Needs a selection to raise the modal, but not a staged one — the dropdown's
    // contents don't depend on which hosts are selected. Opening the modal from
    // Unassigned mutates nothing, since the test never submits the transfer.
    await hostsList.goto({ fleetId: 0 });
    await hostsList.teamDropdown.select('Unassigned');
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    await hostsList.selectAllOnPage();
    await hostsList.openTransferForSelection();

    await hostsList.transferModal.searchFleet('Workstations');

    await expect(hostsList.transferModal.fleetOptions).toHaveCount(1);
    await expect(hostsList.transferModal.fleetOptions).toHaveText('Workstations');
  });

  test('a full page of selections offers to widen past the page', async ({ hostsList }) => {
    // Unassigned holds the whole load fleet, so the first page fills and the
    // widening affordance appears. Observed only — never clicked.
    await hostsList.goto({ fleetId: 0 });
    await hostsList.teamDropdown.select('Unassigned');
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    await hostsList.selectAllOnPage();

    await expect(hostsList.selectionBar).toContainText('All hosts on this page are selected');
    await expect(hostsList.selectAllMatchingButton).toBeVisible();

    await hostsList.clearSelectionButton.click();
    await expect(hostsList.selectionBar).toBeHidden();
  });

  test('a filter the server cannot transfer by withholds "Select all matching hosts"', async ({
    dashboard,
    hostsList,
  }) => {
    // QA Wolf's filter: the dashboard's Low disk space card. It matches
    // hundreds of hosts, so a full page fills and the button would otherwise show.
    await dashboard.goto();
    await dashboard.hostCountCard('Low disk space hosts').click();
    await expect(hostsList.filterPill).toHaveAccessibleName('hosts filtered by Low disk space');
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    await hostsList.selectAllOnPage();
    await expect(hostsList.selectionBar).toContainText('All hosts on this page are selected');
    await expect(hostsList.selectedCount).toHaveText('50 selected');
    await expect(hostsList.selectAllMatchingButton).toHaveCount(0);
  });
});

test.describe('Premium • Hosts • transfer every matching host', () => {
  // One more than a page, so "all matching" and "this page" differ by a host.
  const STAGED = 51;
  const fleetName = `pw-transfer-${runNonce()}`;

  // A timed-out test skips its `finally`; this still runs. Deleting the fleet
  // returns whatever is left on it to Unassigned.
  test.afterEach(async ({ request }) => {
    const fleet = await findFleetByName(request, fleetName);
    if (fleet) await deleteFleet(request, fleet.id, { ignoreMissing: true });
  });

  test('"Select all matching hosts" transfers every host the filter matches, not just the page', async ({
    hostsList,
    request,
    page,
  }) => {
    const hosts = await findOfflineSimulations(request, 'linux', STAGED);
    expect(
      hosts,
      `${STAGED} offline Linux simulations on Unassigned: the perf daemons' daily refresh leaves ~100 (tools/perf-hosts)`,
    ).toHaveLength(STAGED);

    const fleet = await createFleet(request, fleetName);
    await transferHosts(request, fleet.id, hosts);

    // The by-filter transfer may only ever name this fleet as its filter; any
    // other request is stopped before it reaches Fleet.
    const sent: Array<{ fleet_id: number | null; filters: Record<string, unknown> }> = [];
    let refused: string | undefined;
    await page.route('**/hosts/transfer/filter', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.filters?.fleet_id !== fleet.id) {
        refused = JSON.stringify(body);
        await route.abort();
        return;
      }
      sent.push(body);
      await route.continue();
    });

    try {
      await hostsList.goto({ fleetId: fleet.id });
      await hostsList.teamDropdown.selectByLabel(fleetName);
      await expect(hostsList.table.firstRowWithLink).toBeVisible();

      await hostsList.selectAllOnPage();
      await expect(hostsList.selectedCount).toHaveText('50 selected');
      await hostsList.selectAllMatchingButton.click();
      await expect(hostsList.selectionBar).toContainText('All matching hosts are selected');
      await expect(hostsList.selectedCount).toHaveText(`${STAGED} selected`);

      await hostsList.openTransferForSelection();
      await hostsList.transferModal.transferTo('Unassigned');
      await hostsList.toast.expectSuccess('Hosts successfully removed');

      expect(refused, 'a by-filter transfer not scoped to the staged fleet').toBeUndefined();
      expect(sent, 'one transfer by filter, to Unassigned').toHaveLength(1);
      expect(sent[0].fleet_id).toBeNull();

      // Every staged host left, the 51st included: a transfer of the selected
      // page alone would leave one behind.
      expect(await listFleetHosts(request, fleet.id)).toHaveLength(0);
      const unassigned = new Set((await listFleetHosts(request, 0, { status: 'offline' })).map((h) => h.id));
      expect(hosts.filter((id) => !unassigned.has(id)), 'staged hosts not back on Unassigned').toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await deleteFleet(request, fleet.id, { ignoreMissing: true });
    }
  });
});
