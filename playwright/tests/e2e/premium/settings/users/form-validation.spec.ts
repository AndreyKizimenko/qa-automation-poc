import { test, expect } from '@fixtures';
import { qaTestPassword } from '@helpers/api';

test.describe('Create-user form validation', () => {
  test.describe('Regular user', () => {
    test('clearing Full name disables Add', async ({ createUserPage }) => {
      await createUserPage.goto();

      // Start from a complete form so Add is enabled, then clear one field
      // and confirm the form validator disables the button on blur.
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

    test('submit with Assign-to-fleets but no fleet checked surfaces an error', async ({
      createUserPage,
      page,
    }) => {
      // Default Permissions on premium is "Assign to fleet(s)" with no
      // checkbox pre-selected. Fill the rest of the form and submit; the
      // form lets us through (no client-side disable) but the inline
      // error appears below the fleets section.
      await createUserPage.goto();
      await createUserPage.form.fullName.fill('QA Empty Fleets');
      await createUserPage.form.email.fill('qa-test-emptyfleets@fleetdm.com');
      await createUserPage.form.password.fill(qaTestPassword());

      await expect(createUserPage.form.assignToFleetsRadio).toBeChecked();
      await expect(createUserPage.submitButton).toBeEnabled();
      await createUserPage.submitButton.click();

      await expect(
        page.getByText('Please select at least one fleet for this user.'),
      ).toBeVisible();
      // The submit did not navigate away.
      await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    });
  });

  test.describe('API-only user', () => {
    test('submitting an empty Name surfaces "Name is required"', async ({
      createApiUserPage,
      page,
    }) => {
      // The API form validates on submit (not on blur), so the test
      // clicks Add and verifies the inline error appears rather than
      // asserting a disabled button state.
      await createApiUserPage.goto();
      await createApiUserPage.submitButton.click();
      await expect(page.getByText('Name is required')).toBeVisible();
    });
  });
});
