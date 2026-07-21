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

  readonly inventoryTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  // Platform filter is Fleet's DropdownWrapper (react-select v5): the visible
  // trigger exposes no role, so it's scoped by its BEM container; each option
  // carries data-testid="dropdown-option".
  readonly platformFilter: Locator;
  readonly platformFilterValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);

    // First software subnav tab; renders <TabText>Inventory</TabText> via react-tabs.
    this.inventoryTab = page.getByRole('tab', { name: 'Inventory' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });

    this.platformFilter = page.locator('.software-os-table__platform-dropdown .react-select__control');
    this.platformFilterValue = page.locator('.software-os-table__platform-dropdown .react-select__single-value');
  }

  /** Select a platform-filter option by its visible label. */
  async selectPlatform(
    label: 'All platforms' | 'macOS' | 'Windows' | 'Linux' | 'ChromeOS' | 'iOS' | 'iPadOS' | 'Android',
  ): Promise<void> {
    if ((await this.platformFilterValue.textContent())?.trim() === label) return;
    await this.platformFilter.click();
    const option = this.page.getByTestId('dropdown-option').filter({ hasText: label });
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.platformFilterValue).toHaveText(label);
    await expect(this.table.firstRow).toBeVisible();
  }

  /** OS name shown in the first row's "Name" column. */
  async firstOsName(): Promise<string> {
    const cell = await this.table.cellByColumn(this.table.firstRow, 'Name');
    return (await cell.innerText()).trim();
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
