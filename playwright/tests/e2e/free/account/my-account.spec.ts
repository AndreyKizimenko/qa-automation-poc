/**
 * Free • My Account page. The Fleets side-panel row is suppressed on
 * free (Fleet renders it only `isPremiumTier`), so the spec asserts it
 * is *hidden* while still verifying email, name, and role. Login runs
 * in a fresh `withStaticUser` context to avoid touching admin storage.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { expectedRoleDisplay, staticUser, type StaticUserKey } from '@helpers/api';
import { MyAccountPage } from '@pages';

const MY_ACCOUNT_USERS: StaticUserKey[] = [
  'global-admin',
  'global-maintainer',
  'global-observer',
];

test.describe('Free • My Account', () => {
  for (const key of MY_ACCOUNT_USERS) {
    test(`${key} sees their email, name, and role (no Fleets section)`, async ({ browser }) => {
      const spec = staticUser(key);
      await withStaticUser(browser, key, async (page) => {
        const myAccount = new MyAccountPage(page);
        await myAccount.goto();

        await expect(myAccount.emailInput).toHaveValue(spec.email);
        await expect(myAccount.fullNameInput).toHaveValue(spec.name);
        await expect(myAccount.roleValue).toHaveText(expectedRoleDisplay(spec));
        await expect(myAccount.fleetsValue).toBeHidden();
      });
    });
  }
});
