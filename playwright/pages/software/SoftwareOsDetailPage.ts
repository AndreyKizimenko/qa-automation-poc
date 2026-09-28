import { Page, Locator, expect } from '@playwright/test';
import { DataSet } from '../components/DataSet';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /software/os/:id — detail page for a specific operating system version.
 * Titles itself with the OS name and version together ("macOS 14.1.2"), summarises
 * the hosts running it, and lists that OS's vulnerabilities.
 */
export class SoftwareOsDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  /** Summary term/value pairs above the card — "Hosts" and its last-updated note. */
  readonly summary: DataSet;

  /** "<name> <version>" — the OS name and version are one heading, not two. */
  readonly nameHeading: Locator;
  readonly vulnerabilitiesHeading: Locator;
  /** "N items" above the vulnerabilities table. */
  readonly vulnerabilitiesCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.summary = new DataSet(page);

    this.nameHeading = page.getByRole('heading', { level: 1 });
    this.vulnerabilitiesHeading = page.getByRole('heading', {
      level: 2,
      name: 'Vulnerabilities',
      exact: true,
    });
    this.vulnerabilitiesCount = page.locator('.table-container__results-count');
  }

  async waitForReady(): Promise<void> {
    // Wait for the vulnerabilities table to populate
    await expect(this.table.firstRowWithLink).toBeVisible();
  }

  /**
   * How many hosts run this OS, from the summary. The value cell also carries a
   * "Updated N mins ago" note, so the number is parsed out rather than compared
   * as text.
   */
  async hostCount(): Promise<number> {
    const text = (await this.summary.value('Hosts').innerText()).trim();
    const match = text.match(/[\d,]+/);
    if (!match) throw new Error(`Unexpected host count: "${text}"`);
    return Number(match[0].replace(/,/g, ''));
  }

  /**
   * How many vulnerabilities the list reports. Fleet localises the figure past
   * 999 ("1,401 items"), so the separators are stripped before parsing.
   */
  async vulnerabilityCount(): Promise<number> {
    const text = (await this.vulnerabilitiesCount.innerText()).trim();
    const match = text.match(/([\d,]+)\s+items?/);
    if (!match) throw new Error(`Unexpected vulnerability count: "${text}"`);
    return Number(match[1].replace(/,/g, ''));
  }

  /** One column header of the vulnerabilities table by its exact label. */
  columnHeader(name: string): Locator {
    return this.table.table.getByRole('columnheader', { name, exact: true });
  }
}
