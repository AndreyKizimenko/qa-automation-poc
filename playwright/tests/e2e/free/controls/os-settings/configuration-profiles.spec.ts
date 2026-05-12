/**
 * Configuration profiles upload/download/delete on free — no team dropdown.
 * Each (OS) case runs as its own serial describe so a per-step failure
 * points at the broken action; a final test confirms the dashboard
 * activity feed surfaces both lifecycle entries.
 *
 * Profiles have no in-UI edit step — the lifecycle is upload + delete only.
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

for (const profile of PROFILE_CASES) {
  test.describe(`MDM • OS settings — configuration profiles — ${profile.os}`, { tag: '@free' }, () => {
    test.describe.configure({ mode: 'serial' });

    // Free has no team scoping — the feed uses "all <hostsPhrase>".
    const scopeSuffix = `all ${profile.hostsPhrase}`;

    test('upload', async ({ dashboard, controls, osSettings, configurationProfiles, request }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();

      // Defensive: a prior failed run may have left the profile behind.
      await configurationProfiles.deleteIfExists(profile.displayName);

      await configurationProfiles.uploadProfile(profile.filePath);
      await expect(configurationProfiles.itemByName(profile.displayName)).toBeVisible();
      await assertActivity(request, profile.createActivity, (d) => d.profile_name === profile.displayName);
    });

    test('download matches source', async ({ configurationProfiles }) => {
      await configurationProfiles.goto();
      const download = await configurationProfiles.downloadProfile(profile.displayName);
      const downloadedPath = await download.path();
      const downloadedBody = fs.readFileSync(downloadedPath, 'utf-8');
      const originalBody = fs.readFileSync(profile.filePath, 'utf-8');
      expect(downloadedBody).toBe(originalBody);
    });

    test('delete', async ({ configurationProfiles, request }) => {
      await configurationProfiles.goto();
      await configurationProfiles.deleteProfile(profile.displayName);
      await expect(configurationProfiles.itemByName(profile.displayName)).toBeHidden();
      await assertActivity(request, profile.deleteActivity, (d) => d.profile_name === profile.displayName);
    });

    test('activity feed shows upload → delete', async ({ dashboard }) => {
      await dashboard.goto();
      await dashboard.expectActivities([
        new RegExp(`added configuration profile ${profile.displayName} to ${scopeSuffix}\\.`),
        new RegExp(`deleted configuration profile ${profile.displayName} from ${scopeSuffix}\\.`),
      ]);
    });
  });
}
