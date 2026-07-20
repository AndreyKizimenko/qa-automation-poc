import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/software/add/fleet-maintained` — catalog of pre-packaged apps. Each row
 * has a Name column plus one cell per supported platform (macOS, Windows).
 * A platform cell is either an "Add" button (not yet on the fleet), a
 * `success-icon` (already added — clickable tooltip links to the title),
 * or an empty `TextCell` with an unavailable-on-this-platform tooltip.
 */
export class FleetMaintainedAppsPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly heading: Locator;
  readonly tab: Locator;
  readonly table: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.tab = page.getByRole('tab', { name: 'Fleet-maintained' });
    this.table = page.getByRole('table');
    this.searchInput = page.getByPlaceholder(/search/i);
  }

  /**
   * Direct URL navigation. Reserved for verification steps in the same
   * sub-test (e.g. "expectAddedFor" after an add) and for the `delete`
   * sub-test — both follow the suite's convention of skipping the full
   * click-through dance on subsequent navigations.
   */
  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/fleet-maintained?fleet_id=${opts.fleetId}`);
    await this.expectLoaded();
  }

  /**
   * Switch to this tab from another Add software tab (Custom package /
   * App store). Idempotent — a no-op if already selected. Carries the
   * current `fleet_id` query param through the tab navigation.
   */
  async openTab(): Promise<void> {
    if ((await this.tab.getAttribute('aria-selected')) !== 'true') {
      await this.tab.click();
      await expect(this.page).toHaveURL(/\/software\/add\/fleet-maintained/);
    }
    await this.expectLoaded();
  }

  /**
   * Page-shell readiness only — the "Add software" heading and the selected
   * Fleet-maintained tab. The catalog is server-side paginated (100 apps per
   * page) and reached via searchFor() next, so this doesn't gate on the table.
   *
   * The shell waits keep modest headroom past the default expect timeout
   * because the Add software route depends on the large JS bundle, which the
   * shared instance serves slowly under concurrent load (see the
   * playwright.config.ts timeout note and fleetdm/fleet#45682).
   */
  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.tab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
  }

  /**
   * Filters the catalog down to `name` via the search box before any row
   * lookup. The catalog is server-side paginated (100 apps per page), so a
   * target app isn't guaranteed to be on the visible page; typing drives the
   * server-side `?query=` filter, collapsing the table to the matching row(s).
   * Idempotent — re-filling the same query is a no-op once the row is shown.
   */
  async searchFor(name: string): Promise<void> {
    await expect(this.searchInput).toBeVisible();
    await this.searchInput.fill(name);
    await expect(this.rowByName(name)).toBeVisible();
  }

  rowByName(name: string): Locator {
    return this.table.getByRole('row').filter({ hasText: new RegExp(`^${escapeRegExp(name)}`, 'i') });
  }

  /**
   * The `<td>` for the platform column on `name`'s row. Always a fixed
   * column index — every row renders both platform cells regardless of
   * which platforms the app actually supports.
   */
  cellByPlatform(name: string, platform: 'macOS' | 'Windows'): Locator {
    const cellIndex = platform === 'macOS' ? 1 : 2;
    return this.rowByName(name).locator('td').nth(cellIndex);
  }

  /**
   * Click the platform-specific "Add" button for a row. Scopes by column
   * so it works even when the other column shows a `success-icon` or an
   * unavailable-for-this-platform empty cell.
   */
  async clickAdd(name: string, platform: 'macOS' | 'Windows'): Promise<void> {
    await this.searchFor(name);
    await this.cellByPlatform(name, platform).getByRole('button', { name: 'Add' }).click();
  }

  async expectAddedFor(name: string, platform: 'macOS' | 'Windows'): Promise<void> {
    await this.searchFor(name);
    const cell = this.cellByPlatform(name, platform);
    await expect(cell.getByTestId('success-icon')).toBeVisible();
    await expect(cell.getByRole('button', { name: 'Add' })).toHaveCount(0);
  }

  async expectNotAddedFor(name: string, platform: 'macOS' | 'Windows'): Promise<void> {
    await this.searchFor(name);
    const cell = this.cellByPlatform(name, platform);
    await expect(cell.getByRole('button', { name: 'Add' })).toBeVisible();
    await expect(cell.getByTestId('success-icon')).toHaveCount(0);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
