/**
 * Premium • My Account page. Each static human is logged into a fresh
 * browser context via `withStaticUser` so the spec doesn't disturb the
 * admin storage state shared by the rest of the suite. Asserts the side
 * panel's Fleets and Role values plus the email/name fields render
 * correctly per role.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import {
  expectedFleetsDisplay,
  expectedRoleDisplay,
  staticUser,
  type StaticUserKey,
} from '@helpers/api';
import { MyAccountPage } from '@pages';

const MY_ACCOUNT_USERS: StaticUserKey[] = [
  'global-admin',
  'global-maintainer',
  'global-observer',
  'global-observer-plus',
  'global-technician',
  'ws-maintainer',
  'ws-observer',
];

test.describe('Premium • My Account', () => {
  for (const key of MY_ACCOUNT_USERS) {
    test(`${key} sees their email, name, role, and fleets`, async ({ browser }) => {
      const spec = staticUser(key);
      await withStaticUser(browser, key, async (page) => {
        const myAccount = new MyAccountPage(page);
        await myAccount.goto();

        await expect(myAccount.emailInput).toHaveValue(spec.email);
        await expect(myAccount.fullNameInput).toHaveValue(spec.name);
        await expect(myAccount.roleValue).toHaveText(expectedRoleDisplay(spec));
        await expect(myAccount.fleetsValue).toHaveText(expectedFleetsDisplay(spec));
      });
    });
  }
});
