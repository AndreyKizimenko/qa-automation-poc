/**
 * Premium • Controls • OS updates — Fleet's OS update settings and a custom OS
 * update profile can't both be in force on one fleet.
 *
 * Two QA Wolf flows (macOS and Windows), both one direction: with OS updates
 * set, uploading a custom update profile is refused. This spec asserts that
 * direction and the other one they didn't test — with the custom profile in
 * place, setting OS updates is refused — each through the UI a person would
 * use, with Fleet's own copy (`server/fleet/mdm.go`):
 *
 *  - upload refused: "Couldn't add profile. OS updates are already configured.
 *    Remove the OS updates settings first." — and nothing is added;
 *  - settings refused: "Couldn't update OS updates settings. A custom OS updates
 *    declaration profile already exists. Remove the custom profile first."
 *    (Windows: "…A custom OS updates profile already exists…") — and nothing
 *    changes.
 *
 * The custom profiles are the real thing — a DDM
 * `softwareupdate.enforcement.specific` declaration, a Windows profile under the
 * Update CSP (`helpers/profiles.ts`) — because a stand-in wouldn't trip the
 * guard. Delivered to a real host either would force an OS update, so both live
 * only on **Workstations**, which holds no hosts: each test checks that before it
 * uploads anything, and restores the fleet (no OS updates, no profile) in its
 * `finally`, as does the Workstations wipe in `setup/cleanup.steps.ts`.
 *
 * **Why `exclusive/`.** This spec and its sibling (`macos-updates.spec.ts`) set and clear the same
 * Workstations OS update settings. Side by side under `fullyParallel`, one test's
 * `finally` would clear a setting another test is relying on, so both run in the
 * single-worker `premium-exclusive` project, one test at a time, after the main
 * project. Run one with
 * `npx playwright test --project=premium-exclusive ddm-conflict --no-deps`.
 */
import { test, expect } from '@fixtures';
import {
  appleListedMacosVersions,
  clearFleetOsUpdates,
  deleteAllConfigurationProfiles,
  deleteProfile,
  findProfileByName,
  getFleetOsUpdates,
  listFleetHosts,
  setFleetMacosUpdates,
  setFleetWindowsUpdates,
  uploadProfile,
} from '@helpers/api';
import { runNonce, updateEnforcementDeclaration, windowsUpdateProfile, writeProfile } from '@helpers/profiles';

const UPLOAD_REFUSED = "Couldn't add profile. OS updates are already configured. Remove the OS updates settings first.";
const APPLE_SETTINGS_REFUSED =
  "Couldn't update OS updates settings. A custom OS updates declaration profile already exists. Remove the custom profile first.";
const WINDOWS_SETTINGS_REFUSED =
  "Couldn't update OS updates settings. A custom OS updates profile already exists. Remove the custom profile first.";

function futureDate(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

test.describe('Premium • Controls • OS updates — custom update profiles vs OS update settings', () => {
  test.beforeEach(async ({ request, workstationsFleetId }) => {
    const real = (await listFleetHosts(request, workstationsFleetId)).filter((h) => h.real);
    expect(real.map((h) => h.id), 'Workstations must hold no real host: these profiles force OS updates').toEqual([]);
    // A run that died mid-test leaves its update profile, which refuses the OS
    // update settings the next run sets. The Workstations wipe clears it too.
    await deleteAllConfigurationProfiles(request, workstationsFleetId, (name) => name.startsWith('pw-ddm-'));
    await clearFleetOsUpdates(request, workstationsFleetId);
  });

  test('macOS: a software-update declaration and a minimum version refuse each other', async ({
    dashboard,
    controls,
    osSettings,
    osUpdates,
    configurationProfiles,
    workstationsFleetId,
    request,
    pageHealth,
  }, testInfo) => {
    // The refusals are deliberate 400s the app logs to the console.
    pageHealth.disable();
    const [version] = await appleListedMacosVersions(request);
    const declaration = updateEnforcementDeclaration(`pw-ddm-${runNonce()}`, {
      version,
      localDateTime: `${futureDate(60)}T12:00:00`,
      noRealHostsOnFleet: true,
    });
    let uuid: string | undefined;

    try {
      // OS updates set → the declaration is refused.
      await setFleetMacosUpdates(request, workstationsFleetId, { minimumVersion: version, deadline: futureDate(60) });
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();
      await configurationProfiles.teamDropdown.select('Workstations');
      await configurationProfiles.submitProfileUpload(writeProfile(declaration, testInfo.outputDir));
      await configurationProfiles.toast.expectError(UPLOAD_REFUSED);
      expect(await findProfileByName(request, workstationsFleetId, declaration.name)).toBeNull();

      // The declaration in place → a minimum version is refused.
      await clearFleetOsUpdates(request, workstationsFleetId);
      uuid = await uploadProfile(request, workstationsFleetId, declaration);
      await osUpdates.goto({ fleetId: workstationsFleetId });
      await osUpdates.teamDropdown.select('Workstations');
      await osUpdates.openPlatform('macOS');
      await osUpdates.chooseAppleTarget('Custom version');
      await osUpdates.minimumVersionInput().fill(version);
      await osUpdates.deadlineInput().fill(futureDate(60));
      await osUpdates.saveButton('macOS').click();
      await osUpdates.toast.expectError(APPLE_SETTINGS_REFUSED);
      expect((await getFleetOsUpdates(request, workstationsFleetId)).macos.minimumVersion).toBe('');
    } finally {
      if (uuid) await deleteProfile(request, uuid);
      await clearFleetOsUpdates(request, workstationsFleetId);
    }
  });

  test('Windows: an Update CSP profile and a Windows update deadline refuse each other', async ({
    configurationProfiles,
    osUpdates,
    workstationsFleetId,
    request,
    pageHealth,
  }, testInfo) => {
    pageHealth.disable();
    const profile = windowsUpdateProfile(`pw-ddm-${runNonce()}-win`, { noRealHostsOnFleet: true });
    let uuid: string | undefined;

    try {
      // Windows updates set → the Update CSP profile is refused.
      await setFleetWindowsUpdates(request, workstationsFleetId, { deadlineDays: 3, gracePeriodDays: 3 });
      await configurationProfiles.goto({ fleetId: workstationsFleetId });
      await configurationProfiles.teamDropdown.select('Workstations');
      await configurationProfiles.submitProfileUpload(writeProfile(profile, testInfo.outputDir));
      await configurationProfiles.toast.expectError(UPLOAD_REFUSED);
      expect(await findProfileByName(request, workstationsFleetId, profile.name)).toBeNull();

      // The profile in place → a Windows deadline is refused.
      await clearFleetOsUpdates(request, workstationsFleetId);
      uuid = await uploadProfile(request, workstationsFleetId, profile);
      await osUpdates.goto({ fleetId: workstationsFleetId });
      await osUpdates.teamDropdown.select('Workstations');
      await osUpdates.openPlatform('Windows');
      await osUpdates.windowsDeadlineDaysInput().fill('3');
      await osUpdates.windowsGracePeriodInput().fill('3');
      await osUpdates.saveButton('Windows').click();
      await osUpdates.toast.expectError(WINDOWS_SETTINGS_REFUSED);
      expect((await getFleetOsUpdates(request, workstationsFleetId)).windows).toEqual({
        deadlineDays: null,
        gracePeriodDays: null,
      });
    } finally {
      if (uuid) await deleteProfile(request, uuid);
      await clearFleetOsUpdates(request, workstationsFleetId);
    }
  });
});
