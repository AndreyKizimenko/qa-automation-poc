/**
 * Premium • Controls • disk encryption. Toggling global disk-encryption
 * enforcement (Controls → OS settings → Disk encryption) persists across a
 * reload. Config-only — no host required. The original setting is snapshotted +
 * restored via the API (afterEach runs even on failure).
 *
 * Grounded in frontend/pages/ManageControlsPage/OSSettings/cards/DiskEncryption
 * (config.mdm.enable_disk_encryption; toast "Successfully updated disk
 * encryption enforcement.").
 */
import { test, expect } from '@fixtures';
import { getAppConfig, setGlobalDiskEncryption } from '@helpers/api';

test.describe('Premium • Controls • disk encryption', () => {
  let original: boolean;

  test.beforeEach(async ({ request }) => {
    original = (await getAppConfig(request)).mdm?.enable_disk_encryption ?? false;
  });

  test.afterEach(async ({ request }) => {
    await setGlobalDiskEncryption(request, original);
  });

  test('toggling disk-encryption enforcement persists', async ({ page }) => {
    const toggle = page.getByRole('checkbox', { name: 'Turn on disk encryption' });

    await page.goto('/controls/os-settings/disk-encryption');
    await expect(toggle).toBeVisible();

    // Flip to the opposite of the current state.
    if (original) await toggle.uncheck();
    else await toggle.check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Successfully updated disk encryption enforcement.' }),
    ).toBeVisible();

    await page.goto('/controls/os-settings/disk-encryption');
    await expect(toggle).toBeChecked({ checked: !original });
  });
});
