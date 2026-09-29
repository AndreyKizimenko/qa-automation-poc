/**
 * Premium • Hosts • Recovery Lock password, end to end on the real Mac.
 *
 * Controls → OS settings → Passwords turns on *Recovery Lock password* for the
 * VMs fleet; Fleet's 30-second `send_recovery_lock_commands` cron sends the
 * Mac a `SetRecoveryLock` with a generated password, the Mac confirms, and the
 * host's Controls tab reads *Verified*. From the host's Actions, *Show Recovery
 * Lock password* reveals the escrowed password and says when Fleet will rotate
 * it on its own; *Rotate password* sets a new one on the Mac. Turning the
 * setting off makes Fleet clear the password from the Mac. Every step is
 * checked in the API and in the activity log, and the host's Activity card
 * shows the per-host ones.
 *
 * **Why this is safe on the VM (approved by Andrey, 2026-09-29).** Recovery
 * Lock only guards entry to macOS Recovery: it doesn't touch login, SSH or the
 * MDM channel. The password is escrowed in Fleet, and turning enforcement off
 * sends `ClearRecoveryLock`, so the Mac ends as it began. This is the only spec
 * that turns it on for the VMs fleet; its `afterEach` turns it off, and the
 * resting-state step in `setup/cleanup.steps.ts` turns it off after a run that
 * died first — Fleet then clears the password on its next cron tick.
 *
 * **Views have side effects.** Opening the modal is a read of the password:
 * Fleet records a `viewed_host_recovery_lock_password` activity and schedules an
 * automatic rotation an hour out. The test opens it twice (before and after the
 * rotation) and reads status through `GET /hosts/:id` in between, which is not a
 * view. Clearing the password drops the scheduled rotation.
 *
 * **Activities.** Identical activities from earlier runs are in the log, so each
 * one must be newer than the log's last entry before its step
 * (`assertActivityAfter`). The host's Activity card is read for the three
 * per-host ones — set, viewed, rotated — right after each happens: it shows 8
 * per page, and the VM specs running alongside push older entries off it.
 *
 * **Simulations borrowed onto VMs.** A label-targeting spec may have MDM-enrolled
 * simulations on the VMs fleet while this runs; Fleet queues a `SetRecoveryLock`
 * for them too, which they never answer. Nothing here reads them, and the clear
 * drops what was queued once enforcement is off.
 *
 * Budget: each step waits on the Mac, typically well under a minute after the
 * cron tick. The waits allow 4 minutes each; the first (a dead run's clear)
 * normally returns at once, so the other four fit the 25-minute timeout with
 * room for the UI. Enforcement is turned off in an `afterEach`, which runs even
 * after a timeout (a `finally` inside the test wouldn't).
 */
import { test, expect } from '@fixtures';
import {
  assertActivityAfter,
  getFleetRecoveryLock,
  getHostFleetId,
  latestActivityId,
  setFleetRecoveryLock,
  waitForRecoveryLockStatus,
} from '@helpers/api';

const MAC_WAIT = 4 * 60_000;
const ADMIN = process.env.FLEET_ADMIN_EMAIL;

