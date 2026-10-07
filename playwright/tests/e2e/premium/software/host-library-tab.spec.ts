/**
 * Premium • Software • A host's Library tab, read on each real VM.
 *
 * Host details → Software → Library on the macOS, Windows and Linux VMs: the card
 * is the Library's ("Software available to be installed on this host"), its
 * "N items" is what Fleet offers that host, and **Add software** opens the Add
 * software page for the host's fleet on the tab that suits the host's platform:
 * Fleet-maintained for macOS and Windows, Custom package for Linux
 * (`HostSoftwareLibrary.tsx`, `onAddSoftware`). Nothing is added: the test stops
 * on the page Add software opens.
 *
 * **Why the real VMs.** They sit on the VMs fleet, whose Library holds software
 * for all three platforms, so the routing is read on one fleet for each platform
 * branch. Read-only: no VM time.
 *
 * **The count moves under other specs.** Per-run `fleet-pw-*` packages come and go
 * on the VMs fleet while the suite runs, so the item count is compared with the
 * API's in pairs read seconds apart, reloading until a pair agrees.
 *
 * What the Library's rows offer (Install, Update, Uninstall, Run) is covered where
 * it's acted on: the lifecycle, update, uninstall, inventory and script-only
 * package specs. The free tier has no Library tab (`free/hosts/host-software-tab`).
 * Round 1 C5 #13 (round 3, batch G).
 */
import { test, expect } from '@fixtures';
import { countHostLibraryTitles, requireRealHost } from '@helpers/api';

const ROUTES = [
  { platform: 'darwin', tab: 'Fleet-maintained', path: '/software/add/fleet-maintained' },
  { platform: 'windows', tab: 'Fleet-maintained', path: '/software/add/fleet-maintained' },
  { platform: 'linux', tab: 'Custom package', path: '/software/add/package' },
] as const;

const itemsText = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

test.describe("Premium • Software • a host's Library tab", () => {
  for (const route of ROUTES) {
    test(`on the ${route.platform} VM, counts what it offers and adds software on the ${route.tab} tab`, async ({
      hostDetails,
      fleetMaintainedApps,
      softwareCustomPackage,
      vmsFleetId,
      request,
      page,
    }) => {
      const host = await requireRealHost(request, route.platform);
      expect(host.fleetId, `${host.displayName} is not on the VMs fleet`).toBe(vmsFleetId);
      const library = hostDetails.library;

      await hostDetails.goto(host.id);
      await hostDetails.openLibraryTab();
      await expect(library.subheader).toBeVisible();

      await expect(async () => {
        await page.reload();
        await expect(library.itemCount).toBeVisible();
        const offered = await countHostLibraryTitles(request, host.id);
        expect(offered, `the VMs fleet offers ${host.displayName} nothing`).toBeGreaterThan(0);
        await expect(library.itemCount).toHaveText(itemsText(offered), { timeout: 1_000 });
      }).toPass({ timeout: 60_000 });

      await library.addSoftwareButton.click();
      await expect(page).toHaveURL(new RegExp(`${route.path}\\?fleet_id=${vmsFleetId}(&|$)`));
      const tab = route.tab === 'Fleet-maintained' ? fleetMaintainedApps.tab : softwareCustomPackage.customPackageTab;
      await expect(tab).toHaveAttribute('aria-selected', 'true');
    });
  }
});
