/**
 * Free • Software • Manage automations access. The "Automations" button
 * (which opens the "Manage automations" modal) is global-admin-only. Free has
 * no team dropdown, so the aggregate scope is always in effect and the button
 * is simply enabled for the admin. Non-admins never see it.
 *
 * Each static human logs into a fresh context via `withStaticUser` so the
 * shared admin storage state is left untouched.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { SoftwareTitlesPage } from '@pages';

const NON_ADMIN_KEYS: StaticUserKey[] = ['global-maintainer', 'global-observer'];

test.describe('Free • Software • Manage automations access', () => {
  test('global admin can open the Manage automations modal', async ({ browser }) => {
    await withStaticUser(browser, 'global-admin', async (page) => {
      const software = new SoftwareTitlesPage(page);
      await software.goto();

      await expect(software.manageAutomationsButton).toBeEnabled();
      await software.manageAutomationsButton.click();
      await expect(software.manageAutomationsModal).toBeVisible();
    });
  });

  for (const key of NON_ADMIN_KEYS) {
    test(`${key} does not see the Automations button`, async ({ browser }) => {
      await withStaticUser(browser, key, async (page) => {
        const software = new SoftwareTitlesPage(page);
        await software.goto();
        await expect(software.manageAutomationsButton).toHaveCount(0);
      });
    });
  }
});
