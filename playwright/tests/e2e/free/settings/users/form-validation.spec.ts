import { test, expect } from '@fixtures';
import { qaTestPassword } from '@helpers/api';

test.describe('Create-user form validation', { tag: '@free' }, () => {
  test.describe('Regular user', () => {
    test('clearing Full name disables Add', async ({ createUserPage }) => {
      await createUserPage.goto();

      await createUserPage.form.fullName.fill('QA Validation');
      await createUserPage.form.email.fill('qa-test-validation@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());
      await createUserPage.form.password.press('Tab');
      await expect(createUserPage.submitButton).toBeEnabled();

      await createUserPage.form.fullName.fill('');
      await createUserPage.form.fullName.press('Tab');
      await expect(createUserPage.submitButton).toBeDisabled();
    });

    test('clearing Email disables Add', async ({ createUserPage }) => {
      await createUserPage.goto();

      await createUserPage.form.fullName.fill('QA Validation');
      await createUserPage.form.email.fill('qa-test-validation@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());
      await createUserPage.form.password.press('Tab');
      await expect(createUserPage.submitButton).toBeEnabled();

      await createUserPage.form.email.fill('');
      await createUserPage.form.email.press('Tab');
      await expect(createUserPage.submitButton).toBeDisabled();
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
