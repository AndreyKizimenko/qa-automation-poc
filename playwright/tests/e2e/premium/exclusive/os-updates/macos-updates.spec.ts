/**
 * Premium • Controls • OS updates — the macOS target.
 *
 * QA Wolf's `controls-macos-updates-ui-validation`: the "Current versions"
 * drill-down, a minimum version and deadline that save and persist, and the
 * End user experience preview — which they asserted with a screenshot. Here:
 *
 *  - **"Custom version"** reveals Minimum version and Deadline; both save, read
 *    back after a reload and through the API, mark the macOS tab configured, and
 *    clear again with "No updates enforced". (QA Wolf's flow never chose "Custom
 *    version" — it passed only because its own leftover setting kept the fleet in
 *    custom mode.)
 *  - the form **refuses** a missing or malformed version or deadline, saying why
 *    where Fleet says it — in place of the field's label — and saves nothing;
 *  - "Current versions" → **View all hosts** opens the hosts list filtered to that
 *    OS version, and every host it lists runs it;
 *  - the preview links to Fleet's OS updates guide (checked by its address — the
 *    external page isn't ours to test) and shows its image.
 *
 * **Workstations only for anything that saves.** A minimum version or deadline
 * on a fleet with real hosts makes them download and install an update;
 * Workstations holds none. Every test restores it to "no updates enforced", and
 * so does the Workstations wipe in `setup/cleanup.steps.ts`. The drill-down reads
 * Unassigned, where the simulations report OS versions; it changes nothing.
 *
 * Fleet only accepts a minimum version Apple lists in its software lookup
 * service — the list rotates, so the version comes from the feed
 * (`appleListedMacosVersions`), and it's the oldest there: the one least able to
 * move a host even if one were on the fleet.
 *
 * **Why `exclusive/`.** This spec and its sibling (`ddm-conflict.spec.ts`) set and clear the same
 * Workstations OS update settings. Side by side under `fullyParallel`, one test's
 * `finally` would clear a setting another test is relying on, so both run in the
 * single-worker `premium-exclusive` project, one test at a time, after the main
 * project. Run one with
 * `npx playwright test --project=premium-exclusive macos-updates --no-deps`.
 */
import { test, expect } from '@fixtures';
import {
  appleListedMacosVersions,
  clearFleetOsUpdates,
  getFleetOsUpdates,
  listHostsRunningOs,
} from '@helpers/api';

