/**
 * Premium • Software • Installing and uninstalling on a real host.
 *
 * One test per piece of software the VMs fleet keeps for it: install it from the
 * host's Library, follow it until the host reports it, then uninstall it and
 * follow that to the end. Each half is checked the same way — the Library row's
 * status, installed version and actions, the install or uninstall details, the
 * host's Past activity, and the host's own inventory.
 *
 * Premium only: installing software is a premium feature.
 *
 * **The software is durable.** Every subject is declared in
 * `gitops/premium-fleetqa/fleets/vms.yml` and never deleted, so Fleet always
 * knows whether it's installed. Its resting state is uninstalled: the test
 * leaves it that way, and the preflight in `setup/cleanup.steps.ts` uninstalls
 * one a dead run left installed before the next run starts. The list lives in
 * `helpers/vm-fixtures.ts`, shared with that preflight:
 *
 *   | row | software | installs |
 *   |---|---|---|
 *   | macOS `.pkg` | `fleet-playwright-install-1.0.0.pkg` (`make-pkg.sh`) | an empty app bundle in /Applications |
 *   | Windows `.msi` | `fleet-playwright-install-1.0.0.msi` (`make-msi.sh`) | one marker file under Program Files |
 *   | Windows `.exe` | 7-Zip's `7z2601-arm64.exe` | 7-Zip, into its own folder |
 *   | Linux `.deb` | `fleet-playwright-install_1.0.0_all.deb` (`make-deb.py`) | one marker file under /usr/share |
 *   | macOS Fleet-maintained | Itsycal | a menu-bar calendar, never launched |
 *   | Windows Fleet-maintained | DB Browser for SQLite | an MSI, no service, never launched |
 *
 * **The `.exe` is never linked to what Windows reports.** Fleet names the title
 * from the installer's ProductName ("7-Zip") and Windows lists the program by its
 * DisplayName ("7-Zip 26.01 (arm64)"), by design (fleetdm/fleet#20440). Its
 * Library row never shows an installed version, so the host's inventory is read
 * by the Windows name instead.
 *
 * Adding software to a fleet — upload, Fleet-maintained catalog — is covered
 * where it involves no host, by `library.spec.ts`.
 *
 * **What isn't asserted in the UI: the Upcoming item.** On an idle VM an install
 * is picked up within seconds of being queued, often before the page that would
 * show it has loaded. The queued state is asserted through the API, which
 * reports `pending_install` / `pending_uninstall` the moment the click lands.
 */
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  getHostSoftwareState,
  listHostActivities,
  requireRealHost,
  waitForSoftwareSettled,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';
import {
  VM_SOFTWARE_FIXTURES,
  ensureVmFixtureUninstalled,
  findVmFixtureTitle,
} from '@helpers/vm-fixtures';

/**
 * When the host's newest `type` activity for `title` was recorded, or 0. The
 * fixtures recur every run, so the Past activity checks baseline this before
 * acting and require a newer one after: an entry from an earlier run reads the
 * same.
 */
async function newestActivityAt(request: APIRequestContext, hostId: number, type: string, title: string) {
  const match = (await listHostActivities(request, hostId)).find(
    (a) => a.type === type && a.details.software_title === title,
  );
  return match ? Date.parse(match.createdAt) : 0;
}

test.describe('Premium • Software • Install and uninstall on host', () => {
  // Two host round-trips — each a queued action and an inventory refetch — on a
  // VM other specs queue work on.
  test.describe.configure({ timeout: 900_000 });

  for (const fixture of VM_SOFTWARE_FIXTURES) {
    test(`a ${fixture.label} installs on the ${fixture.platform} VM and uninstalls again`, async ({
      hostDetails,
      vmsFleetId,
      request,
    }) => {
      const host = await requireRealHost(request, fixture.platform);
      const title = await findVmFixtureTitle(request, vmsFleetId, fixture);
      const inventoryName = title.linked ? undefined : title.inventoryName;
      const library = hostDetails.library;
      const version = (await getHostSoftwareState(request, host.id, title.titleId))?.libraryVersion;
      expect(version, `${title.name} isn't offered to ${host.displayName}`).toBeTruthy();

      // Normally a no-op: the preflight leaves every fixture uninstalled.
      await ensureVmFixtureUninstalled(request, host.id, title);

      try {
        await test.step('install', async () => {
          const before = await newestActivityAt(request, host.id, 'installed_software', title.name);
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(title.name);
          await expect(await library.installedVersion(title.name)).toHaveText('---');
          await expect(await library.libraryVersion(title.name)).toHaveText(version!);

          await library.install(title.name);
          expect((await getHostSoftwareState(request, host.id, title.titleId))?.status).toBe('pending_install');
          await waitForSoftwareSettled(request, host.id, title.titleId, 'installed', { inventoryName });

          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(title.name);
          await expect(await library.installedVersion(title.name)).toHaveText(title.linked ? version! : '---');
          await expect(library.installAction(title.name, 'Reinstall')).toBeVisible();

          await library.statusButton(title.name, 'Installed').click();
          const details = hostDetails.installDetailsModal;
          await details.expectOpen();
          await expect(details.statusMessage).toContainText(
            `installed ${title.name} (${title.packageName}) on ${host.displayName}`,
          );
          await details.close();

          expect(
            await newestActivityAt(request, host.id, 'installed_software', title.name),
            'this install recorded no activity of its own',
          ).toBeGreaterThan(before);
          await hostDetails.goto(host.id);
          await hostDetails.showPastActivities();
          await hostDetails.activityItem(activityCopy.hostSoftware.installed({ title: title.name })).first().click();
          await details.expectOpen();
          await expect(details.statusMessage).toContainText(`installed ${title.name} (${title.packageName})`);
          await details.close();

          await hostDetails.goto(host.id);
          await hostDetails.openInventory(title.inventoryName);
          await expect(hostDetails.softwareNameLink(title.inventoryName)).toBeVisible();
        });

        await test.step('uninstall', async () => {
          const before = await newestActivityAt(request, host.id, 'uninstalled_software', title.name);
          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(title.name);
          await library.uninstall(title.name);
          expect((await getHostSoftwareState(request, host.id, title.titleId))?.status).toBe('pending_uninstall');
          await waitForSoftwareSettled(request, host.id, title.titleId, null, { inventoryName });

          await hostDetails.goto(host.id);
          await hostDetails.openLibrary(title.name);
          await expect(await library.installedVersion(title.name)).toHaveText('---');
          await expect(library.installAction(title.name, 'Install')).toBeVisible();
          await expect(library.uninstallAction(title.name)).toHaveCount(0);

          await hostDetails.goto(host.id);
          await hostDetails.openInventory(title.inventoryName);
          await expect(hostDetails.softwareEmptyState).toBeVisible();
          await expect(hostDetails.softwareNameLink(title.inventoryName)).toHaveCount(0);

          expect(
            await newestActivityAt(request, host.id, 'uninstalled_software', title.name),
            'this uninstall recorded no activity of its own',
          ).toBeGreaterThan(before);
          await hostDetails.goto(host.id);
          await hostDetails.showPastActivities();
          await hostDetails
            .activityItem(activityCopy.hostSoftware.uninstalled({ title: title.name }))
            .first()
            .click();
          const details = hostDetails.uninstallDetailsModal;
          await details.expectOpen();
          await expect(details.statusMessage).toContainText(`uninstalled ${title.name} from ${host.displayName}`);
          await details.close();
        });
      } finally {
        // The title stays: it's the fleet's, not the test's.
        await ensureVmFixtureUninstalled(request, host.id, title);
      }
    });
  }
});
