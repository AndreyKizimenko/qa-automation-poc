/**
 * Premium • Settings • MDM integrations. The End-user migration workflow's
 * webhook URL is validated client-side ("Must be a valid URL."). Enabling the
 * workflow toggle is client-side only (not saved), so this mutates nothing.
 *
 * Requires Apple ABM configured (the section returns null otherwise — true on
 * this instance). Grounded in
 * frontend/pages/admin/IntegrationsPage/cards/MdmSettings/.../EndUserMigrationSection.
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Settings • MDM end-user migration', () => {
  test('the migration webhook URL is validated client-side', async ({ page }) => {
    await page.goto('/settings/integrations/mdm');

    const section = page.locator('.end-user-migration-section');
    await expect(section.getByRole('heading', { name: 'End user migration workflow' })).toBeVisible();

    // Enable the workflow (client-side only — never saved) to unlock the field.
    const toggle = section.getByRole('switch');
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // The "Webhook URL" InputField label isn't associated (no htmlFor), so
    // target the input by its name attribute.
    const webhook = page.locator('input[name="webhook_url"]');
    await webhook.fill('not a url');
    await expect(page.getByText('Must be a valid URL.')).toBeVisible();

    await webhook.fill('https://example.com/pw-migration');
    await expect(page.getByText('Must be a valid URL.')).toHaveCount(0);
  });
});
