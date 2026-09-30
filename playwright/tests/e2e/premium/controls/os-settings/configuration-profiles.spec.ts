/**
 * Configuration profiles upload/download/delete on premium — runs the
 * macOS .mobileconfig + Windows .xml cases under both scopes (Unassigned
 * + Workstations). Editing a profile's target belongs to the label-targeting
 * specs; this one is the library lifecycle, plus one delivery.
 *
 * Neither lifecycle scope holds a real VM on premium, so nothing uploaded there
 * reaches one. The fixtures are the inert pair all the same (test-data/…/profiles
 * READMEs): the free copy of this spec delivers every upload to the VMs.
 *
 * The delivery case is QA Wolf's "upload and remove": a profile with the default
 * target, **All hosts**, uploaded to the VMs fleet, verified on the real Mac and
 * read back on it, then deleted through the UI and gone from the device. Its
 * profile is generated inert with a name of its own, so the VMs sweep in
 * `setup/cleanup.steps.ts` can find it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  assertActivity,
  deleteProfile,
  findProfileByName,
  getHostDetailUpdatedAt,
  readManagedPreferenceDomain,
  requireRealHost,
  waitForHostProfileGone,
  waitForHostProfileStatus,
  waitForHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';
import { inertMobileconfig, runNonce, writeProfile } from '@helpers/profiles';
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
    '../../../../../test-data/apple/macos/profiles/fleet-pw-inert-signed.mobileconfig',
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

test.describe('MDM • OS settings — a profile for all hosts, delivered and removed (VMs fleet)', () => {
  test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES });

  test('the macOS VM installs and verifies it, and loses it when it is deleted', async ({
    dashboard,
    controls,
    osSettings,
    configurationProfiles,
    hostDetails,
    vmsFleetId,
    request,
  }, testInfo) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const profile = inertMobileconfig(`pw-cp-${runNonce()}`);
    let uuid: string | undefined;

    try {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();
      await configurationProfiles.teamDropdown.selectByLabel('VMs');
      // No target chosen: the modal's default is All hosts.
      await configurationProfiles.uploadProfile(writeProfile(profile, testInfo.outputDir));
      await expect(configurationProfiles.itemByName(profile.name)).toContainText('macOS, iOS, iPadOS');
      await expect(configurationProfiles.labelCount(profile.name)).toHaveCount(0);
      uuid = (await findProfileByName(request, vmsFleetId, profile.name))?.uuid;
      expect(uuid, `${profile.name} was not stored on the VMs fleet`).toBeTruthy();

      await waitForHostProfileStatus(request, vm.id, uuid!, ['verifying', 'verified']);
      await waitForNoPendingRefetch(request, vm.id);
      await waitForHostRefetch(request, vm.id, { since: await getHostDetailUpdatedAt(request, vm.id), refetch: true });
      await waitForHostProfileStatus(request, vm.id, uuid!, ['verified'], 180_000);
      expect(await readManagedPreferenceDomain(request, vm.id, profile.domain)).toEqual({ Marker: profile.marker });
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toContainText('Verified');

      await configurationProfiles.goto({ fleetId: vmsFleetId });
      await configurationProfiles.teamDropdown.selectByLabel('VMs');
      await configurationProfiles.deleteProfile(profile.name);
      await waitForHostProfileGone(request, vm.id, uuid!);
      uuid = undefined;
      await expect
        .poll(() => readManagedPreferenceDomain(request, vm.id, profile.domain), {
          message: `${profile.name}'s domain stayed on the VM after the profile was deleted`,
          timeout: 120_000,
          intervals: [10_000],
        })
        .toEqual({});
    } finally {
      if (uuid) await deleteProfile(request, uuid);
    }
  });
});
