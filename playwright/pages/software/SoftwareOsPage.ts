import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';

/**
 * The leading number in a cell's text, with the thousands separators Fleet
 * inserts past 999 stripped. Covers both a bare count ("197") and a labelled
 * one ("1,401 vulnerabilities"); a cell with no number — Fleet writes "---"
 * where it has found none — reads as 0.
 */
const countFrom = (text: string): number => {
  const match = text.match(/[\d,]+/);
  return match ? Number(match[0].replace(/,/g, '')) : 0;
};

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
    // A platform no host runs leaves the list empty, which is a settled result too.
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /** OS name shown in the first row's "Name" column. */
  async firstOsName(): Promise<string> {
    const cell = await this.table.cellByColumn(this.table.firstRow, 'Name');
    return (await cell.innerText()).trim();
  }

  /**
   * The first row on screen whose Vulnerabilities column carries a count — Fleet
   * renders "---" for an OS it has found none for, and those rows drill into a
   * detail page with an empty table. Any platform qualifies, including Linux,
   * whose detail page has no Vulnerabilities card; a drill-through into that
   * card uses `firstNonLinuxRowWithVulnerabilities()`.
   */
  async firstRowWithVulnerabilities(): Promise<Locator | null> {
    return this.table.findRowByColumnPattern('Vulnerabilities', /^[\d,]+ vulnerabilities$/);
  }

  /**
   * The first macOS row reporting vulnerabilities, else the first Windows one,
   * else null. Linux is left out because its detail page lists vulnerabilities
   * per kernel in a Kernels card and has no Vulnerabilities card
   * (`SoftwareOSDetailsPage.tsx`, `isLinuxLike`), and on the default host-count
   * sort a Linux row can be the first one reporting any.
   *
   * Leaves the list filtered to the platform it settled on. The list keeps the
   * previous platform's rows on screen while the filtered fetch is in flight, so
   * each pass waits until every row names the platform — macOS and Windows rows
   * carry the word in their Name — before reading one.
   */
  async firstNonLinuxRowWithVulnerabilities(): Promise<Locator | null> {
    for (const platform of ['macOS', 'Windows'] as const) {
      await this.selectPlatform(platform);
      await expect(this.table.table.locator('tbody tr').filter({ hasNotText: platform })).toHaveCount(0);
      const row = await this.firstRowWithVulnerabilities();
      if (row) return row;
    }
    return null;
  }

  /** Name, Version, Vulnerabilities and Hosts of one OS row, as rendered. */
  async rowValues(row: Locator): Promise<{
    name: string;
    version: string;
    vulnerabilities: number;
    hosts: number;
  }> {
    const read = async (column: string): Promise<string> =>
      (await (await this.table.cellByColumn(row, column)).innerText()).trim();
    return {
      name: await read('Name'),
      version: await read('Version'),
      vulnerabilities: countFrom(await read('Vulnerabilities')),
      hosts: countFrom(await read('Hosts')),
    };
  }

  /** Opens an OS row's detail page through its Name-column link. */
  async openOs(row: Locator): Promise<void> {
    await (await this.table.cellByColumn(row, 'Name')).getByRole('link').click();
    await expect(this.page).toHaveURL(/\/software\/os\/\d+/);
  }

  /**
   * Re-sorts the list by host count. "Hosts" is the OS table's only sortable
   * column (`OSTableConfig.tsx` — every other column sets `disableSortBy`), and
   * the click toggles direction, so callers assert the direction they expect
   * from the URL rather than assuming one.
   */
  async sortByHosts(): Promise<void> {
    await this.table.table.getByRole('columnheader', { name: 'Hosts' }).click();
  }

  /** Host counts in row order — the input for a sort assertion. */
  async hostCounts(): Promise<number[]> {
    const rows = this.table.table.locator('tbody tr');
    const values: number[] = [];
    for (const row of await rows.all()) {
      values.push(countFrom((await (await this.table.cellByColumn(row, 'Hosts')).innerText()).trim()));
    }
    return values;
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
