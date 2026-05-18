import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';

/**
 * `/software/library` — the Library tab introduced by fleetdm/fleet#44467
 * when the old `/software/titles` page was split into Inventory + Library.
 * Lists software titles managed via Fleet's installer pipeline only
 * (custom packages, FMA, VPP, Android) — host-reported software lives on
 * the Inventory tab and no longer mixes in here, so verify-after-add and
 * verify-after-delete should anchor on this page instead of inventory.
 */
export class SoftwareLibraryPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;

  readonly tab: Locator;
  readonly search: Locator;
  readonly selfServiceSwitch: Locator;
  readonly addSoftwareButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);

    this.tab = page.getByRole('tab', { name: 'Library' });
    this.search = page.getByPlaceholder('Search by name');
    this.selfServiceSwitch = page.getByRole('switch', { name: 'Self-service only' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software' });
  }

  /** `fleetId=0` targets "No team". Omit to use the current team. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/software/library${qs}`);
    await expect(this.tab).toHaveAttribute('aria-selected', 'true');
    // Either the data table or the "No software available" empty state.
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  async searchByName(name: string): Promise<void> {
    await this.search.fill(name);
    await expect(this.table.firstRow).toBeVisible();
  }
}
