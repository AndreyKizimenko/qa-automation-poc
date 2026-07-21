import { test, expect } from '@fixtures';

// Forgot password tests start with a fresh session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Forgot password', () => {
  test('forgot password link navigates to reset page', async ({ loginPage, forgotPasswordPage, page }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/login\/forgot/);
    await expect(forgotPasswordPage.heading).toBeVisible();
    // The reset page renders its actionable form (email field + submit). The
    // submit → "email sent" confirmation path isn't asserted here: it only
    // renders when the instance has SMTP/SES configured (the QA instances
    // don't — the endpoint returns ErrPasswordResetNotConfigured instead).
    await expect(forgotPasswordPage.emailInput).toBeVisible();
    await expect(forgotPasswordPage.submitButton).toBeVisible();
  });
});
