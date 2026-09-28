/**
 * Premium • Software • Installing on a real host.
 *
 * Add an installer through the Add software UI, install it from the host's
 * Library, and follow it until the host reports it back: Status "Installed", the
 * install details, the host's Past activity, and the version in the host's own
 * inventory. Platform is a dimension — one row per platform and package type —
 * plus a Fleet-maintained app added from its catalog page, and "Deploy", which
 * installs automatically through the policy Fleet creates for it.
 *
 * Premium only: installing software is a premium feature.
 *
 * **Where it runs.** On the real VMs, which live on the **VMs** fleet — so every
 * installer goes there too. `cleanup.steps.ts` doesn't wipe that fleet, so each
 * test removes what it added in a `finally`: uninstalled from the host, then
 * deleted from the library. A fixed-name fixture a dead run left behind is
 * cleared the same way before the test starts.
 *
 * **Which installers.** Every VM is ARM, and each fixture is inert:
 *
 *   | row | fixture | what it installs |
 *   |---|---|---|
 *   | macOS `.pkg` | `fleet-playwright-install-1.0.0.pkg` (`make-pkg.sh`) | an empty app bundle in /Applications |
 *   | Windows `.msi` | `fleet-playwright-install-1.0.0.msi` (`make-msi.sh`) | one marker file under Program Files |
 *   | Linux `.deb` | built per run by `helpers/deb.ts` | one marker file under /usr/share |
 *
 * The macOS package installs an app bundle, not bare files, because Fleet's macOS
 * inventory lists `.app` bundles only — a files-only package installs but never
 * shows up. The Linux package is named per run so nothing another run left can
 * share its title.
 *
 * **What isn't asserted in the UI: the Upcoming item.** On an idle VM an install
 * is picked up within seconds of being queued, often before the page that would
 * show it has loaded, and on a busy one after an unpredictable wait behind other
 * specs' work. The queued state is asserted where it is deterministic — the API
 * reports `pending_install` the moment the click lands — and the UI asserts the
 * outcome.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { inertDeb } from '@helpers/deb';
import {
  deleteFleetPolicies,
  ensureNotInstalled,
  findOnlineHost,
  findSoftwareTitleByPackageName,
  getHostSoftwareState,
  getSoftwarePackage,
  listFleetMaintainedTitles,
  listFleetPolicies,
  removeTitleFromHost,
  requestHostRefetch,
  waitForHostSoftwareStatus,
  waitForSoftwareSettled,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';
import type { DashboardPage, HostDetailsPage, SoftwareTitlesPage } from '@pages';

type Platform = 'darwin' | 'windows' | 'linux';

const TEST_DATA = path.resolve(__dirname, '../../../../test-data');

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function realHost(request: APIRequestContext, platform: Platform) {
  const host = await findOnlineHost(request, platform, { kind: 'real' });
  if (!host) throw new Error(`no online real ${platform} VM on ${process.env.FLEET_URL}`);
  return host;
}

/** Dashboard → Software → the VMs fleet → Add software. */
async function openAddSoftware(dashboard: DashboardPage, softwareTitles: SoftwareTitlesPage) {
  await dashboard.goto();
  await dashboard.navbar.goToSoftware();
  await softwareTitles.teamDropdown.selectByLabel('VMs');
  await softwareTitles.clickAddSoftware();
}

/**
 * The part every row shares once its installer is in the library: install from
 * the host's Library and follow the install to the host's inventory.
 */
