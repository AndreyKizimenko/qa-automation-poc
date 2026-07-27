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
 * "Select all matching hosts" is deliberately only ever *observed*, never
 * clicked: it widens the selection to every matching host, which on Unassigned
 * is the entire load fleet that sibling specs are reading.
 *
 * The suite runs fully parallel, so only the first test here stages hosts at
 * all; the other two work off an unstaged Unassigned selection and mutate
 * nothing. Sibling specs that do mutate hosts should claim a different
 * platform's simulations (see `findSimulatedHostIds`) so the pools can't overlap.
 */
import { test, expect } from '@fixtures';
import { findSimulatedHostIds, getHostFleetId, transferHosts } from '@helpers/api';

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
});
