import { test, expect } from '@fixtures';
import { qaTestPassword } from '@helpers/api';

test.describe('Create-user form validation', () => {
  test.describe('Regular user', () => {
    test('clearing Full name blocks Add without disabling it', async ({
      createUserPage,
      page,
    }) => {
      await createUserPage.goto();

      await createUserPage.form.fullName.fill('QA Validation');
      await createUserPage.form.email.fill('qa-test-validation@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());

      // Clearing a required field surfaces that field's error on blur while Add
      // stays clickable; submitting is what refuses, keeping us on the form.
      await createUserPage.form.fullName.fill('');
      await createUserPage.form.fullName.press('Tab');
      await expect(page.getByText('Name field must be completed')).toBeVisible();
      await expect(createUserPage.submitButton).toBeEnabled();

      await createUserPage.submitButton.click();
      await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    });

    test('clearing Email blocks Add without disabling it', async ({ createUserPage, page }) => {
      await createUserPage.goto();

      await createUserPage.form.fullName.fill('QA Validation');
      await createUserPage.form.email.fill('qa-test-validation@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());

      await createUserPage.form.email.fill('');
      await createUserPage.form.email.press('Tab');
      await expect(page.getByText('Email field must be completed')).toBeVisible();
      await expect(createUserPage.submitButton).toBeEnabled();

      await createUserPage.submitButton.click();
      await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    });

    test('invalid email format surfaces an inline error', async ({ createUserPage, page }) => {
      await createUserPage.goto();
      await createUserPage.form.email.fill('not-an-email');
      await createUserPage.form.email.press('Tab');
      await expect(page.getByText('Email is not a valid email')).toBeVisible();
    });
  });

  test.describe('API-only user', () => {
    test('submitting an empty Name surfaces "Name is required"', async ({
      createApiUserPage,
      page,
    }) => {
      await createApiUserPage.goto();
      await createApiUserPage.submitButton.click();
      await expect(page.getByText('Name is required')).toBeVisible();
    });
  });
});
