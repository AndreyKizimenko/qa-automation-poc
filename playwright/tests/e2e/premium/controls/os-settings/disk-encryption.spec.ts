/**
 * Premium • Controls • disk encryption. Each platform tab under Controls → OS
 * settings → Disk encryption owns its own form and Save button, so the spec
 * drives one control per platform and checks the change survives a reload:
 * enforcement on macOS, key escrow on Linux.
 *
 * Config-only — no host required. Everything here targets the Unassigned scope,
 * and the fleet dropdown is selected after every navigation: the page restores
 * the last-used fleet from localStorage, so without it the spec would read and
 * write some other fleet's settings while comparing them to the global config.
 *
 * The per-platform state is snapshotted and restored via the API in `afterAll`,
 * which runs even on failure. The restore has to be per-platform: the app
 * config's flat `mdm.enable_disk_encryption` is the AND of every platform's
 * setting, and a write to it fans out to all of them.
 *
 * The BitLocker PIN's save is tested apart from the rest, on a throwaway
 * `pw-*` fleet: it saves Windows enforcement with it, and on Unassigned that is
 * the same global setting the tests above snapshot and toggle. A fleet of its
 * own holds no host, needs no restore, and is deleted in the test and again in
 * an `afterEach`.
 *
 * Grounded in frontend/pages/ManageControlsPage/OSSettings/cards/DiskEncryption.
 */
import { test, expect } from '@fixtures';
import {
  createFleet,
  deleteFleet,
  findFleetByName,
  getFleetWindowsDiskEncryption,
  getGlobalDiskEncryption,
  setGlobalDiskEncryption,
  withApiRequest,
  type DiskEncryptionSettings,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';

test.describe('Premium • Controls • disk encryption', () => {
  test.describe.configure({ mode: 'serial' });

  let original: DiskEncryptionSettings;

  test.beforeAll(async () => {
    original = await withApiRequest((request) => getGlobalDiskEncryption(request));
  });

  test.afterAll(async () => {
    if (!original) return;
    await withApiRequest((request) => setGlobalDiskEncryption(request, original));
  });

  test('the sidebar lands on the macOS tab and its enforcement toggle persists', async ({
    dashboard,
    controls,
    osSettings,
    diskEncryption,
  }) => {
    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToOsSettings();
    await osSettings.goToDiskEncryption();
    await diskEncryption.teamDropdown.select('Unassigned');

    // The bare sub-page path carries no platform, so Fleet resolves it to the
    // macOS tab before the form renders.
    await diskEncryption.expectPlatform('macos');
    await expect(diskEncryption.enforceCheckbox).toBeVisible();

    const target = !original.macosEnabled;
    await diskEncryption.enforceCheckbox.setChecked(target);
    await diskEncryption.save();

    await diskEncryption.goto({ fleetId: 0 });
    await diskEncryption.teamDropdown.select('Unassigned');
    await expect(diskEncryption.enforceCheckbox).toBeChecked({ checked: target });

    // Saving one platform leaves the others alone.
    await diskEncryption.selectPlatform('linux');
    await expect(diskEncryption.escrowCheckbox).toBeChecked({
      checked: original.linuxEscrowEnabled,
    });
  });

  test('the Linux tab exposes key escrow only, and it persists', async ({ diskEncryption }) => {
    await diskEncryption.goto({ fleetId: 0, platform: 'linux' });
    await diskEncryption.teamDropdown.select('Unassigned');

    // Linux encryption is enforced by the OS itself, so Fleet offers escrow alone.
    await expect(diskEncryption.escrowCheckbox).toBeVisible();
    await expect(diskEncryption.enforceCheckbox).toHaveCount(0);

    const target = !original.linuxEscrowEnabled;
    await diskEncryption.escrowCheckbox.setChecked(target);
    await diskEncryption.save();

    await diskEncryption.goto({ fleetId: 0, platform: 'linux' });
    await diskEncryption.teamDropdown.select('Unassigned');
    await expect(diskEncryption.escrowCheckbox).toBeChecked({ checked: target });
  });

  test('the Windows BitLocker PIN toggle unlocks only once enforcement is on', async ({
    diskEncryption,
  }) => {
    await diskEncryption.goto({ fleetId: 0, platform: 'windows' });
    await diskEncryption.teamDropdown.select('Unassigned');

    // Fleet rejects a PIN requirement without enforcement, so the form gates
    // the PIN checkbox on the enforcement checkbox rather than the saved state.
    // Nothing is saved here, so the form state alone drives the assertions.
    await diskEncryption.enforceCheckbox.setChecked(false);
    await expect(diskEncryption.bitlockerPinCheckbox).toBeDisabled();

    await diskEncryption.enforceCheckbox.setChecked(true);
    await expect(diskEncryption.bitlockerPinCheckbox).toBeEnabled();
  });
});

test.describe('Premium • Controls • disk encryption — BitLocker PIN (throwaway fleet)', () => {
  const fleetName = `pw-bitlocker-${runNonce()}`;

  test.afterEach(async ({ request }) => {
    const fleet = await findFleetByName(request, fleetName);
    if (fleet) await deleteFleet(request, fleet.id, { ignoreMissing: true });
  });

  test('a required BitLocker PIN saves with enforcement, and unticking enforcement clears it', async ({
    diskEncryption,
    request,
    page,
  }) => {
    const fleet = await createFleet(request, fleetName);

    // Scoped by URL: the fleet's name is per-run, so it isn't picked from the
    // dropdown (see `TeamDropdown.selectByLabel`).
    await diskEncryption.goto({ fleetId: fleet.id, platform: 'windows' });
    await expect(diskEncryption.teamDropdown.currentValue).toHaveText(fleet.name);

    await diskEncryption.enforceCheckbox.setChecked(true);
    await diskEncryption.bitlockerPinCheckbox.setChecked(true);
    await diskEncryption.save();
    expect(await getFleetWindowsDiskEncryption(request, fleet.id)).toEqual({
      enabled: true,
      bitlockerPinRequired: true,
    });

    await page.reload();
    await diskEncryption.expectPlatform('windows');
    await expect(diskEncryption.enforceCheckbox).toBeChecked();
    await expect(diskEncryption.bitlockerPinCheckbox).toBeChecked();

    // Fleet refuses a PIN without enforcement, so the form unticks the PIN with
    // enforcement and locks it, and both save off.
    await diskEncryption.enforceCheckbox.setChecked(false);
    await expect(diskEncryption.bitlockerPinCheckbox).not.toBeChecked();
    await expect(diskEncryption.bitlockerPinCheckbox).toBeDisabled();
    await diskEncryption.save();
    expect(await getFleetWindowsDiskEncryption(request, fleet.id)).toEqual({
      enabled: false,
      bitlockerPinRequired: false,
    });

    await page.reload();
    await diskEncryption.expectPlatform('windows');
    await expect(diskEncryption.enforceCheckbox).not.toBeChecked();
    await expect(diskEncryption.bitlockerPinCheckbox).not.toBeChecked();

    await deleteFleet(request, fleet.id);
  });
});
