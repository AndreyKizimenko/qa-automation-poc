/**
 * Settings • Users • an admin sets another user's password from the Edit user
 * form. The form sends it as `new_password` (no old password needed), and Fleet
 * ends that user's sessions when it changes.
 *
 * Proven through the API rather than by landing in the UI as the user: a
 * cookie-less request context logs in with the new password, the old password
 * is refused, and a token issued before the change stops authenticating. A
 * cookie-less context matters: the browser project's `request` carries the
 * admin session, which would authenticate `/me` whatever the token said.
 *
 * Shared: the form and the endpoint are the same on both tiers. The subject is
 * a throwaway `qa-test-*` user, deleted in the `afterEach` and swept by
 * `cleanup-setup` if a run dies first.
 */
import { test, expect } from '@fixtures';
import { apiLogin, apiUrl, createUser, deleteUser, qaTestEmail, qaTestPassword } from '@helpers/api';

test.describe('Settings • Users • an admin sets a password', () => {
  let userId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (userId !== undefined) await deleteUser(request, userId, { ignoreMissing: true });
    userId = undefined;
  });

  test("an admin sets a user's password; it logs in, the old one and the old session don't", async ({
    request,
    playwright,
    usersPage,
    editUserPage,
    page,
  }) => {
    const email = qaTestEmail('pwset');
    const name = 'QA Password Set';
    const oldPassword = qaTestPassword();
    // Fleet's policy: 12–48 characters, at least one digit and one symbol.
    const newPassword = `Pw-${Date.now()}!set`;
    ({
      user: { id: userId },
    } = await createUser(request, {
      name,
      email,
      global_role: 'observer',
      admin_forced_password_reset: false,
    }));

    const api = await playwright.request.newContext({
      baseURL: process.env.FLEET_URL,
      ignoreHTTPSErrors: true,
    });
    try {
      // Three logins in a row: `apiLogin` waits out Fleet's suite-wide login throttle.
      const login = (password: string) => apiLogin(api, email, password);

      const before = await login(oldPassword);
      expect(before.ok(), 'the user logs in with the password they were created with').toBeTruthy();
      const oldAuth = { Authorization: `Bearer ${(await before.json()).token as string}` };
      await expect(await api.get(apiUrl('me'), { headers: oldAuth })).toBeOK();

      await usersPage.goto();
      const row = await usersPage.findRowByEmail(email);
      await usersPage.clickRowAction(row, 'Edit');
      await expect(page).toHaveURL(/\/settings\/users\/\d+\/edit\b/);
      await expect(editUserPage.humanHeading).toBeVisible();

      await editUserPage.newPassword.fill(newPassword);
      await editUserPage.saveButton.click();
      await usersPage.toast.expectSuccess(`Successfully edited ${name}`);

      expect((await login(newPassword)).status(), 'the new password logs in').toBe(200);
      expect((await login(oldPassword)).status(), 'the old password is refused').toBe(401);
      await expect
        .poll(async () => (await api.get(apiUrl('me'), { headers: oldAuth })).status(), {
          message: 'a token issued before the change no longer authenticates',
        })
        .toBe(401);
    } finally {
      await api.dispose();
    }
  });
});
