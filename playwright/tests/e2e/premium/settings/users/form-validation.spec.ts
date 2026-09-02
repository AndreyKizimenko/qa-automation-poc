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
      await expect(page.getByText('Enter a name')).toBeVisible();
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
      await expect(page.getByText('Enter an email')).toBeVisible();
      await expect(createUserPage.submitButton).toBeEnabled();

      await createUserPage.submitButton.click();
      await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    });

    test('invalid email format surfaces an inline error', async ({ createUserPage, page }) => {
      await createUserPage.goto();
      await createUserPage.form.email.fill('not-an-email');
      await createUserPage.form.email.press('Tab');
      await expect(page.getByText('Enter a valid email')).toBeVisible();
    });

    test('submit with Assign-to-fleets but no fleet checked surfaces an error', async ({
      createUserPage,
      page,
    }) => {
      // Default Permissions on premium is "Assign to fleet(s)" with no
      // checkbox pre-selected. Fill the rest of the form and submit; the
      // form lets us through (no client-side disable) and the error renders
      // inline on the fleets selector alongside the other field errors.
      await createUserPage.goto();
      await createUserPage.form.fullName.fill('QA Empty Fleets');
      await createUserPage.form.email.fill('qa-test-emptyfleets@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());

      await expect(createUserPage.form.assignToFleetsRadio).toBeChecked();
      await expect(createUserPage.submitButton).toBeEnabled();
      await createUserPage.submitButton.click();

      await expect(
        page.getByText('Select at least one fleet'),
      ).toBeVisible();
      // The submit did not navigate away.
      await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    });
  });

  test.describe('API-only user', () => {
    test('submitting an empty Name surfaces "Enter a name"', async ({
      createApiUserPage,
      page,
    }) => {
      // The API form validates on submit, so clicking Add surfaces the
      // inline "Enter a name" error directly.
      await createApiUserPage.goto();
      await createApiUserPage.submitButton.click();
      await expect(page.getByText('Enter a name')).toBeVisible();
    });
  });
});
