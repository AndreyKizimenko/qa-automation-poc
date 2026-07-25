/**
 * Premium • Settings • Fleet Desktop. The Fleet Desktop org-settings section is
 * premium-only (free is redirected away). Presence check: the section renders
 * with its "Custom transparency URL" field. No mutation.
 *
 * Grounded in frontend/pages/admin/OrgSettingsPage/cards/FleetDesktop (returns
 * null unless isPremiumTier).
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Settings • Fleet Desktop', () => {
  test('the Fleet Desktop section shows the Custom transparency URL field', async ({ page }) => {
    await page.goto('/settings/organization/fleet-desktop');

    await expect(page.getByRole('heading', { name: 'Fleet Desktop' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Custom transparency URL' })).toBeVisible();
  });
});
