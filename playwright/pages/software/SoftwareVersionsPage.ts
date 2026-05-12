import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { FilterModal } from '../components/FilterModal';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';

/**
 * /software/versions — the list of software versions.
 *
 * Shares tabs + filter + search patterns with SoftwareTitlesPage, but operates
 * on per-version rows. Kept as a separate page object because its URL, columns,
 * and navigation targets differ.
 */
export class SoftwareVersionsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;
  readonly pagination: Pagination;

  readonly search: Locator;
  readonly showVersionsSwitch: Locator;
  readonly softwareTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);
    this.pagination = new Pagination(page);

    this.search = page.getByRole('textbox', { name: /Search by name or vulnerability/ });
    this.showVersionsSwitch = page.getByRole('switch', { name: /versions/i });
    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
  }

  async goto(opts: { fleetId?: number; vulnerable?: boolean; sort?: { key: string; direction: 'asc' | 'desc' } } = {}) {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.vulnerable) params.set('vulnerable', 'true');
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/software/versions${qs ? '?' + qs : ''}`);
    await expect(this.table.firstRow).toBeVisible();
  }

  async searchByName(name: string): Promise<void> {
    await this.search.fill(name);
    await expect(this.table.firstRow).toBeVisible();
  }
}
