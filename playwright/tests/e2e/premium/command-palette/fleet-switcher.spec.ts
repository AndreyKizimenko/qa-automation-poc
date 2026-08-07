/**
 * Premium • Command palette • fleet switcher.
 *
 * Switching fleet from the palette doesn't reload the app — it updates the
 * fleet in context and pushes a URL — so the item list has to rebuild itself
 * from the new scope while the dialog stays open. That makes the switcher the
 * palette's largest piece of live-state wiring: a stale memo would leave a
 * user looking at the previous fleet's commands.
 *
 * The switcher button also sits inside cmdk's own keyboard surface, so it has
 * to stop Enter from reaching the list underneath it.
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Command palette • fleet switcher', () => {
  test('switching fleet rebuilds the item list without a reload', async ({
    palette,
    dashboard,
    page,
    workstationsFleetId,
  }) => {
    await dashboard.goto();
    await palette.open();

    // A context restored from the stored admin state carries no fleet
    // selection, so the palette opens on All fleets; the switcher's own label
    // is the palette's view of that scope.
    await expect(palette.fleetSwitcher).toHaveAccessibleName(
      'Switch fleet (currently All fleets)',
    );

    // Both of these need a specific fleet, so on All fleets they don't exist.
    await expect(palette.item('Controls')).toHaveCount(0);
    await expect(palette.item('Add custom package')).toHaveCount(0);

    await palette.openFleetSwitcher();
    await expect(palette.input).toHaveAttribute('placeholder', 'Search a fleet...');
    await palette.row('Workstations').click();

    // Back on the root list, still open, now scoped to the chosen fleet.
    await expect(palette.dialog).toBeVisible();
    await expect(palette.input).toHaveAttribute(
      'placeholder',
      'Search for a page or command...',
    );
    await expect(page).toHaveURL(new RegExp(`fleet_id=${workstationsFleetId}`));
    await expect(palette.fleetSwitcher).toHaveAccessibleName(
      'Switch fleet (currently Workstations)',
    );

    // The rows the new scope unlocks appear without the page being reloaded.
    await expect(palette.item('Controls')).toBeVisible();
    await expect(palette.item('Add custom package')).toBeVisible();
  });

  test('Enter on the switcher opens switch-fleet without activating the highlighted row', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    // Leaves a row highlighted whose destination differs from the current page,
    // so a leaked Enter would show up as a navigation.
    await palette.search('policies');
    await expect(palette.item('Policies')).toHaveAttribute('aria-selected', 'true');

    // Reached the way a keyboard user reaches it: the switcher is the next
    // tab stop after the search input.
    await page.keyboard.press('Tab');
    await expect(palette.fleetSwitcher).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(palette.input).toHaveAttribute('placeholder', 'Search a fleet...');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