test.describe('Premium • Hosts • Recovery Lock password', () => {
  test.afterEach(async ({ request, vmsFleetId }) => {
    await setFleetRecoveryLock(request, vmsFleetId, false);
  });

  test('enforce on the VMs fleet, verify, view, rotate and clear on the Mac', async ({
    dashboard,
    controls,
    osSettings,
    passwords,
    hostDetails,
    liveMacosHost,
    vmsFleetId,
    request,
  }) => {
    test.setTimeout(25 * 60_000);
    const hostId = liveMacosHost.id;
    const modal = hostDetails.recoveryLockModal;
    const forThisHost = (d: Record<string, unknown>) => d.host_id === hostId;
    const forVms = (d: Record<string, unknown>) => (d.fleet_id ?? d.team_id) === vmsFleetId;
    /** Reloads the host and reads its newest past activities for one line of Fleet's copy. */
    const expectHostActivity = async (copy: RegExp) => {
      await hostDetails.goto(hostId);
      await hostDetails.showPastActivities();
      await expect(hostDetails.activityItem(copy).first()).toBeVisible();
    };

    // Enforcement is per fleet: the Mac has to be on the fleet this turns it on for.
    expect(await getHostFleetId(request, hostId), 'the real Mac should be on the VMs fleet').toBe(vmsFleetId);
    expect(
      await getFleetRecoveryLock(request, vmsFleetId),
      'the VMs fleet should start with Recovery Lock off — the resting-state step turns it off',
    ).toBe(false);
    // A dead run's password may still be clearing.
    await waitForRecoveryLockStatus(request, hostId, null, MAC_WAIT);

    // ── Enforce ────────────────────────────────────────────────────────────
    let before = await latestActivityId(request);
    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToOsSettings();
    await osSettings.goToPasswords();
    await passwords.teamDropdown.selectByLabel('VMs');
    await expect(passwords.recoveryLockCheckbox).not.toBeChecked();
    await passwords.setRecoveryLock(true);

    await passwords.goto({ fleetId: vmsFleetId });
    await passwords.teamDropdown.selectByLabel('VMs');
    await expect(passwords.recoveryLockCheckbox).toBeChecked();
    expect(await getFleetRecoveryLock(request, vmsFleetId)).toBe(true);
    await assertActivityAfter(request, 'enabled_recovery_lock_passwords', before, forVms, { actor: ADMIN });

    // ── Fleet sets it on the Mac ───────────────────────────────────────────
    const set = await waitForRecoveryLockStatus(request, hostId, 'verified', MAC_WAIT);
    expect(set.passwordAvailable).toBe(true);
    // Fleet itself is the actor: its cron set the password, not a user.
    await assertActivityAfter(request, 'set_host_recovery_lock_password', before, forThisHost, { actor: null });
    await expectHostActivity(/set a Recovery Lock password for this host/);

    await hostDetails.openControlsTab();
    await expect(hostDetails.controlRow('Recovery Lock password')).toContainText('Verified');

    // ── View ───────────────────────────────────────────────────────────────
    before = await latestActivityId(request);
    await hostDetails.runAction('Show Recovery Lock password');
    await expect(modal.modal).toBeVisible();
    const firstPassword = await modal.revealPassword();
    // Viewing schedules Fleet's own rotation, and the modal says when.
    await expect(modal.autoRotateBanner).toBeVisible();
    await assertActivityAfter(request, 'viewed_host_recovery_lock_password', before, forThisHost, {
      actor: ADMIN,
    });

    // ── Rotate ─────────────────────────────────────────────────────────────
    before = await latestActivityId(request);
    await expect(modal.rotateButton).toBeVisible();
    await modal.rotateButton.click();
    await hostDetails.toast.expectSuccess('Successfully sent request to rotate Recovery Lock password.');
    await expect(modal.modal).toBeHidden();
    await assertActivityAfter(request, 'rotated_host_recovery_lock_password', before, forThisHost, {
      actor: ADMIN,
    });
    await expectHostActivity(/triggered rotation of the Recovery Lock password for this host/);
    await expect(hostDetails.activityItem(/viewed the Recovery Lock password for this host/).first()).toBeVisible();

    // Fleet marks the password pending inside the rotate request, before the
    // toast above, so this wait can't return on the pre-rotation status.
    await waitForRecoveryLockStatus(request, hostId, 'verified', MAC_WAIT);
    await hostDetails.goto(hostId);
    await hostDetails.runAction('Show Recovery Lock password');
    await expect(modal.modal).toBeVisible();
    const secondPassword = await modal.revealPassword();
    expect(secondPassword, 'the rotated password should differ from the first').not.toBe(firstPassword);
    await modal.close();

    // ── Clear ──────────────────────────────────────────────────────────────
    before = await latestActivityId(request);
    await passwords.goto({ fleetId: vmsFleetId });
    await passwords.teamDropdown.selectByLabel('VMs');
    await passwords.setRecoveryLock(false);
    await passwords.goto({ fleetId: vmsFleetId });
    await passwords.teamDropdown.selectByLabel('VMs');
    await expect(passwords.recoveryLockCheckbox).not.toBeChecked();
    expect(await getFleetRecoveryLock(request, vmsFleetId)).toBe(false);
    await assertActivityAfter(request, 'disabled_recovery_lock_passwords', before, forVms, { actor: ADMIN });

    const cleared = await waitForRecoveryLockStatus(request, hostId, null, MAC_WAIT);
    expect(cleared.passwordAvailable).toBe(false);

    await hostDetails.goto(hostId);
    await hostDetails.openControlsTab();
    await expect(hostDetails.controlRow('Recovery Lock password')).toHaveCount(0);
    // With no password and enforcement off, the action is gone too.
    await hostDetails.openActions();
    await expect(hostDetails.actionOption('Transfer')).toBeVisible();
    await expect(hostDetails.actionOption('Show Recovery Lock password')).toHaveCount(0);
  });
});
