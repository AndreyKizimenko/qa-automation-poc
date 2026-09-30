/**
 * Free • Controls • Configuration profiles — a profile and a declaration reach
 * the real Mac, and leave it again.
 *
 * The free half of batch E. Free has no label targets — every profile goes to
 * every MDM host — but delivery itself, the commands that carry it, Resend and
 * removal are all free features, and premium's specs
 * (`profile-delivery-retry`, `profile-declarations`, `configuration-profiles`)
 * reach them only through targeting. So, on the free macOS VM:
 *
 *  - a `.mobileconfig`: installed and **verified**, its setting read back on the
 *    device, the host's Activity naming the InstallProfile, **Resend** from the
 *    Controls tab sending a second one, then deleted — a RemoveProfile, and the
 *    setting gone;
 *  - a DDM declaration: verified (the device's own report), then deleted.
 *
 * **Every upload here reaches the free VMs** — free has no fleets, so Unassigned
 * is where they are — and every MDM-enrolled simulation there. So the payloads
 * are the approved inert ones (`helpers/profiles.ts`), each with a name of its
 * own. macOS only: free's lifecycle spec puts the one approved inert Windows
 * profile on Unassigned too, and two profiles setting one LocURI undo each other.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  deleteProfile,
  findProfileByName,
  getHostDetailUpdatedAt,
  listHostMdmCommands,
  readManagedPreferenceDomain,
  requireRealHost,
  waitForHostProfileGone,
  waitForHostProfileStatus,
  waitForHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';
import { inertDeclaration, inertMobileconfig, runNonce, writeProfile } from '@helpers/profiles';

test.describe('Free • Controls • Configuration profiles — delivery to the real Mac', () => {
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  test('a profile is installed, resent and removed, and the host names it in each command', async ({
    dashboard,
    controls,
    osSettings,
    configurationProfiles,
    hostDetails,
    request,
  }, testInfo) => {
    const vm = await requireRealHost(request, 'darwin');
    const profile = inertMobileconfig(`pw-fd-${runNonce()}`);
    const installs = async () =>
      (await listHostMdmCommands(request, vm.id, 'InstallProfile')).filter((c) => c.name === profile.name);
    let uuid: string | undefined;

    try {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();
      await configurationProfiles.uploadProfile(writeProfile(profile, testInfo.outputDir));
      uuid = (await findProfileByName(request, 0, profile.name))?.uuid;
      expect(uuid, `${profile.name} was not stored`).toBeTruthy();

      await waitForHostProfileStatus(request, vm.id, uuid!, ['verifying', 'verified']);
      await waitForNoPendingRefetch(request, vm.id);
      await waitForHostRefetch(request, vm.id, { since: await getHostDetailUpdatedAt(request, vm.id), refetch: true });
      await waitForHostProfileStatus(request, vm.id, uuid!, ['verified'], 180_000);
      expect(await readManagedPreferenceDomain(request, vm.id, profile.domain)).toEqual({ Marker: profile.marker });

      await hostDetails.goto(vm.id);
      await hostDetails.showPastActivities();
      await hostDetails.showMdmCommands(true);
      await expect(
        hostDetails
          .activityItem(
            activityCopy.mdmCommand.forProfile({ requestType: 'InstallProfile', name: profile.name, status: 'was acknowledged' }),
          )
          .first(),
      ).toBeVisible();
      expect((await installs()).map((c) => c.status)).toEqual(['Acknowledged']);

      // Resend from the Controls tab: a second InstallProfile, acknowledged.
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toContainText('Verified');
      await hostDetails.resendControl(profile.name);
      await expect
        .poll(async () => (await installs()).map((c) => c.status), {
          message: `the resend of ${profile.name} was never acknowledged`,
          timeout: 180_000,
          intervals: [5_000],
        })
        .toEqual(['Acknowledged', 'Acknowledged']);

      // Deleted: a RemoveProfile, and the setting leaves the device.
      await configurationProfiles.goto();
      await configurationProfiles.deleteProfile(profile.name);
      await waitForHostProfileGone(request, vm.id, uuid!);
      uuid = undefined;
      await expect
        .poll(() => readManagedPreferenceDomain(request, vm.id, profile.domain), {
          message: `${profile.name}'s domain stayed on the VM after the profile was deleted`,
          timeout: 120_000,
          intervals: [10_000],
        })
        .toEqual({});
      await hostDetails.goto(vm.id);
      await hostDetails.showPastActivities();
      await hostDetails.showMdmCommands(true);
      await expect(
        hostDetails
          .activityItem(
            activityCopy.mdmCommand.forProfile({ requestType: 'RemoveProfile', name: profile.name, status: 'was acknowledged' }),
          )
          .first(),
      ).toBeVisible();
    } finally {
      if (uuid) await deleteProfile(request, uuid);
    }
  });

  test('a declaration is verified by the Mac and removed again', async ({
    configurationProfiles,
    hostDetails,
    request,
  }, testInfo) => {
    const vm = await requireRealHost(request, 'darwin');
    const declaration = inertDeclaration(`pw-fd-${runNonce()}-d`);
    let uuid: string | undefined;

    try {
      await configurationProfiles.goto();
      await configurationProfiles.uploadProfile(writeProfile(declaration, testInfo.outputDir));
      await expect(configurationProfiles.itemByName(declaration.name)).toContainText('macOS, iOS, iPadOS (declaration)');
      uuid = (await findProfileByName(request, 0, declaration.name))?.uuid;
      expect(uuid, `${declaration.name} was not stored`).toBeTruthy();

      await waitForHostProfileStatus(request, vm.id, uuid!, ['verified']);
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(declaration.name)).toContainText('Verified');

      await configurationProfiles.goto();
      await configurationProfiles.deleteProfile(declaration.name);
      await waitForHostProfileGone(request, vm.id, uuid!);
      uuid = undefined;
    } finally {
      if (uuid) await deleteProfile(request, uuid);
    }
  });
});
