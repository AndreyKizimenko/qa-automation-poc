/**
 * Premium • Software • Manage automations access. The "Automations" button
 * (which opens the "Manage automations" modal) is global-admin-only, and even
 * for an admin it is enabled only under the "All fleets" aggregate — selecting
 * a specific fleet disables it with an explanatory tooltip. Non-admins never
 * see the button at all, on any scope — global, fleet-scoped, or
 * single-fleet (where Fleet drops the scope picker altogether).
 *
 * Each static human logs into a fresh context via `withStaticUser` so the
 * shared admin storage state is left untouched.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { SoftwareTitlesPage } from '@pages';

/**
 * The button gates on isGlobalAdmin, so none of these roles ever see it —
 * assert absence, not a disabled state.
 *
 * `scopes` is what each role's picker actually offers: a global role sweeps the
 * aggregate plus both fleet kinds, a team admin sweeps only the fleets they
 * administer, and a single-fleet role has no picker at all (empty list — the
 * one view they have is the one that gets asserted). Sweeping scopes honors the
 * original "unable to click on any team" coverage without re-deriving the gate.
 */
interface NonAdminCase {
  key: StaticUserKey;
  scopes: string[];
}

const NON_ADMINS: NonAdminCase[] = [
  { key: 'global-maintainer', scopes: ['All fleets', 'Workstations', 'Unassigned'] },
  { key: 'global-observer', scopes: ['All fleets', 'Workstations', 'Unassigned'] },
  { key: 'team-admin', scopes: ['VMs', 'Workstations'] },
  { key: 'ws-maintainer', scopes: [] },
];

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

  for (const { key, scopes } of NON_ADMINS) {
    test(`${key} never sees the Automations button, on any fleet`, async ({ browser }) => {
      await withStaticUser(browser, key, async (page) => {
        const software = new SoftwareTitlesPage(page);
        await software.goto();

        if (scopes.length === 0) {
          await expect(software.teamDropdown.trigger).toHaveCount(0);
          await expect(software.manageAutomationsButton).toHaveCount(0);
          return;
        }

        for (const scope of scopes) {
          await software.teamDropdown.selectByLabel(scope);
          await expect(software.manageAutomationsButton).toHaveCount(0);
        }
      });
    });
  }
});
