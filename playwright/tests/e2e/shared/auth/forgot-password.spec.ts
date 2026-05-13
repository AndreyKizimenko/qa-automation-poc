import { test, expect } from '@fixtures';

// Forgot password tests start with a fresh session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Forgot password', () => {
  test('forgot password link navigates to reset page', async ({ loginPage, forgotPasswordPage, page }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/login\/forgot/);
    await expect(forgotPasswordPage.heading).toBeVisible();
  });
});
