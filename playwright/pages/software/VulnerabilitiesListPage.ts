import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { clickHoverAction } from '../components/clickHoverAction';

/**
 * /software/vulnerabilities — the list of CVEs detected across the fleet.
 */
export class VulnerabilitiesListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;

  readonly search: Locator;
  readonly inventoryTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;
  readonly exploitedFilter: Locator;
  readonly exploitedFilterValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);

    this.search = page.getByRole('textbox', { name: /Search by CVE/ });
    // First software subnav tab; renders <TabText>Inventory</TabText> via react-tabs.
    this.inventoryTab = page.getByRole('tab', { name: 'Inventory' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
    // Exploited-vulnerabilities filter is Fleet's DropdownWrapper (react-select
    // v5): the trigger exposes no role, so it's scoped by its BEM container;
    // each option carries data-testid="dropdown-option".
    this.exploitedFilter = page.locator(
      '.software-vulnerabilities-table__exploited-vulnerabilities-filter .react-select__control',
    );
    this.exploitedFilterValue = page.locator(
      '.software-vulnerabilities-table__exploited-vulnerabilities-filter .react-select__single-value',
    );
  }

  /** Select an exploited-vulnerabilities filter option by its visible label. */
  async selectExploitedFilter(
    label: 'All vulnerabilities' | 'Exploited vulnerabilities',
  ): Promise<void> {
    if ((await this.exploitedFilterValue.textContent())?.trim() === label) return;
    await this.exploitedFilter.click();
    const option = this.page.getByTestId('dropdown-option').filter({ hasText: label });
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.exploitedFilterValue).toHaveText(label);
  }

  async goto(opts: { fleetId?: number; exploit?: boolean; sort?: { key: string; direction: 'asc' | 'desc' } } = {}) {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.exploit) params.set('exploit', 'true');
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/software/vulnerabilities${qs ? '?' + qs : ''}`);
    await expect(this.table.firstRow).toBeVisible();
  }

  /** Read the first CVE identifier in the table without clicking. */
  async firstCveName(): Promise<string> {
    const firstRow = this.table.firstRowWithLink;
    const cveCell = await this.table.cellByColumn(firstRow, 'Vulnerability');
    const cveLink = cveCell.getByRole('link');
    await expect(cveLink).toHaveText(/^CVE-\d{4}-\d+$/);
    return (await cveLink.innerText()).trim();
  }

  /**
   * Every CVE identifier on the current page, in row order. Gives a caller a
   * pool to pick from rather than only the top row, which matters because Fleet
   * matches CVEs faster than its feeds enrich them and 404s the detail page for
   * any it has no metadata for — and the newest match sorts first
   * (fleetdm/fleet#49913). Pair with `findRenderableCve`.
   */
  async cveNames(): Promise<string[]> {
    const links = this.table.table.locator('tbody tr td:first-child a');
    await expect(links.first()).toBeVisible();
    return (await links.allInnerTexts()).map((name) => name.trim());
  }

  /** One CVE's row on the current page, by its Vulnerability link. */
  row(cve: string): Locator {
    return this.table.table
      .locator('tbody')
      .getByRole('row')
      .filter({ has: this.page.getByRole('link', { name: cve, exact: true }) });
  }

  /** A CVE row's Hosts count, as rendered (the hourly job's figure for the scope). */
  async hostsCount(cve: string): Promise<number> {
    const cell = await this.table.cellByColumn(this.row(cve), 'Hosts');
    return Number((await cell.innerText()).trim().replace(/,/g, ''));
  }

  /** A CVE row's hover-only "View all hosts": the Hosts list filtered by the CVE. */
  async viewAllHostsFor(cve: string): Promise<void> {
    const row = this.row(cve);
    await expect(row).toBeVisible();
    await clickHoverAction(row, row.getByRole('button', { name: 'View all hosts' }));
    await expect(this.page).toHaveURL(/\/hosts\/manage\?.*vulnerability=/);
  }

  /**
   * For each CVE on the page, whether its Probability of exploit cell carries
   * the CISA "exploited in the wild" icon. The icon is an unnamed image inside
   * that cell (premium; `ProbabilityOfExploit` draws it only beside a score),
   * so the column is found by its header once and read row by row.
   */
  async exploitMarks(): Promise<Map<string, boolean>> {
    await this.table.waitForSettled();
    const headers = (await this.table.table.locator('thead:not(.active-selection) th').allInnerTexts()).map((h) =>
      h.trim(),
    );
    const column = headers.indexOf('Probability of exploit');
    if (column < 0) throw new Error(`No "Probability of exploit" column in ${JSON.stringify(headers)}`);
    const marks = new Map<string, boolean>();
    for (const row of await this.table.table.locator('tbody').getByRole('row').all()) {
      const cve = (await row.getByRole('link').first().innerText()).trim();
      marks.set(cve, (await row.getByRole('cell').nth(column).getByRole('img').count()) > 0);
    }
    return marks;
  }

  /** The tooltip that hovering an exploit icon opens. */
  get exploitTooltip(): Locator {
    return this.page.getByRole('tooltip').filter({ hasText: 'actively exploited in the wild' });
  }

  /** Hovers one CVE's exploit icon, which opens {@link exploitTooltip}. */
  async hoverExploitIcon(cve: string): Promise<void> {
    const cell = await this.table.cellByColumn(this.row(cve), 'Probability of exploit');
    await cell.getByRole('img').hover();
  }

  /** Click the first CVE in the table. Returns the clicked CVE identifier. */
  async clickFirstCve(): Promise<string> {
    const firstRow = this.table.firstRowWithLink;
    const cveCell = await this.table.cellByColumn(firstRow, 'Vulnerability');
    const cveLink = cveCell.getByRole('link');
    const cveText = (await cveLink.innerText()).trim();
    await cveLink.click();
    return cveText;
  }
}
