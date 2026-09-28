/**
 * Free • gitops mode is premium-only.
 *
 * `paywalls.spec.ts` already asserts the Change-management page renders the
 * premium banner. This goes one step further and asserts the banner is
 * *instead of* the form, not above a working one — a paywall that renders
 * alongside a live toggle would let a free instance lock its own UI with no
 * supported way back out.
 */
import { test, expect } from '@fixtures';
import { gitopsWrappers } from '@pages';

test.describe('Free • gitops mode', () => {
  test('Change management offers no gitops controls', async ({ page }) => {
    await page.goto('/settings/integrations/change-management');
    await expect(page.getByRole('heading', { name: 'Change management' })).toBeVisible();

    // Fleet's Checkbox names the interactive element after the form field.
    await expect(page.getByRole('checkbox', { name: 'gitOpsModeEnabled' })).toHaveCount(0);
    for (const field of ['exceptLabels', 'exceptSoftware', 'exceptSecrets']) {
      await expect(page.getByRole('checkbox', { name: field })).toHaveCount(0);
    }
    await expect(page.getByLabel('Git repository URL')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  });

  test('no gitops marker or gated control anywhere on the core pages', async ({
    dashboard,
    scriptsLibrary,
    organizationAdvanced,
    page,
  }) => {
    await dashboard.goto();
    await expect(dashboard.navbar.gitopsIndicator).toHaveCount(0);
    await expect(gitopsWrappers(page)).toHaveCount(0);

    await scriptsLibrary.goto();
    await expect(gitopsWrappers(page)).toHaveCount(0);

    await organizationAdvanced.goto();
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });
});
