import { test, expect } from '@fixtures';

// Validation tests always start with a fresh session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login validation', { tag: '@free' }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('shows validation errors when both fields are empty', async ({ loginPage }) => {
    await loginPage.loginButton.click();

    await expect(loginPage.emailRequiredMessage).toBeVisible();
    await expect(loginPage.passwordRequiredMessage).toBeVisible();
  });

  test('shows validation error when email is empty', async ({ loginPage }) => {
    await loginPage.passwordInput.fill('SomePassword123!');
    await loginPage.loginButton.click();

    await expect(loginPage.emailRequiredMessage).toBeVisible();
  });

  test('shows validation error when password is empty', async ({ loginPage }) => {
    await loginPage.emailInput.fill(process.env.FLEET_ADMIN_EMAIL!);
    await loginPage.loginButton.click();

    await expect(loginPage.passwordRequiredMessage).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ loginPage, page }) => {
    await loginPage.login('notanemail', 'SomePassword123!');
    await expect(page.getByText('Email must be a valid email address')).toBeVisible();
  });
});
