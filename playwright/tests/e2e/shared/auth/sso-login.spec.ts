import { test, expect } from '@fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

// Admin SSO is pre-configured on QA; the Okta test user is JIT-provisioned on first login.
test.describe('Okta SSO login', () => {
  const username = process.env.FLEET_SSO_LOGIN_USERNAME!;
  const password = process.env.FLEET_SSO_LOGIN_PASSWORD!;

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('SSO button is visible and names Okta in its hover tooltip', async ({ loginPage }) => {
    await expect(loginPage.ssoButton).toBeVisible();
    await expect(loginPage.ssoButton).toHaveText(/sign in with sso/i);
    // The IdP name moved off the button label into a hover tooltip.
    await loginPage.ssoButton.hover();
    await expect(loginPage.ssoTooltip).toContainText(/okta/i);
  });

  test('valid Okta credentials result in successful login', async ({ loginPage, page }) => {
    await loginPage.ssoButton.click();

    // Field names differ between Okta classic and the new Identity Engine.
    const oktaUser = page.locator('input[name="identifier"], input[name="username"]').first();
    await expect(oktaUser).toBeVisible({ timeout: 15_000 });
    await oktaUser.fill(username);

    // Some Okta orgs split username and password across two screens.
    const nextButton = page.getByRole('button', { name: /^next$/i });
    if (await nextButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nextButton.click();
    }

    const oktaPassword = page.locator('input[name="credentials.passcode"], input[name="password"]').first();
    await expect(oktaPassword).toBeVisible({ timeout: 15_000 });
    await oktaPassword.fill(password);

    const submit = page.locator('input[type="submit"]').or(page.getByRole('button', { name: /sign in|verify|continue/i })).first();
    await submit.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });
});
