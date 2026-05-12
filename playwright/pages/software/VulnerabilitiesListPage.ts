import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';

/**
 * /software/vulnerabilities — the list of CVEs detected across the fleet.
 */
export class VulnerabilitiesListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;

  readonly search: Locator;
  readonly softwareTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);

    this.search = page.getByRole('textbox', { name: /Search by CVE/ });
    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
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