/** A deadline a couple of months out, as the form wants it: YYYY-MM-DD. */
function futureDeadline(): string {
  const d = new Date(Date.now() + 60 * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const NOTHING_ENFORCED = { minimumVersion: '', deadline: '', deadlineDays: null };

test.describe('Premium • Controls • OS updates — macOS', () => {
  test('a custom minimum version and deadline save, persist, and clear again', async ({
    dashboard,
    controls,
    osUpdates,
    workstationsFleetId,
    request,
    page,
  }) => {
    expect((await getFleetOsUpdates(request, workstationsFleetId)).macos, 'Workstations should enforce nothing to begin with').toEqual(
      NOTHING_ENFORCED,
    );
    const [version] = await appleListedMacosVersions(request);
    expect(version, 'Apple lists no macOS versions').toBeTruthy();
    const deadline = futureDeadline();

    try {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsUpdates();
      await osUpdates.teamDropdown.select('Workstations');
      await osUpdates.openPlatform('macOS');
      await expect(osUpdates.appleTargetValue()).toHaveText('No updates enforced');
      await expect(osUpdates.minimumVersionInput()).toHaveCount(0);

      await osUpdates.chooseAppleTarget('Custom version');
      await osUpdates.minimumVersionInput().fill(version);
      await osUpdates.deadlineInput().fill(deadline);
      await osUpdates.saveButton('macOS').click();
      await osUpdates.toast.expectSuccess('Successfully updated.');
      expect((await getFleetOsUpdates(request, workstationsFleetId)).macos).toEqual({
        minimumVersion: version,
        deadline,
        deadlineDays: null,
      });
      await expect(osUpdates.platformConfigured('macOS')).toBeVisible();

      // It reads back after a reload.
      await page.reload();
      await osUpdates.teamDropdown.select('Workstations');
      await osUpdates.openPlatform('macOS');
      await expect(osUpdates.appleTargetValue()).toHaveText('Custom version');
      await expect(osUpdates.minimumVersionInput()).toHaveValue(version);
      await expect(osUpdates.deadlineInput()).toHaveValue(deadline);

      // The End user experience preview.
      const preview = osUpdates.endUserPreview('macOS');
      await expect(preview.heading).toBeVisible();
      await expect(preview.learnMore).toHaveAttribute('href', 'https://fleetdm.com/learn-more-about/os-updates');
      await expect(preview.learnMore).toHaveAttribute('target', '_blank');
      await expect(preview.image).toBeVisible();

      // "No updates enforced" clears it.
      await osUpdates.chooseAppleTarget('No updates enforced');
      await osUpdates.saveButton('macOS').click();
      await osUpdates.toast.expectSuccess('Successfully updated.');
      expect((await getFleetOsUpdates(request, workstationsFleetId)).macos).toEqual(NOTHING_ENFORCED);
      await expect(osUpdates.platformConfigured('macOS')).toHaveCount(0);
    } finally {
      await clearFleetOsUpdates(request, workstationsFleetId);
    }
  });

  test('a missing or malformed minimum version or deadline is refused, and nothing saves', async ({
    osUpdates,
    workstationsFleetId,
    request,
  }) => {
    try {
      await osUpdates.goto({ fleetId: workstationsFleetId });
      await osUpdates.teamDropdown.select('Workstations');
      await osUpdates.openPlatform('macOS');
      await osUpdates.chooseAppleTarget('Custom version');

      // Empty.
      await osUpdates.saveButton('macOS').click();
      await expect(osUpdates.fieldError('macOS', 'The minimum version is required.')).toBeVisible();
      await expect(osUpdates.fieldError('macOS', 'The deadline is required.')).toBeVisible();

      // Malformed.
      await osUpdates.minimumVersionInput().fill('not-a-version');
      await osUpdates.deadlineInput().fill('2026/01/01');
      await osUpdates.saveButton('macOS').click();
      await expect(osUpdates.fieldError('macOS', 'Minimum version must meet criteria below.')).toBeVisible();
      await expect(osUpdates.fieldError('macOS', 'Deadline must meet criteria below.')).toBeVisible();

      expect((await getFleetOsUpdates(request, workstationsFleetId)).macos).toEqual(NOTHING_ENFORCED);
    } finally {
      await clearFleetOsUpdates(request, workstationsFleetId);
    }
  });

  test('"View all hosts" on a current version lists exactly the hosts running it', async ({
    osUpdates,
    hostsList,
    request,
    page,
  }) => {
    await osUpdates.goto({ fleetId: 0 });
    await osUpdates.teamDropdown.select('Unassigned');
    await expect(osUpdates.table.firstRow).toBeVisible();
    await osUpdates.viewHostsForOsType('macOS');

    await expect(page).toHaveURL(/\/hosts\/manage/);
    const url = new URL(page.url());
    const osName = url.searchParams.get('os_name');
    const osVersion = url.searchParams.get('os_version');
    expect(osName && osVersion, `the drill-down URL carries no OS filter: ${page.url()}`).toBeTruthy();
    await expect(hostsList.table.firstRowWithLink).toBeVisible();

    // Every host the filter lists runs exactly that version, and it lists some.
    const running = await listHostsRunningOs(request, 0, osName!, osVersion!);
    expect(running.length, `no hosts listed for ${osName} ${osVersion}`).toBeGreaterThan(0);
    expect([...new Set(running.map((h) => h.os))]).toEqual([`${osName} ${osVersion}`]);
  });
});