async function installFromLibrary(
  hostDetails: HostDetailsPage,
  request: APIRequestContext,
  host: { id: number; displayName: string },
  title: { id: number; name: string; packageName: string; version: string },
) {
  const library = hostDetails.library;
  // Clears an install a dead run left on the host after its title was deleted,
  // which the title's return makes visible again.
  await ensureNotInstalled(request, host.id, title.id);
  await hostDetails.goto(host.id);
  await hostDetails.openLibrary(title.name);
  await expect(await library.installedVersion(title.name)).toHaveText('---');
  await expect(await library.libraryVersion(title.name)).toHaveText(title.version);

  await library.install(title.name);
  expect((await getHostSoftwareState(request, host.id, title.id))?.status).toBe('pending_install');
  await waitForSoftwareSettled(request, host.id, title.id, 'installed');

  await hostDetails.goto(host.id);
  await hostDetails.openLibrary(title.name);
  await expect(await library.installedVersion(title.name)).toHaveText(title.version);
  await expect(library.installAction(title.name, 'Reinstall')).toBeVisible();

  await library.statusButton(title.name, 'Installed').click();
  const details = hostDetails.installDetailsModal;
  await details.expectOpen();
  await expect(details.statusMessage).toContainText(
    `installed ${title.name} (${title.packageName}) on ${host.displayName}`,
  );
  await details.close();

  await hostDetails.goto(host.id);
  await hostDetails.showPastActivities();
  await hostDetails.activityItem(activityCopy.hostSoftware.installed({ title: title.name })).first().click();
  await details.expectOpen();
  await expect(details.statusMessage).toContainText(`installed ${title.name} (${title.packageName})`);
  await details.close();
}

