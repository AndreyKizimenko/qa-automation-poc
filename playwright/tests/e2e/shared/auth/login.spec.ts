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

  test('redirects to dashboard when already authenticated', async ({ browser }) => {
    // Loads the project's saved admin state to bypass the describe-level auth reset.
    const suite = process.env.SUITE || 'premium';
    const context = await browser.newContext({
      storageState: `.auth/${suite}-admin.json`,
      baseURL: process.env.FLEET_URL,
    });
    const page = await context.newPage();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);

    await context.close();
  });
});
