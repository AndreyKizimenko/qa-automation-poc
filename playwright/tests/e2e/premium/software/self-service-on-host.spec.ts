/**
 * Premium • Software • Self service on My device: an install and an uninstall the end user starts.
 *
 * On each platform's pool VM, the admin opens the host's My device page through Host details' link, as an end
 * user's Fleet Desktop would open it, and drives the Self service tab: Install, then the uninstall the row
 * offers, confirmed in its modal. Each is checked where the end user sees it (the row's Install status, the
 * Software tab's inventory) and where an admin does: the host's Activity card, which words a self-service
 * action in the passive voice with no actor ("… was installed on this host (self service)."), and Fleet's
 * own record of the host's software. This is the Software row of fleetd's release QA (fleetdm/fleet#57313)
 * for self-service, on macOS, Windows and Linux.
 *
 * **What it installs.** The VMs fleet's self-service fixture of the platform, "Fleet Playwright Self-service"
 * (`fleet-playwright-self-service` on Linux): an inert `.pkg`, `.msi` or `.deb` that gitops declares
 * `self_service: true` (`gitops/premium-fleetqa/fleets/vms.yml`, `VM_SELF_SERVICE_FIXTURES`). No other spec
 * installs it, so the worker's VM meets no other install of it, and the test leaves it as it found it,
 * uninstalled, whatever happens (the cleanup's preflight sees to it after a killed run as well).
 *
 * **What it waits on.** Fleet's record, not the page: the host's software status through the API, until the
 * inventory agrees (`waitForSoftwareSettled`). The page then follows by itself: after an action it polls the
 * list while anything is pending, then refetches the host, then reloads the list (`SelfService.tsx`).
 *
 * Grounded in: `DeviceUserPage.tsx` (the tabs, where the link lands), `cards/Software/SelfService/` (the
 * table, Install with no confirmation, the uninstall modal), `HostInstallerActionCell.tsx` (Uninstall inside
 * "More" for a macOS app or Windows program), `InstallStatusCell.tsx` (the statuses) and
 * `InstalledSoftwareActivityItem.tsx` (the passive wording).
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { listHostActivities, requireRealHost, vmTag, waitForSoftwareSettled } from '@helpers/api';
import { VM_SELF_SERVICE_FIXTURES, ensureVmFixtureUninstalled, findVmFixtureTitle } from '@helpers/vm-fixtures';

/**
 * When the host's newest self-service `type` activity for `title` was recorded, or 0. The fixture recurs every
 * run, so each check baselines this before acting and requires a newer one after.
 */
async function newestSelfServiceAt(request: APIRequestContext, hostId: number, type: string, title: string): Promise<number> {
  const match = (await listHostActivities(request, hostId)).find(
    (a) => a.type === type && a.details.software_title === title && a.details.self_service === true,
  );
  return match ? Date.parse(match.createdAt) : 0;
}

test.describe('Premium • Software • Self service on My device', () => {
  // Two host round trips, each an action and the inventory refetch after it.
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  for (const fixture of VM_SELF_SERVICE_FIXTURES) {
    // eslint-disable-next-line playwright/valid-test-tags -- the tag is the fixture's VM, from vmTag()
    test(`the ${fixture.platform} VM installs its self-service ${fixture.label} from My device, and uninstalls it there`, { tag: vmTag(fixture.platform) }, async ({
      hostDetails,
      vmsFleetId,
      request,
      cleanup,
    }) => {
      const host = await requireRealHost(request, fixture.platform);
      const title = await findVmFixtureTitle(request, vmsFleetId, fixture);
      // Normally a no-op: the preflight leaves every fixture at rest.
      await ensureVmFixtureUninstalled(request, host.id, title);
      cleanup.add(`leave ${title.name} uninstalled on ${host.displayName}`, (r) => ensureVmFixtureUninstalled(r, host.id, title));

      await hostDetails.goto(host.id);
      const device = await hostDetails.openMyDevice();
      await device.expectLoaded();

      await test.step('Self service offers it, not installed', async () => {
        await device.openTab('Self service');
        await expect(await device.selfServiceStatus(title.name)).toHaveText('---');
      });

      await test.step('Install on My device: the row reads Installed, and the Software tab lists it', async () => {
        const before = await newestSelfServiceAt(request, host.id, 'installed_software', title.name);
        await device.selfServiceInstall(title.name);
        await waitForSoftwareSettled(request, host.id, title.titleId, 'installed');
        await expect(await device.selfServiceStatus(title.name)).toHaveText(/^Installed/, { timeout: 180_000 });
        await expect(device.selfServiceRow(title.name).getByRole('button', { name: 'Reinstall', exact: true })).toBeVisible();
        expect(
          await newestSelfServiceAt(request, host.id, 'installed_software', title.name),
          'the install recorded no self-service activity of its own',
        ).toBeGreaterThan(before);

        await expect(await device.findInSoftware(title.name)).toBeVisible();
      });

      await test.step("Host details: the host's Activity says it was installed (self service)", async () => {
        await hostDetails.goto(host.id);
        await hostDetails.showPastActivities();
        await expect(hostDetails.activityItem(activityCopy.hostSoftware.selfServiceInstalled({ title: title.name })).first()).toBeVisible();
      });

      await test.step('Uninstall on My device, confirmed in its modal: the row reads --- again', async () => {
        const before = await newestSelfServiceAt(request, host.id, 'uninstalled_software', title.name);
        await device.openTab('Self service');
        await device.selfServiceUninstall(title.name);
        await waitForSoftwareSettled(request, host.id, title.titleId, null);
        await expect(await device.selfServiceStatus(title.name)).toHaveText('---', { timeout: 180_000 });
        await expect(device.selfServiceRow(title.name).getByRole('button', { name: 'Install', exact: true })).toBeVisible();
        expect(
          await newestSelfServiceAt(request, host.id, 'uninstalled_software', title.name),
          'the uninstall recorded no self-service activity of its own',
        ).toBeGreaterThan(before);
      });

      await test.step("Host details: the host's Activity says it was uninstalled (self service)", async () => {
        await hostDetails.goto(host.id);
        await hostDetails.showPastActivities();
        await expect(
          hostDetails.activityItem(activityCopy.hostSoftware.selfServiceUninstalled({ title: title.name })).first(),
        ).toBeVisible();
      });
    });
  }
});
