/**
 * Configuration profiles upload/download/delete on the smoke fleet, for
 * both macOS (.mobileconfig — name comes from PayloadDisplayName) and
 * Windows (.xml — name is the filename without extension).
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';

interface ProfileCase {
  os: 'macOS' | 'Windows';
  fileName: string;
  filePath: string;
  /** Name shown in the profile list after upload. */
  displayName: string;
}

const PROFILE_CASES: ProfileCase[] = [
  {
    os: 'macOS',
    fileName: 'fleet-test-passcode.mobileconfig',
    filePath: path.resolve(
      __dirname,
      '../../../../test-data/apple/macos/profiles/fleet-test-passcode.mobileconfig',
    ),
    displayName: 'Fleet Test Passcode',
  },
  {
    os: 'Windows',
    fileName: 'fleet-test-screenlock.xml',
    filePath: path.resolve(
      __dirname,
      '../../../../test-data/windows/profiles/fleet-test-screenlock.xml',
    ),
    displayName: 'fleet-test-screenlock',
  },
];

test.describe('MDM • OS settings — configuration profiles', () => {
  for (const profile of PROFILE_CASES) {
    test(`${profile.os} — upload → download → delete (smoke fleet)`, async ({
      dashboard,
      controls,
      osSettings,
      configurationProfiles,
      mdmFleet,
    }) => {
      await dashboard.goto({ fleetId: mdmFleet.id });
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();

      await configurationProfiles.deleteIfExists(profile.displayName);

      await configurationProfiles.uploadProfile(profile.filePath);
      await expect(configurationProfiles.itemByName(profile.displayName)).toBeVisible();

      const download = await configurationProfiles.downloadProfile(profile.displayName);
      const downloadedPath = await download.path();
      const downloadedBody = fs.readFileSync(downloadedPath, 'utf-8');
      const originalBody = fs.readFileSync(profile.filePath, 'utf-8');
      expect(downloadedBody).toBe(originalBody);

      await configurationProfiles.deleteProfile(profile.displayName);
    });
  }
});
