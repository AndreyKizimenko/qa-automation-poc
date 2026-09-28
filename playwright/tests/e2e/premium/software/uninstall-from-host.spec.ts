/**
 * Premium • Software • Uninstalling from a real host.
 *
 * With a package already installed on a VM, uninstall it from the host's
 * Library and follow it to the end: the Past activity, the Uninstall details,
 * the Library row going back to "Install", and the host's own inventory no
 * longer reporting it. One row per package type, plus an uninstall that fails —
 * which must leave the software installed and say so.
 *
 * Premium only, on the real VMs of the **VMs** fleet; see
 * `install-on-host.spec.ts` for why, and for the inert fixtures. The install is
 * a precondition here, done through the API, so a failure in this spec is about
 * uninstalling.
 *
 *   | row | fixture | uninstall script |
 *   |---|---|---|
 *   | macOS `.pkg` | `fleet-playwright-uninstall-1.0.0.pkg` | Fleet's, from the package IDs |
 *   | Windows `.msi` | `fleet-playwright-uninstall-1.0.0.msi` | Fleet's, from the product code |
 *   | Windows `.exe` | `7z2601-arm64.exe` | ours — Fleet requires one for `.exe` |
 *   | Linux `.deb` | built per run | Fleet's `apt-get remove` |
 *   | failing | built per run | `exit 1` |
 *
 * Nothing else on the VMs fleet uses 7-Zip, so its `.exe` installs into a folder
 * no other spec touches.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { inertDeb } from '@helpers/deb';
import {
  deleteSoftwareTitle,
  findOnlineHost,
  findSoftwareTitleByPackageName,
  getHostInventoryVersions,
  getHostSoftwareState,
  installSoftwareOnHost,
  queueAdHocScript,
  removeTitleFromHost,
  uploadSoftwarePackageBuffer,
  waitForSoftwareSettled,
  type PackageScripts,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';

type Platform = 'darwin' | 'windows' | 'linux';

const TEST_DATA = path.resolve(__dirname, '../../../../test-data');

const fixture = (relative: string) => ({
  name: path.basename(relative),
  buffer: fs.readFileSync(path.join(TEST_DATA, relative)),
});

async function realHost(request: APIRequestContext, platform: Platform) {
  const host = await findOnlineHost(request, platform, { kind: 'real' });
  if (!host) throw new Error(`no online real ${platform} VM on ${process.env.FLEET_URL}`);
  return host;
}

/**
 * Uploads and installs a package through the API, and waits until the host's
 * inventory reports it — the state the uninstall starts from. `inventoryName`
 * is the name the host reports, when it isn't the title's.
 */
async function installedPackage(
  request: APIRequestContext,
  fleetId: number,
  hostId: number,
  fileName: string,
  buffer: Buffer,
  scripts: PackageScripts = {},
  opts: { inventoryName?: string } = {},
): Promise<{ titleId: number; name: string; inventoryName: string; version: string }> {
  const leftover = await findSoftwareTitleByPackageName(request, fleetId, fileName);
  if (leftover) await removeTitleFromHost(request, fleetId, hostId, leftover.titleId);

  const title = await uploadSoftwarePackageBuffer(request, fleetId, fileName, buffer, scripts);
  await installSoftwareOnHost(request, hostId, title.titleId);
  const state = await waitForSoftwareSettled(request, hostId, title.titleId, 'installed', {
    inventory: opts.inventoryName ? 'any' : 'present',
  });
  const inventoryName = opts.inventoryName ?? title.name;
  expect(
    await getHostInventoryVersions(request, hostId, inventoryName),
    `${title.name} installed but the host's inventory never listed ${inventoryName}`,
  ).not.toEqual([]);
  return { titleId: title.titleId, name: title.name, inventoryName, version: state.libraryVersion ?? '' };
}

