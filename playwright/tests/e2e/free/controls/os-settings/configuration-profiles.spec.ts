/**
 * Configuration profiles upload/download/delete on free — no team dropdown.
 * Each (OS) case runs as its own serial describe so a per-step failure
 * points at the broken action; a final test confirms the dashboard
 * activity feed surfaces both lifecycle entries.
 *
 * **Any upload here can reach the real VMs.** Free has no fleets, so Unassigned
 * is where the MDM-enrolled macOS and Windows VMs are, and Fleet's profile
 * reconciler sends them whatever it finds every 30 s — the upload → delete window
 * races that tick rather than avoiding it. Only the inert pair (test-data/…/profiles
 * READMEs) may ever be uploaded by this spec: a custom preference domain nothing
 * reads, and Game DVR off.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';

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
    fileName: 'fleet-pw-inert.mobileconfig',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/apple/macos/profiles/fleet-pw-inert.mobileconfig',
    ),
    displayName: 'Fleet Playwright Inert',
    createActivity: 'created_macos_profile',
    deleteActivity: 'deleted_macos_profile',
    hostsPhrase: 'macOS, iOS, and iPadOS hosts',
  },
  {
    os: 'Windows',
    fileName: 'fleet-pw-inert.xml',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/windows/profiles/fleet-pw-inert.xml',
    ),
    displayName: 'fleet-pw-inert',
    createActivity: 'created_windows_profile',
    deleteActivity: 'deleted_windows_profile',
    hostsPhrase: 'Windows hosts',
  },
];

for (const profile of PROFILE_CASES) {
  test.describe(`MDM • OS settings — configuration profiles — ${profile.os}`, () => {
    test.describe.configure({ mode: 'serial' });

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
        activityCopy.configurationProfile.added({ name: profile.displayName, hostsPhrase: profile.hostsPhrase }),
        activityCopy.configurationProfile.deleted({ name: profile.displayName, hostsPhrase: profile.hostsPhrase }),
      ]);
    });
  });
}
