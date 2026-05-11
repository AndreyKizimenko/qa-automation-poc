import { test, expect } from '@fixtures';
import { loginAsAdmin } from '@helpers/auth';

test.describe('Logout', { tag: '@free' }, () => {
  // Use a blank session so this test never touches the shared auth state.
  // The logout action invalidates the server-side session, which would break
  // the stored cookies used by all other tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sign out returns to login page', async ({ dashboard, page, pageHealth }) => {
    // Sign-out invalidates the session, so any in-flight or post-logout
    // config fetch gets a 401 — expected, not a regression.
    pageHealth.disable();

    // Log in with a fresh session
    await loginAsAdmin(
      page,
      process.env.FLEET_ADMIN_EMAIL!,
      process.env.FLEET_ADMIN_PASSWORD!,
    );

    await dashboard.goto();
    await dashboard.navbar.signOut();

    await expect(page).toHaveURL(/\/login/);
  });
});
