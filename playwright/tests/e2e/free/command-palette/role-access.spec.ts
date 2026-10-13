/**
 * Free • Command palette • role access. The tier-specific half of a global
 * maintainer's palette: the Controls group and the script and variable
 * commands, which free offers on every page because free has one implicit
 * fleet, while premium offers them only inside a specific fleet. The groups
 * both tiers share for each role are in tests/e2e/shared/command-palette/.
 *
 * Driven with the `global-maintainer` static user through `withStaticUser`.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { CommandPalette, DashboardPage } from '@pages';

test.describe('Free • Command palette • role access', () => {
  test('a global maintainer gets the Controls group and the script and variable commands', async ({
    browser,
  }) => {
    await withStaticUser(browser, 'global-maintainer', async (page) => {
      const palette = new CommandPalette(page);
      await new DashboardPage(page).goto();
      await palette.open();

      const controls = palette.group('Controls');
      for (const parent of ['OS settings', 'Scripts', 'Variables']) {
        await expect(
          controls.getByRole('option', { name: parent, exact: true }),
          `${parent} should be in the Controls group`,
        ).toBeVisible();
      }
      for (const label of ['Add script', 'Add custom variable']) {
        await expect(palette.item(label), `${label} should be offered`).toBeVisible();
      }
    });
  });
});
