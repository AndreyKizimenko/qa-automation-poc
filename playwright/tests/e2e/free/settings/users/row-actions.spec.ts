import { test, expect } from '@fixtures';
import { createUser, deleteUser, withApiRequest } from '@helpers/api';

test.describe('User row actions', { tag: '@free' }, () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const email = `qa-test-${stamp}-rowactions@fleetdm.com`;
  let userId: number;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const { user } = await createUser(request, {
        name: 'QA Row Actions',
        email,
        global_role: 'observer',
        admin_forced_password_reset: false,
      });
      userId = user.id;
    });
  });

  test.afterAll(async () => {
    if (userId === undefined) return;
    await withApiRequest((request) => deleteUser(request, userId, { ignoreMissing: true }));
  });

  test('Require password reset opens the confirmation modal and confirms', async ({
    usersPage,
  }) => {
    await usersPage.goto();
    const row = usersPage.rowByEmail(email);
    await usersPage.clickRowAction(row, 'Require password reset');

    await expect(usersPage.resetPasswordModal).toBeVisible();
    await expect(usersPage.resetPasswordModal).toContainText(/reset their password/i);

    await usersPage.resetPasswordConfirmButton.click();
    await expect(usersPage.resetPasswordModal).toBeHidden();
    await usersPage.toast.expectSuccess('Successfully required a password reset.');
  });

  test('Reset sessions opens the confirmation modal and confirms', async ({ usersPage }) => {
    await usersPage.goto();
    const row = usersPage.rowByEmail(email);
    await usersPage.clickRowAction(row, 'Reset sessions');

    await expect(usersPage.resetSessionsModal).toBeVisible();
    await expect(usersPage.resetSessionsModal).toContainText(/logged out of Fleet/i);

    await usersPage.resetSessionsConfirmButton.click();
    await expect(usersPage.resetSessionsModal).toBeHidden();
    await usersPage.toast.expectSuccess('Successfully reset sessions.');
  });
});
