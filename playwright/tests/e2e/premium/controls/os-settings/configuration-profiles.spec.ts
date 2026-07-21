/**
 * Configuration profiles upload/download/delete on premium — runs the
 * macOS .mobileconfig + Windows .xml cases under both scopes (Unassigned
 * + Workstations). Profiles have no in-UI edit step — the lifecycle is
 * upload + delete only.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';
import { fleetIdFor } from '@helpers/team-scope';
import type { TeamScope } from '@pages';

interface ProfileCase {
  os: 'macOS' | 'Windows';
  fileName: string;
  filePath: string;
  displayName: string;
  createActivity: string;
  deleteActivity: string;
  /** OS-specific platform phrase the feed embeds in the scope suffix. */
  hostsPhrase: string;
}

const PROFILE_CASES: ProfileCase[] = [
  {
    os: 'macOS',
    fileName: 'fleet-test-passcode.mobileconfig',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/apple/macos/profiles/fleet-test-passcode.mobileconfig',
    ),
    displayName: 'Fleet Test Passcode',
    createActivity: 'created_macos_profile',
    deleteActivity: 'deleted_macos_profile',
    hostsPhrase: 'macOS, iOS, and iPadOS hosts',
  },
  {
    os: 'Windows',
    fileName: 'fleet-test-screenlock.xml',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/windows/profiles/fleet-test-screenlock.xml',
    ),
    displayName: 'fleet-test-screenlock',
    createActivity: 'created_windows_profile',
    deleteActivity: 'deleted_windows_profile',
    hostsPhrase: 'Windows hosts',
  },
];

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  for (const profile of PROFILE_CASES) {
    test.describe(`MDM • OS settings — configuration profiles (${scope}) — ${profile.os}`, () => {
      test.describe.configure({ mode: 'serial' });

      test('upload', async ({ dashboard, controls, osSettings, configurationProfiles, request }) => {
        await dashboard.goto();
        await dashboard.navbar.goToControls();
        await controls.goToOsSettings();
        await osSettings.goToConfigurationProfiles();
        await configurationProfiles.teamDropdown.select(scope);

        // Defensive: a prior failed run may have left the profile behind.
        await configurationProfiles.deleteIfExists(profile.displayName);

        await configurationProfiles.uploadProfile(profile.filePath);
        await expect(configurationProfiles.itemByName(profile.displayName)).toBeVisible();
        await assertActivity(request, profile.createActivity, (d) => d.profile_name === profile.displayName);
      });

      test('download matches source', async ({ configurationProfiles, workstationsFleetId }) => {
        await configurationProfiles.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
        await configurationProfiles.teamDropdown.select(scope);
        const download = await configurationProfiles.downloadProfile(profile.displayName);
        const downloadedPath = await download.path();
        const downloadedBody = fs.readFileSync(downloadedPath, 'utf-8');
        const originalBody = fs.readFileSync(profile.filePath, 'utf-8');
        expect(downloadedBody).toBe(originalBody);
      });

      test('delete', async ({ configurationProfiles, request, workstationsFleetId }) => {
        await configurationProfiles.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
        await configurationProfiles.teamDropdown.select(scope);
        await configurationProfiles.deleteProfile(profile.displayName);
        await expect(configurationProfiles.itemByName(profile.displayName)).toBeHidden();
        await assertActivity(request, profile.deleteActivity, (d) => d.profile_name === profile.displayName);
      });

      test('activity feed shows upload → delete', async ({ dashboard }) => {
        await dashboard.goto();
        await dashboard.expectActivities([
          activityCopy.configurationProfile.added({ name: profile.displayName, hostsPhrase: profile.hostsPhrase, scope }),
          activityCopy.configurationProfile.deleted({ name: profile.displayName, hostsPhrase: profile.hostsPhrase, scope }),
        ]);
      });
    });
  }
}

// Fleet signs profiles itself, so a pre-signed (PKCS7/CMS) .mobileconfig is
// rejected on upload. Negative path, so it lives in its own describe outside
// the per-scope CRUD lifecycle above. The signed fixture is generated with
// openssl (see test-data/apple/macos/profiles/README).
test.describe('MDM • OS settings — configuration profile upload validation', () => {
  const signedProfile = path.resolve(
    __dirname,
    '../../../../../test-data/apple/macos/profiles/fleet-test-signed.mobileconfig',
  );

  test('rejects a signed .mobileconfig with a "can\'t be signed" error', async ({
    dashboard,
    controls,
    osSettings,
    configurationProfiles,
    pageHealth,
  }) => {
    // The rejection is a deliberate 4xx that the app may log to the console.
    pageHealth.disable();

    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToOsSettings();
    await osSettings.goToConfigurationProfiles();
    await configurationProfiles.teamDropdown.select('Unassigned');

    await configurationProfiles.submitProfileUpload(signedProfile);
    await configurationProfiles.toast.expectError(/Configuration profiles can't be signed/);
  });
});
