/**
 * Premium • Controls • OS updates — the Windows target.
 *
 * Windows' form has two fields, **Days after release** (the deadline, 0–30) and **Grace period** (0–7), saved
 * as the fleet's `mdm.windows_updates` (`deadline_days`, `grace_period_days`; `WindowsTargetForm.tsx`):
 *
 *  - both save, read back after a reload and through the API, mark the Windows tab configured, and clear again
 *    when both are emptied ("Both empty is valid", the form's own word for no enforcement). While Workstations
 *    holds the setting, Unassigned's (the global config) and the QA fleet's read back as they did before: the
 *    setting belongs to the fleet it's saved on;
 *  - the form refuses a deadline or grace period out of range, a grace period without a deadline and a deadline
 *    without one, saying why in place of the field's label, and saves nothing.
 *
 * **Settings only.** What the deadline does to a host (Windows Update's own deadline, then a restart) needs a
 * Windows host that may update and restart, which the lab doesn't offer a run: the release checklist keeps that
 * on a device (`docs/release-smokes-plan.md`, P1.6).
 *
 * **Workstations only, and `exclusive/`.** A deadline on a fleet with real hosts makes them update and restart;
 * Workstations holds none. This spec, `macos-updates.spec.ts` and `ddm-conflict.spec.ts` set and clear the same
 * Workstations OS update settings, so all three run in the single-worker `premium-exclusive` project, one test
 * at a time. Each test clears the setting after itself (the `cleanup` fixture), and so does the Workstations wipe
 * in `setup/cleanup.steps.ts`. Run one with
 * `npx playwright test --project=premium-exclusive windows-updates --no-deps`.
 */
import { test, expect } from '@fixtures';
import { clearFleetOsUpdates, getAppConfig, getFleetOsUpdates } from '@helpers/api';
import { toastCopy } from '@helpers/toast-copy';

const NOTHING_ENFORCED = { deadlineDays: null, gracePeriodDays: null };

test.describe('Premium • Controls • OS updates — Windows', () => {
  test('a deadline and grace period save, persist, and clear again', async ({
    osUpdates,
    workstationsFleetId,
    qaFleetId,
    request,
    page,
    cleanup,
  }) => {
    expect((await getFleetOsUpdates(request, workstationsFleetId)).windows, 'Workstations should enforce nothing to begin with').toEqual(
      NOTHING_ENFORCED,
    );
    cleanup.add('clear Workstations OS updates', (r) => clearFleetOsUpdates(r, workstationsFleetId));
    // Reads only: the other scopes are compared, never written.
    const unassignedBefore = (await getAppConfig(request)).mdm?.windows_updates;
    const qaBefore = (await getFleetOsUpdates(request, qaFleetId)).windows;
    // Neither already holds these values, so a save that reached one would show.
    const saved = { deadlineDays: 5, gracePeriodDays: 2 };
    expect(qaBefore).not.toEqual(saved);

    await osUpdates.goto({ fleetId: workstationsFleetId });
    await osUpdates.teamDropdown.select('Workstations');
    await osUpdates.openPlatform('Windows');
    await expect(osUpdates.windowsDeadlineDaysInput()).toHaveValue('');
    await expect(osUpdates.windowsGracePeriodInput()).toHaveValue('');
    await expect(osUpdates.platformConfigured('Windows')).toHaveCount(0);

    await osUpdates.windowsDeadlineDaysInput().fill(String(saved.deadlineDays));
    await osUpdates.windowsGracePeriodInput().fill(String(saved.gracePeriodDays));
    await osUpdates.saveButton('Windows').click();
    await osUpdates.toast.expectSuccess(toastCopy.osUpdates.windowsUpdated);
    await expect.poll(async () => (await getFleetOsUpdates(request, workstationsFleetId)).windows).toEqual(saved);
    await expect(osUpdates.platformConfigured('Windows')).toBeVisible();
    expect((await getAppConfig(request)).mdm?.windows_updates, "Unassigned's Windows updates").toEqual(unassignedBefore);
    expect((await getFleetOsUpdates(request, qaFleetId)).windows, "the QA fleet's Windows updates").toEqual(qaBefore);

    // It reads back after a reload.
    await page.reload();
    await osUpdates.teamDropdown.select('Workstations');
    await osUpdates.openPlatform('Windows');
    await expect(osUpdates.windowsDeadlineDaysInput()).toHaveValue(String(saved.deadlineDays));
    await expect(osUpdates.windowsGracePeriodInput()).toHaveValue(String(saved.gracePeriodDays));

    // Both emptied clears it.
    await osUpdates.windowsDeadlineDaysInput().fill('');
    await osUpdates.windowsGracePeriodInput().fill('');
    await osUpdates.saveButton('Windows').click();
    await osUpdates.toast.expectSuccess(toastCopy.osUpdates.windowsUpdated);
    await expect.poll(async () => (await getFleetOsUpdates(request, workstationsFleetId)).windows).toEqual(NOTHING_ENFORCED);
    await expect(osUpdates.platformConfigured('Windows')).toHaveCount(0);
  });

  test('a deadline or grace period out of range, or one without the other, is refused, and nothing saves', async ({
    osUpdates,
    workstationsFleetId,
    request,
    cleanup,
  }) => {
    cleanup.add('clear Workstations OS updates', (r) => clearFleetOsUpdates(r, workstationsFleetId));
    await osUpdates.goto({ fleetId: workstationsFleetId });
    await osUpdates.teamDropdown.select('Workstations');
    await osUpdates.openPlatform('Windows');
    const deadline = osUpdates.windowsDeadlineDaysInput();
    const grace = osUpdates.windowsGracePeriodInput();
    const save = osUpdates.saveButton('Windows');

    // Out of range: 0–30 and 0–7.
    await deadline.fill('31');
    await grace.fill('8');
    await save.click();
    await expect(osUpdates.windowsFieldError('Deadline must meet criteria below.')).toBeVisible();
    await expect(osUpdates.windowsFieldError('Grace period must meet criteria below.')).toBeVisible();

    // A grace period with no deadline.
    await deadline.fill('');
    await grace.fill('2');
    await save.click();
    await expect(osUpdates.windowsFieldError('Grace period must be empty if no deadline is set.')).toBeVisible();

    // A deadline with no grace period.
    await deadline.fill('3');
    await grace.fill('');
    await save.click();
    await expect(osUpdates.windowsFieldError('The grace period days is required.')).toBeVisible();

    expect((await getFleetOsUpdates(request, workstationsFleetId)).windows).toEqual(NOTHING_ENFORCED);
  });
});
