import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';

/**
 * /software/os — list of operating systems detected across the fleet, with
 * host counts and vulnerability rollups per OS.
 */
export class SoftwareOsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;

  readonly softwareTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);

    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
  }

  async goto(opts: { fleetId?: number; platform?: 'darwin' | 'windows' | 'linux'; sort?: { key: string; direction: 'asc' | 'desc' } } = {}) {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.platform) params.set('platform', opts.platform);
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/software/os${qs ? '?' + qs : ''}`);
    await expect(this.table.firstRow).toBeVisible();
  }

  /** Click the first row to open that OS's detail page. */
  async clickFirstOs(): Promise<void> {
    await this.table.firstRow.click();
  }

  /**
   * Click the first row's "View all hosts" button. The button uses
   * `row-hover-button` and only renders while the row is hovered, so the
   * caller doesn't need to wait for the OS detail page to load.
   */
  async viewHostsForFirstOs(): Promise<void> {
    const firstRow = this.table.firstRow;
    await clickHoverAction(firstRow, firstRow.getByRole('button', { name: 'View all hosts' }));
  }
}
