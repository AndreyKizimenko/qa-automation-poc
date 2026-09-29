/**
 * Premium • Software • An uninstall that fails.
 *
 * With a package installed on the Ubuntu VM whose uninstall script exits 1,
 * uninstall it from the host's Library: the status reads failed, the host's
 * inventory still reports the package after a fresh read, the Library row keeps
 * its installed version and offers **Retry uninstall**, and the uninstall details
 * show the script's output.
 *
 * Premium only, on the real VMs of the **VMs** fleet. The package is built per
 * run by `helpers/deb.ts` and named `fleet-pw-uninstall-fails-*`, because the
 * test gives it its own uninstall script — a durable fixture's would carry that
 * into every other spec. The install is a precondition, done through the API, so
 * a failure here is about uninstalling. A clean uninstall of every durable
 * fixture is `software-lifecycle-on-host.spec.ts`.
 */
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { inertDeb } from '@helpers/deb';
import {
  deleteSoftwareTitle,
  installSoftwareOnHost,
  queueAdHocScript,
  requireRealHost,
  uploadSoftwarePackageBuffer,
  waitForSoftwareSettled,
} from '@helpers/api';

test.describe('Premium • Software • Uninstall from host', () => {
  test.describe.configure({ timeout: 600_000 });

  test('an uninstall that fails leaves the software installed, and the Library offers a retry', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-uninstall-fails-${Date.now().toString(36)}`;
    const title = await uploadSoftwarePackageBuffer(request, vmsFleetId, `${name}_1.0.0_all.deb`, inertDeb(name, '1.0.0'), {
      uninstallScript: '#!/bin/sh\necho "refusing to uninstall"\nexit 1\n',
    });
    const library = hostDetails.library;

    try {
      await installSoftwareOnHost(request, host.id, title.titleId);
      await waitForSoftwareSettled(request, host.id, title.titleId, 'installed');

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
      await expect((await details.revealOutput()).first()).toContainText('refusing to uninstall');
      await details.close();
    } finally {
      // Fleet's own uninstall is the one that fails, so the package comes off the
      // host through dpkg directly before its title is deleted.
      await queueAdHocScript(request, host.id, `#!/bin/sh\napt-get remove --purge --assume-yes ${name}\n`);
      await deleteSoftwareTitle(request, vmsFleetId, title.titleId);
    }
  });
});
