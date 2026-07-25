/**
 * Premium • Software • Manage automations access. The "Automations" button
 * (which opens the "Manage automations" modal) is global-admin-only, and even
 * for an admin it is enabled only under the "All fleets" aggregate — selecting
 * a specific fleet disables it with an explanatory tooltip. Non-admins never
 * see the button at all, on any scope.
 *
 * Each static human logs into a fresh context via `withStaticUser` so the
 * shared admin storage state is left untouched.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { SoftwareTitlesPage, type TeamScope } from '@pages';

// The button gates on isGlobalAdmin, so these roles never see it regardless of
// the selected fleet — assert absence, not a disabled state.
const NON_ADMIN_KEYS: StaticUserKey[] = ['global-maintainer', 'global-observer'];

// Visibility is role-gated, not team-gated. Sweeping scopes honors the original
// "unable to click across every team" coverage without re-deriving the gate.
const SCOPES: TeamScope[] = ['All fleets', 'Workstations', 'Unassigned'];

test.describe('Premium • Software • Manage automations access', () => {
  test('global admin can open the Manage automations modal on All fleets', async ({ browser }) => {
    await withStaticUser(browser, 'global-admin', async (page) => {
      const software = new SoftwareTitlesPage(page);
      await software.goto();
      await software.teamDropdown.select('All fleets');

      await expect(software.manageAutomationsButton).toBeEnabled();
      await software.manageAutomationsButton.click();
      await expect(software.manageAutomationsModal).toBeVisible();
    });
  });

  test('global admin: Automations button is disabled on a specific fleet, with a tooltip', async ({ browser }) => {
    await withStaticUser(browser, 'global-admin', async (page) => {
      const software = new SoftwareTitlesPage(page);
      await software.goto();
      await software.teamDropdown.select('Workstations');

      await expect(software.manageAutomationsButton).toBeDisabled();
      // The button is disabled (swallows pointer events), so force the hover to
      // trigger the wrapping TooltipWrapper's mouseenter and reveal the reason.
      await software.manageAutomationsButton.hover({ force: true });
      await expect(page.getByText('to manage automations.')).toBeVisible();
    });
  });

  for (const key of NON_ADMIN_KEYS) {
    test(`${key} never sees the Automations button, on any fleet`, async ({ browser }) => {
      await withStaticUser(browser, key, async (page) => {
        const software = new SoftwareTitlesPage(page);
        await software.goto();

        for (const scope of SCOPES) {
          await software.teamDropdown.select(scope);
          await expect(software.manageAutomationsButton).toHaveCount(0);
        }
      });
    });
  }
});
