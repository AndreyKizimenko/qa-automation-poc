import { test, expect } from '@fixtures';

// Login tests always start with a fresh session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('admin can log in', async ({ loginPage, page }) => {
    await loginPage.login(process.env.FLEET_ADMIN_EMAIL!, process.env.FLEET_ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error for invalid email', async ({ loginPage, page, pageHealth }) => {
    pageHealth.disable(); // intentionally produces a console error from the auth failure
    await loginPage.login('nonexistent@example.com', 'SomePassword123!');
    await expect(loginPage.authFailedMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error for valid email with wrong password', async ({ loginPage, page, pageHealth }) => {
    pageHealth.disable(); // intentionally produces a console error from the auth failure
    await loginPage.login(process.env.FLEET_ADMIN_EMAIL!, 'WrongPassword999!');
    await expect(loginPage.authFailedMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to login when visiting a protected route signed out', async ({ page, loginPage, pageHealth }) => {
    // Booting the app unauthenticated on a protected route logs a 401-driven
    // console error before the redirect resolves; the redirect is the behavior.
    pageHealth.disable();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.emailInput).toBeVisible();
  });

  test('redirects to dashboard when already authenticated', async ({ browser }) => {
    // Loads the project's saved admin state to bypass the describe-level auth reset.
    const context = await browser.newContext({
      storageState: `.auth/${process.env.SUITE}-admin.json`,
      baseURL: process.env.FLEET_URL,
    });
    const page = await context.newPage();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);

    await context.close();
  });
});
