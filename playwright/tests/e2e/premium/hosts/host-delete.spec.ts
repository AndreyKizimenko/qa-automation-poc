/**
 * Premium • Hosts • Deleting hosts. C1 #11, C2 #12.
 *
 * Destructive, so it only ever touches **simulated** hosts — `findSimulatedHostIds`
 * cannot return a real VM, and the platform is pinned to macOS/Windows because
 * the real Linux VMs are not MDM-enrolled and so fall inside the simulated set.
 * The pool offsets are kept distinct from the transfer specs' so two mutating
 * specs can't be handed the same host under `fullyParallel`.
 *
 * The bulk case stages its hosts into Workstations first: the fleet then holds
 * exactly this test's hosts, so "select all on this page" can only act on them.
 * Without that, select-all would take a full 50-host page of the load fleet.
 *
 * No teardown restores the hosts — that's the point of the test. A deleted
 * simulation does **not** come back on its own: osquery-perf enrolls once at
 * startup and has no node-invalid recovery, so Fleet's delete-modal promise that
 * hosts "will re-appear unless Fleet's agent is uninstalled" holds for real
 * fleetd but not for the load fleet. The pool is instead repopulated by the
 * scheduled daily refresh in `tools/perf-hosts/`, which is why these tests
 * delete a small, fixed number of hosts (4 across the file) rather than scaling
 * with the pool.
 */
import { test, expect } from '@fixtures';
import { HostDetailsPage } from '@pages';
import { withStaticUser } from '@helpers/auth';
import { findSimulatedHostIds, hostExists, transferHosts } from '@helpers/api';

test.describe('Premium • Hosts • bulk delete', () => {
  test('deletes the selected hosts', async ({ hostsList, workstationsFleetId, request }) => {
    const hosts = await findSimulatedHostIds(request, 'darwin', 2, 10);
    expect(hosts, 'expected simulated macOS hosts to delete').toHaveLength(2);
    const hostIds = hosts.map((h) => h.id);

    await transferHosts(request, workstationsFleetId, hostIds);

    await hostsList.goto({ fleetId: workstationsFleetId });
    await hostsList.teamDropdown.select('Workstations');
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    await hostsList.selectAllOnPage();
    await expect(hostsList.selectedCount).toHaveText('2 selected');

    await hostsList.deleteSelectedButton.click();
    await expect(hostsList.deleteModal).toBeVisible();
    await expect(hostsList.deleteModal).toContainText('This will remove 2 hosts');

    await hostsList.confirmDelete();

    await hostsList.toast.expectSuccess('Hosts successfully deleted.');
    await expect(hostsList.table.table.locator('tbody').getByRole('row')).toHaveCount(0);

    for (const id of hostIds) {
      expect(await hostExists(request, id), `host ${id} should be deleted`).toBe(false);
    }
  });
});

test.describe('Premium • Hosts • delete by role', () => {
  test('a team admin can delete a host on a fleet they administer', async ({
    browser,
    vmsFleetId,
    request,
  }) => {
    const [host] = await findSimulatedHostIds(request, 'darwin', 1, 20);
    expect(host, 'expected a simulated macOS host to delete').toBeDefined();

    // A team admin only sees hosts on their own fleets, so the host is staged
    // onto one before they can act on it. VMs rather than Workstations, because
    // the bulk-delete case above stages there and the two run in parallel.
    await transferHosts(request, vmsFleetId, [host.id]);

    await withStaticUser(browser, 'team-admin', async (page) => {
      const hostDetails = new HostDetailsPage(page);

      await hostDetails.goto(host.id);
      await hostDetails.runAction('Delete');
      await expect(hostDetails.deleteModal).toBeVisible();
      await hostDetails.confirmDelete();

      await hostDetails.toast.expectSuccess(
        `Host "${host.displayName}" was successfully deleted.`,
      );
    });

    expect(await hostExists(request, host.id), 'host should be deleted').toBe(false);
  });
});

test.describe('Premium • Hosts • delete from host details', () => {
  test('deletes the host and returns to the hosts list', async ({
    hostsList,
    hostDetails,
    request,
  }) => {
    const [host] = await findSimulatedHostIds(request, 'windows', 1, 10);
    expect(host, 'expected a simulated Windows host to delete').toBeDefined();

    await hostDetails.goto(host.id);
    await hostDetails.runAction('Delete');

    await expect(hostDetails.deleteModal).toBeVisible();
    await expect(hostDetails.deleteModal).toContainText(`This will remove ${host.displayName}`);

    await hostDetails.confirmDelete();

    await hostDetails.toast.expectSuccess(
      `Host "${host.displayName}" was successfully deleted.`,
    );
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    expect(await hostExists(request, host.id), 'host should be deleted').toBe(false);
  });
});
