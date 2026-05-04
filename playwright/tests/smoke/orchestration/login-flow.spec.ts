import { test, expect } from '@fixtures';

// Login flow tests always start with a fresh session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login flow', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('blank fields show validation prompts', { tag: '@all' }, async ({ loginPage }) => {
    await loginPage.loginButton.click();

    await expect(loginPage.emailRequiredMessage).toBeVisible();
    await expect(loginPage.passwordRequiredMessage).toBeVisible();
  });

  test('invalid credentials show authentication failed', { tag: '@all' }, async ({ loginPage, page, pageHealth }) => {
    pageHealth.disable(); // intentionally triggers an auth 4xx
    await loginPage.login('nonexistent@example.com', 'WrongPassword999!');
    await expect(loginPage.authFailedMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid email with wrong password shows authentication failed', { tag: '@all' }, async ({ loginPage, page, pageHealth }) => {
    pageHealth.disable(); // intentionally triggers an auth 4xx
    await loginPage.login(process.env.FLEET_ADMIN_EMAIL!, 'WrongPassword999!');
    await expect(loginPage.authFailedMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot password link prompts for email', { tag: '@all' }, async ({ loginPage, forgotPasswordPage, page }) => {
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(/\/login\/forgot/);
    await expect(forgotPasswordPage.heading).toBeVisible();
    await expect(forgotPasswordPage.emailInput).toBeVisible();
  });

  test('valid credentials result in successful login', { tag: '@all' }, async ({ loginPage, page }) => {
    await loginPage.login(process.env.FLEET_ADMIN_EMAIL!, process.env.FLEET_ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // Admin SSO is pre-configured on the instance; the test user
  // (FLEET_SSO_LOGIN_*) is JIT-provisioned on first login.
  test.describe('Okta SSO login', () => {
    const username = process.env.FLEET_SSO_LOGIN_USERNAME!;
    const password = process.env.FLEET_SSO_LOGIN_PASSWORD!;

    test('"Sign in with Okta" button is visible on the login page', async ({ loginPage }) => {
      await loginPage.goto();
      await expect(loginPage.ssoButton).toBeVisible();
      await expect(loginPage.ssoButton).toContainText(/okta/i);
    });

    test('valid Okta credentials result in successful login', async ({ loginPage, page }) => {
      await loginPage.goto();
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
});
