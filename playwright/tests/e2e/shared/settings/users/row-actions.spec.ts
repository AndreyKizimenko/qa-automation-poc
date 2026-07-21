import { test, expect } from '@fixtures';
import { apiUrl, createUser, deleteUser, qaTestPassword, withApiRequest } from '@helpers/api';

test.describe('User row actions', () => {
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
    const row = await usersPage.findRowByEmail(email);
    await usersPage.clickRowAction(row, 'Require password reset');

    await expect(usersPage.resetPasswordModal).toBeVisible();
    await expect(usersPage.resetPasswordModal).toContainText(/reset their password/i);

    await usersPage.resetPasswordConfirmButton.click();
    await expect(usersPage.resetPasswordModal).toBeHidden();
    await usersPage.toast.expectSuccess('Successfully required a password reset.');
  });

  test('Reset sessions opens the confirmation modal and confirms', async ({ usersPage }) => {
    await usersPage.goto();
    const row = await usersPage.findRowByEmail(email);
    await usersPage.clickRowAction(row, 'Reset sessions');

    await expect(usersPage.resetSessionsModal).toBeVisible();
    await expect(usersPage.resetSessionsModal).toContainText(/logged out of Fleet/i);

    await usersPage.resetSessionsConfirmButton.click();
    await expect(usersPage.resetSessionsModal).toBeHidden();
    await usersPage.toast.expectSuccess('Successfully reset sessions.');
  });
});

test.describe('Reset sessions invalidates the user token', () => {
  const email = `qa-test-${Date.now()}-resetsess@fleetdm.com`;
  let userId: number;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const { user } = await createUser(request, {
        name: 'QA Reset Sessions',
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

  test("resetting the user's sessions invalidates their existing token", async ({
    usersPage,
    playwright,
  }) => {
    // A cookie-less API context: the browser project's request carries the
    // admin session cookie, which would authenticate /me and mask the token's
    // post-reset 401. This context has no cookies, so /me is judged purely on
    // the Bearer token.
    const api = await playwright.request.newContext({
      baseURL: process.env.FLEET_URL,
      ignoreHTTPSErrors: true,
    });
    try {
      const loginRes = await api.post(apiUrl('login'), {
        data: { email, password: qaTestPassword() },
      });
      expect(loginRes.ok(), 'the test user should be able to log in').toBeTruthy();
      const token = (await loginRes.json()).token as string;
      const auth = { Authorization: `Bearer ${token}` };
      expect((await api.get(apiUrl('me'), { headers: auth })).ok()).toBeTruthy();

      await usersPage.goto();
      const row = await usersPage.findRowByEmail(email);
      await usersPage.clickRowAction(row, 'Reset sessions');
      await expect(usersPage.resetSessionsModal).toBeVisible();
      await usersPage.resetSessionsConfirmButton.click();
      await usersPage.toast.expectSuccess('Successfully reset sessions.');

      // The previously-issued token no longer authenticates.
      await expect
        .poll(async () => (await api.get(apiUrl('me'), { headers: auth })).status())
        .toBe(401);
    } finally {
      await api.dispose();
    }
  });
});
