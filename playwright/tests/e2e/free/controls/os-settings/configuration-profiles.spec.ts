/**
 * Configuration profiles upload/download/delete on free — no team dropdown.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';

interface ProfileCase {
  os: 'macOS' | 'Windows';
  fileName: string;
  filePath: string;
  displayName: string;
  createActivity: string;
  deleteActivity: string;
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
  },
];

test.describe('MDM • OS settings — configuration profiles', { tag: '@free' }, () => {
  for (const profile of PROFILE_CASES) {
    test(`${profile.os} — upload → download → delete`, async ({
      dashboard,
      controls,
      osSettings,
      configurationProfiles,
      request,
    }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();

      await configurationProfiles.deleteIfExists(profile.displayName);

      await configurationProfiles.uploadProfile(profile.filePath);
      await expect(configurationProfiles.itemByName(profile.displayName)).toBeVisible();
      await assertActivity(request, profile.createActivity, (d) => d.profile_name === profile.displayName);

      const download = await configurationProfiles.downloadProfile(profile.displayName);
      const downloadedPath = await download.path();
      const downloadedBody = fs.readFileSync(downloadedPath, 'utf-8');
      const originalBody = fs.readFileSync(profile.filePath, 'utf-8');
      expect(downloadedBody).toBe(originalBody);

      await configurationProfiles.deleteProfile(profile.displayName);
      await assertActivity(request, profile.deleteActivity, (d) => d.profile_name === profile.displayName);
    });
  }
});