test.describe('Premium • Software • Uninstall from host', () => {
  test.describe.configure({ timeout: 600_000 });

  const packages: Array<{
    label: string;
    platform: Platform;
    /** Called once per test, so a package built per run gets a name of its own. */
    file: () => { name: string; buffer: Buffer };
    scripts?: PackageScripts;
    /**
     * What the host's inventory calls it, when that isn't the title name. Fleet
     * then can't tie the installed program to the title, so the Library never
     * shows it an installed version.
     */
    inventoryName?: string;
  }> = [
    {
      label: 'macOS .pkg',
      platform: 'darwin',
      file: () => fixture('apple/macos/software/fleet-playwright-uninstall-1.0.0.pkg'),
    },
    {
      label: 'Windows .msi',
      platform: 'windows',
      file: () => fixture('windows/software/fleet-playwright-uninstall-1.0.0.msi'),
    },
    {
      label: 'Windows .exe',
      platform: 'windows',
      file: () => fixture('windows/software/7z2601-arm64.exe'),
      // The title is named from the installer's ProductName; Windows lists the
      // program by its DisplayName.
      inventoryName: '7-Zip 26.01 (arm64)',
      // 7-Zip's NSIS installer and uninstaller both take /S for a silent run.
      scripts: {
        installScript:
          '$p = Start-Process -FilePath $env:INSTALLER_PATH -ArgumentList "/S" -Wait -PassThru\nexit $p.ExitCode\n',
        uninstallScript:
          '$p = Start-Process -FilePath "C:\\Program Files\\7-Zip\\Uninstall.exe" -ArgumentList "/S" -Wait -PassThru\nexit $p.ExitCode\n',
      },
    },
    {
      label: 'Linux .deb',
      platform: 'linux',
      file: () => {
        const name = `fleet-pw-uninstall-${Date.now().toString(36)}`;
        return { name: `${name}_1.0.0_all.deb`, buffer: inertDeb(name, '1.0.0') };
      },
    },
  ];

  for (const pkg of packages) {
    test(`a ${pkg.label} uninstalls from the ${pkg.platform} VM and leaves its inventory`, async ({
      hostDetails,
      vmsFleetId,
      request,
    }) => {
      const host = await realHost(request, pkg.platform);
      const file = pkg.file();
      const title = await installedPackage(request, vmsFleetId, host.id, file.name, file.buffer, pkg.scripts, {
        inventoryName: pkg.inventoryName,
      });
      const library = hostDetails.library;
      // Whether the Library can show this title's installed version at all.
      const linked = !pkg.inventoryName;

      try {
        await hostDetails.goto(host.id);
        await hostDetails.openLibrary(title.name);
        if (linked) await expect(await library.installedVersion(title.name)).not.toHaveText('---');

        await library.uninstall(title.name);
        expect((await getHostSoftwareState(request, host.id, title.titleId))?.status).toBe('pending_uninstall');

        // A clean uninstall clears the status, and the next inventory read no
        // longer lists the software.
        await waitForSoftwareSettled(request, host.id, title.titleId, null, { inventory: linked ? 'absent' : 'any' });
        expect(await getHostInventoryVersions(request, host.id, title.inventoryName)).toEqual([]);

        await hostDetails.goto(host.id);
        await hostDetails.openLibrary(title.name);
        await expect(await library.installedVersion(title.name)).toHaveText('---');
        await expect(library.installAction(title.name, 'Install')).toBeVisible();
        await expect(library.uninstallAction(title.name)).toHaveCount(0);

        await hostDetails.goto(host.id);
        await hostDetails.openInventory(title.inventoryName);
        await expect(hostDetails.softwareRowOrEmpty()).toBeVisible();
        await expect(hostDetails.softwareNameLink(title.inventoryName)).toHaveCount(0);

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
      } finally {
        await removeTitleFromHost(request, vmsFleetId, host.id, title.titleId);
      }
    });
  }

  test('an uninstall that fails leaves the software installed, and the Library offers a retry', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await realHost(request, 'linux');
    const name = `fleet-pw-uninstall-fails-${Date.now().toString(36)}`;
    const title = await installedPackage(
      request,
      vmsFleetId,
      host.id,
      `${name}_1.0.0_all.deb`,
      inertDeb(name, '1.0.0'),
      { uninstallScript: '#!/bin/sh\necho "refusing to uninstall"\nexit 1\n' },
    );
    const library = hostDetails.library;

    try {
      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(name);
      await library.uninstall(name);
      // Still on the host: the inventory keeps reporting it after a fresh read.
      const after = await waitForSoftwareSettled(request, host.id, title.titleId, 'failed_uninstall');
      expect(after.installedVersions).toEqual(['1.0.0']);

      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(name);
      await expect(await library.installedVersion(name)).toHaveText('1.0.0');
      await expect(library.statusButton(name, 'Installed')).toBeVisible();
      await expect(library.uninstallAction(name, 'Retry uninstall')).toBeVisible();
      await expect(library.installAction(name, 'Reinstall')).toBeVisible();

      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      await hostDetails.activityItem(activityCopy.hostSoftware.failedToUninstall({ title: name })).first().click();
      const details = hostDetails.uninstallDetailsModal;
      await details.expectOpen();
      await expect(details.statusMessage).toContainText(`uninstall ${name} from ${host.displayName}`);
      await expect((await details.output()).first()).toContainText('refusing to uninstall');
      await details.close();
    } finally {
      // Fleet's own uninstall is the one that fails, so the package comes off the
      // host through dpkg directly before its title is deleted.
      await queueAdHocScript(request, host.id, `#!/bin/sh\napt-get remove --purge --assume-yes ${name}\n`);
      await deleteSoftwareTitle(request, vmsFleetId, title.titleId);
    }
  });
});
