/**
 * Premium • Change password from My Account. Creates a disposable
 * `qa-test-...` user via API, logs in as them in a fresh context,
 * rotates their password via the side-panel modal, and confirms the new
 * password works on a subsequent login. The test admin and other
 * parallel runs are untouched — every UI step runs in a throwaway
 * context spun up by `withCleanContext`.
 */
import { test, expect } from '@fixtures';
import {
  createUser,
  deleteUser,
  qaTestEmail,
  qaTestPassword,
  withApiRequest,
} from '@helpers/api';
import { loginAsAdmin, withCleanContext } from '@helpers/auth';
import { MyAccountPage } from '@pages';

const NEW_PASSWORD = 'NewPassw0rd!Test123';

test.describe('Premium • My Account change password', () => {
  const email = qaTestEmail('changepw');
  let userId: number;
  let initialPassword: string;

  test.beforeAll(async () => {
    initialPassword = qaTestPassword();
    await withApiRequest(async (request) => {
      const { user } = await createUser(request, {
        name: 'QA Change Password',
        email,
        password: initialPassword,
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

  test('user rotates their password and can log back in with the new value', async ({
    browser,
  }) => {
    await withCleanContext(browser, async (page) => {
      await loginAsAdmin(page, email, initialPassword);

      const myAccount = new MyAccountPage(page);
      await myAccount.goto();
      await myAccount.openChangePassword();
      await myAccount.submitChangePassword(initialPassword, NEW_PASSWORD);

      await expect(myAccount.changePasswordModal).toBeHidden();
      await myAccount.toast.expectSuccess('Password changed successfully');
    });

    await withCleanContext(browser, async (page) => {
      await loginAsAdmin(page, email, NEW_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
