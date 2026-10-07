/**
 * Free • Hosts • A host's Software tab has no Library.
 *
 * Premium splits a host's Software tab into Inventory and Library, the installers
 * the host is offered (`HostDetailsPage.tsx`, `showSoftwareLibraryTab =
 * isPremiumTier`). Free installs nothing, so its Software tab is the inventory
 * alone, with neither sub-tab. The inventory's search box is the check that the
 * tab rendered before the absences are read.
 *
 * Any online host shows it; a simulation is used, so no real VM is involved.
 * The premium side is `premium/software/host-library-tab`.
 */
import { test, expect } from '@fixtures';
import { findOnlineHost } from '@helpers/api';

test("a host's Software tab is its inventory alone, with no Library", async ({ hostDetails, request }) => {
  const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
  expect(host, 'an online Linux simulation').toBeTruthy();

  await hostDetails.goto(host!.id);
  await hostDetails.openSoftwareTab();
  await expect(hostDetails.softwareSearch).toBeVisible();
  await expect(hostDetails.libraryTab).toHaveCount(0);
  await expect(hostDetails.inventoryTab).toHaveCount(0);
});
