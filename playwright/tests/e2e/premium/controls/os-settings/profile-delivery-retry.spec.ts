/**
 * Premium • Controls • Configuration profiles — a profile's life on one host:
 * the commands that carry it, a resend, and what Fleet does when the host
 * refuses it.
 *
 * Three cases, on the real macOS VM:
 *
 *  - the host's Activity card, with "Show MDM commands" on, names the profile in
 *    the InstallProfile that delivered it and the RemoveProfile that took it
 *    away — "The InstallProfile command for <name> was acknowledged.";
 *  - **Resend** on the host's Controls tab sends a verified profile again: a
 *    second InstallProfile, acknowledged, and back to verified;
 *  - a profile the Mac refuses is retried — Fleet sends it once and then
 *    `MaxAppleProfileRetries` (3) more times (`server/mdm/mdm.go`) — and then
 *    reads **Failed**; the retries themselves are counted, not only the end
 *    state.
 *
 * Each profile targets a manual label holding only the VM, so no borrowed
 * simulation on the fleet gets it. The inert one is `inertMobileconfig`; the
 * refused one is `rejectedMobileconfig` — a Wi-Fi payload with no SSID, which
 * macOS rejects without applying anything. Both approved for the VMs.
 *
 * Every assertion about a command is scoped to this run's profile by name, so
 * counting them counts only our own. Counts come from the API; the Activity card
 * is asserted to show the newest one, because it pages its feed and other specs
 * send the same Mac commands at the same time.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  createManualLabel,
  deleteLabelById,
  deleteProfile,
  getHostDetailUpdatedAt,
  listHostMdmCommands,
  requireRealHost,
  uploadProfile,
  waitForHostProfileGone,
  waitForHostProfileStatus,
  waitForHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';
import { inertMobileconfig, rejectedMobileconfig, runNonce } from '@helpers/profiles';

/** How many InstallProfile commands one refused profile gets: the first, then Fleet's retries. */
const INSTALL_ATTEMPTS = 1 + 3;

test.describe('Premium • Controls • Configuration profiles — delivery on one host', () => {
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  test('a profile is installed, resent and removed by commands the host names it in', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const n = runNonce();
    const labelName = `pw-rt-${n}`;
    const profile = inertMobileconfig(`pw-rt-${n}-p`);
    let labelId: number | undefined;
    let uuid: string | undefined;

    const installs = async () =>
      (await listHostMdmCommands(request, vm.id, 'InstallProfile')).filter((c) => c.name === profile.name);

    try {
      labelId = await createManualLabel(request, labelName, [vm.id]);
      uuid = await uploadProfile(request, vmsFleetId, profile, { includeAny: [labelName] });

      // Installed and verified: acknowledged on the device, then seen there by its next collection.
      await waitForHostProfileStatus(request, vm.id, uuid, ['verifying', 'verified']);
      await waitForNoPendingRefetch(request, vm.id);
      await waitForHostRefetch(request, vm.id, { since: await getHostDetailUpdatedAt(request, vm.id), refetch: true });
      await waitForHostProfileStatus(request, vm.id, uuid, ['verified'], 180_000);

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

      // Resend from the Controls tab: a second InstallProfile, acknowledged, and verified again.
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
      await waitForNoPendingRefetch(request, vm.id);
      await waitForHostRefetch(request, vm.id, { since: await getHostDetailUpdatedAt(request, vm.id), refetch: true });
      await waitForHostProfileStatus(request, vm.id, uuid, ['verified'], 180_000);

      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toContainText('Verified');

      // Removed: deleting the profile sends a RemoveProfile the host names it in.
      await deleteProfile(request, uuid);
      await waitForHostProfileGone(request, vm.id, uuid);
      uuid = undefined;
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
      if (labelId !== undefined) await deleteLabelById(request, labelId);
    }
  });

  test('a profile the host refuses is retried three times, then reads Failed', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const n = runNonce();
    const labelName = `pw-rt-${n}-bad`;
    const profile = rejectedMobileconfig(`pw-rt-${n}-bad`);
    let labelId: number | undefined;
    let uuid: string | undefined;

    try {
      labelId = await createManualLabel(request, labelName, [vm.id]);
      uuid = await uploadProfile(request, vmsFleetId, profile, { includeAny: [labelName] });

      await waitForHostProfileStatus(request, vm.id, uuid, ['failed'], 480_000);
      const installs = (await listHostMdmCommands(request, vm.id, 'InstallProfile')).filter(
        (c) => c.name === profile.name,
      );
      expect(installs.map((c) => c.status), `${profile.name}'s InstallProfile commands`).toEqual(
        Array(INSTALL_ATTEMPTS).fill('Error'),
      );

      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toContainText('Failed');
      await hostDetails.detailsTab.click();
      await hostDetails.showPastActivities();
      await hostDetails.showMdmCommands(true);
      await expect(
        hostDetails
          .activityItem(activityCopy.mdmCommand.forProfile({ requestType: 'InstallProfile', name: profile.name, status: 'failed' }))
          .first(),
      ).toBeVisible();
    } finally {
      if (uuid) await deleteProfile(request, uuid);
      if (labelId !== undefined) await deleteLabelById(request, labelId);
    }
  });
});
