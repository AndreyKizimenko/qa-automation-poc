/**
 * Shared • Hosts • My device: the end user's own page for a host, reached through the admin's link.
 *
 * Host details' User card has a *My device* button for a global admin. It opens the host's My device page in a
 * new window, with the device token in its URL, and records that the admin asked for it
 * (`retrieved_host_my_device_url`). It is the page Fleet Desktop opens for the end user, so this spec drives
 * the parts every tier has:
 *
 *   - **The link** lands on the page's Details tab, and the activity names the host.
 *   - **Details** shows this host's vitals: the page names no host (its heading is "My device" for every
 *     host), so it is told apart by the private IP and MAC address Host details shows for the same host.
 *   - **Software** is the host's inventory: fleetd's own package is on it.
 *   - **Refetch** collects the host's vitals again, and the page says so while it does.
 *
 * Premium's tabs (Self service, Policies) are `premium/software/self-service-on-host.spec.ts`'s and
 * `premium/hosts/my-device-policies.spec.ts`'s. Which tabs each tier shows, and the page opening on every OS
 * version the lab has, are the per-OS smokes' (`smoke.myDevice` in `helpers/os-smokes.ts`).
 *
 * **On the worker's Linux pool VM**, a real host with Fleet Desktop: the button shows only for a host that
 * reports Fleet Desktop's version (`canShowMyDeviceButton`), which no simulation does. Nothing here changes
 * the host; the refetch is one any page load could ask for.
 *
 * Grounded in: `HostDetailsPage.tsx` and `HostDetailsPage/helpers.ts` (the button and when it shows),
 * `server/service/hosts.go` (the device URL and its activity), `DeviceUserPage.tsx` (the tabs, where the link
 * lands) and `HostHeader.tsx` (Refetch and its "Refetching..." text).
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  assertActivityAfter,
  getHostCollectedAt,
  latestActivityId,
  requireRealHost,
  waitForHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';

/** fleetd's own package on the Linux pool VMs (`fleet-osquery`, a `.deb`). */
const FLEETD_PACKAGE = { name: 'fleet-osquery', type: 'Package (deb)' };

test.describe('Shared • Hosts • My device', () => {
  // Opening the page, and on the refetch's test a host collection (70–120 s on a VM).
  test.describe.configure({ timeout: 300_000, retries: HOST_RETRIES });

  test("the admin's link opens the host's My device page on its Details, with its vitals", { tag: '@vm-linux' }, async ({
    hostDetails,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const before = await latestActivityId(request);

    await hostDetails.goto(host.id);
    const ip = (await hostDetails.vitals.value('Private IP address').innerText()).trim();
    const mac = (await hostDetails.vitals.value('MAC address').innerText()).trim();
    const device = await hostDetails.openMyDevice();
    await device.expectLoaded();
    await expect(device.page).toHaveURL(/\/device\/[^/]+$/);

    await test.step('Details: the vitals are this host’s', async () => {
      await expect(device.vitals.value('Private IP address')).toHaveText(ip);
      await expect(device.vitals.value('MAC address')).toHaveText(mac);
    });

    await test.step('the activity says the admin asked for this host’s link', () =>
      assertActivityAfter(request, 'retrieved_host_my_device_url', before, (d) => d.host_id === host.id),
    );
  });

  test("its Software tab lists the host's inventory", { tag: '@vm-linux' }, async ({ hostDetails, request }) => {
    const host = await requireRealHost(request, 'linux');
    await hostDetails.goto(host.id);
    const device = await hostDetails.openMyDevice();
    await device.expectLoaded();

    const row = await device.findInSoftware(FLEETD_PACKAGE.name);
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: FLEETD_PACKAGE.type, exact: true })).toBeVisible();
  });

  test('Refetch collects the host’s vitals again, and the page says so meanwhile', { tag: '@vm-linux' }, async ({
    hostDetails,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    // One already under way would land first and leave nothing to tell this one by.
    await waitForNoPendingRefetch(request, host.id);
    const since = await getHostCollectedAt(request, host.id, 'detail_updated_at');

    await hostDetails.goto(host.id);
    const device = await hostDetails.openMyDevice();
    await device.expectLoaded();
    await expect(device.lastFetched).toBeVisible();

    await device.refetchButton.click();
    await expect(device.refetching).toBeVisible();
    await waitForHostRefetch(request, host.id, { since });
    // The page polls the host every 2 s while it waits, for up to 3 minutes.
    await expect(device.lastFetched).toBeVisible({ timeout: 180_000 });
    await expect(device.refetchButton).toBeEnabled();
  });
});
