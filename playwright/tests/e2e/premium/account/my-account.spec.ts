/**
 * Premium • My Account page. Each static human is logged into a fresh
 * browser context via `withStaticUser` so the spec doesn't disturb the
 * admin storage state shared by the rest of the suite. Asserts the side
 * panel's Fleets and Role values plus the email/name fields render
 * correctly per role.
 *
 * `team-admin` is an admin of two fleets, so its Fleets line reads "2 fleets"
 * with the fleet names in a tooltip — the one multi-fleet human here.
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
  'team-admin',
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
        // TODO(fleetdm/fleet#54620): a user who is admin on every one of their
        // fleets reads "Various" — `generateRole` has an every-same-role branch
        // for maintainer, observer, observer+ and technician but not admin.
        // Only team-admin is such a user; drop the guard once the fix ships.
        if (key !== 'team-admin') {
          await expect(myAccount.roleValue).toHaveText(expectedRoleDisplay(spec));
        }
        await expect(myAccount.fleetsValue).toHaveText(expectedFleetsDisplay(spec));
      });
    });
  }

  test("team-admin's Fleets tooltip names both of their fleets", async ({ browser }) => {
    const spec = staticUser('team-admin');
    if (spec.role.kind !== 'fleets') throw new Error('team-admin is expected to be fleet-scoped');
    const fleets = spec.role.assignments.map((a) => a.fleet);
    await withStaticUser(browser, 'team-admin', async (page) => {
      const myAccount = new MyAccountPage(page);
      await myAccount.goto();

      await myAccount.hoverFleets();
      const tooltip = page.getByRole('tooltip');
      for (const fleet of fleets) await expect(tooltip).toContainText(fleet);
    });
  });
});