test.describe('Premium • Software • Install on host', () => {
  // An upload, a real install and an inventory refetch on a shared VM.
  test.describe.configure({ timeout: 600_000 });

  const customPackages: Array<{
    label: string;
    platform: Platform;
    /** Returns the file to upload — a committed fixture or one built for this run. */
    file: (outputPath: (name: string) => string) => string;
  }> = [
    {
      label: 'macOS .pkg',
      platform: 'darwin',
      file: () => path.join(TEST_DATA, 'apple/macos/software/fleet-playwright-install-1.0.0.pkg'),
    },
    {
      label: 'Windows .msi',
      platform: 'windows',
      file: () => path.join(TEST_DATA, 'windows/software/fleet-playwright-install-1.0.0.msi'),
    },
    {
      label: 'Linux .deb',
      platform: 'linux',
      file: (outputPath) => {
        const name = `fleet-pw-install-${Date.now().toString(36)}`;
        const file = outputPath(`${name}_1.0.0_all.deb`);
        fs.writeFileSync(file, inertDeb(name, '1.0.0'));
        return file;
      },
    },
  ];

  for (const pkg of customPackages) {
    test(`a ${pkg.label} added in the UI installs on the ${pkg.platform} VM and lands in its inventory`, async ({
      dashboard,
      softwareTitles,
      softwareCustomPackage,
      softwareTitleDetail,
      hostDetails,
      vmsFleetId,
      request,
    }, testInfo) => {
      const host = await realHost(request, pkg.platform);
      const file = pkg.file((name) => testInfo.outputPath(name));
      const packageName = path.basename(file);

      const leftover = await findSoftwareTitleByPackageName(request, vmsFleetId, packageName);
      if (leftover) await removeTitleFromHost(request, vmsFleetId, host.id, leftover.titleId);

      let titleId: number | undefined;
      try {
        await openAddSoftware(dashboard, softwareTitles);
        await softwareCustomPackage.openTab();
        titleId = await softwareCustomPackage.uploadPackage(file);
        const name = await softwareTitleDetail.displayName();
        const version = (await getHostSoftwareState(request, host.id, titleId))?.libraryVersion;
        expect(version, `${name} isn't offered to ${host.displayName}`).toBeTruthy();

        await installFromLibrary(hostDetails, request, host, { id: titleId, name, packageName, version: version! });
      } finally {
        if (titleId) await removeTitleFromHost(request, vmsFleetId, host.id, titleId);
      }
    });
  }

  test('a Fleet-maintained app added from its catalog page installs on the macOS VM', async ({
    dashboard,
    softwareTitles,
    fleetMaintainedApps,
    fleetMaintainedAppDetail,
    softwareTitleDetail,
    hostDetails,
    vmsFleetId,
    request,
    page,
  }) => {
    // A menu-bar calendar of a few MB, never launched. Anything but Claude,
    // which this fleet keeps installed on purpose (gitops/.../fleets/vms.yml).
    const app = { name: 'Itsycal' };
    const host = await realHost(request, 'darwin');

    const leftover = (await listFleetMaintainedTitles(request, vmsFleetId)).find(
      (t) => t.name === app.name && t.platform === 'darwin',
    );
    if (leftover) await removeTitleFromHost(request, vmsFleetId, host.id, leftover.titleId);

    let titleId: number | undefined;
    try {
      await openAddSoftware(dashboard, softwareTitles);
      await fleetMaintainedApps.openTab();
      await fleetMaintainedApps.expectNotAddedFor(app.name, 'macOS');
      await fleetMaintainedApps.clickAdd(app.name, 'macOS');
      await fleetMaintainedAppDetail.confirmAdd();
      await page.waitForURL(/\/software\/titles\/\d+/, { timeout: 60_000 });
      titleId = Number(new URL(page.url()).pathname.split('/').pop());
      await expect(softwareTitleDetail.displayHeading).toHaveText(app.name);
      await expect(softwareTitleDetail.headerPills).toContainText(['Fleet-maintained']);

      const state = await getHostSoftwareState(request, host.id, titleId);
      expect(state?.libraryVersion, `${app.name} isn't offered to ${host.displayName}`).toBeTruthy();
      // The installer file Fleet fetched from the catalog, which the install
      // details name alongside the title.
      const packageName = (await getSoftwarePackage(request, vmsFleetId, titleId))?.name;
      expect(packageName, `${app.name} has no installer on the VMs fleet`).toBeTruthy();

      await installFromLibrary(hostDetails, request, host, {
        id: titleId,
        name: app.name,
        packageName: packageName!,
        version: state!.libraryVersion!,
      });
    } finally {
      if (titleId) await removeTitleFromHost(request, vmsFleetId, host.id, titleId);
    }
  });

  test('"Deploy" creates an install policy, and Fleet installs through it on the Linux VM', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    softwareTitleDetail,
    hostDetails,
    vmsFleetId,
    request,
  }, testInfo) => {
    const host = await realHost(request, 'linux');
    const name = `fleet-pw-deploy-${Date.now().toString(36)}`;
    const file = testInfo.outputPath(`${name}_1.0.0_all.deb`);
    fs.writeFileSync(file, inertDeb(name, '1.0.0'));
    const policyName = `[Install software] ${name} (deb)`;

    let titleId: number | undefined;
    try {
      await openAddSoftware(dashboard, softwareTitles);
      await softwareCustomPackage.openTab();
      titleId = await softwareCustomPackage.uploadPackage(file, { deploy: true });
      await expect(softwareTitleDetail.displayHeading).toHaveText(name);

      // Fleet wrote the policy that does the deploying, on this fleet, and says so
      // in the feed. The activity carries no fleet (the automatic-install path
      // logs `created_policy` without `team_id`), so it reads without the "on
      // the VMs fleet" a hand-made fleet policy's does.
      const policy = (await listFleetPolicies(request, vmsFleetId)).find((p) => p.name === policyName);
      expect(policy, `no "${policyName}" policy on the VMs fleet`).toBeDefined();
      await dashboard.goto();
      await dashboard.expectActivity(new RegExp(`created a policy ${escapeRegExp(policyName)}\\.`));

      // The VM fails the policy at its next policy run — asked for now rather
      // than waited out — and the policy's automation installs the package.
      await requestHostRefetch(request, host.id);
      await waitForHostSoftwareStatus(request, host.id, titleId, 'installed', 420_000);

      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      const activity = hostDetails.activityItem(activityCopy.hostSoftware.installed({ title: name }));
      await expect(activity.first()).toBeVisible();
      await expect(activity.first()).toHaveAccessibleName(/^Fleet installed/);
    } finally {
      const policies = (await listFleetPolicies(request, vmsFleetId)).filter((p) => p.name === policyName);
      await deleteFleetPolicies(request, vmsFleetId, policies.map((p) => p.id));
      if (titleId) await removeTitleFromHost(request, vmsFleetId, host.id, titleId);
    }
  });
});
