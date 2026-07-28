import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * `/hosts/:id/reports/:reportId` — one report's stored results **for a single
 * host**, reached from a report card's Actions → Show details on the host's
 * Reports tab. That action only exists once the report has a stored result for
 * the host, so this page is unreachable for a report that has never run there.
 */
export class HostQueryReportPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  /** The page titles itself with the host's name, not the report's. */
  readonly hostHeading: Locator;
  readonly backButton: Locator;
  readonly viewAllHostsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);

    this.hostHeading = page.getByRole('heading', { level: 1 });
    this.backButton = page.getByRole('button', { name: 'Back to host details' });
    this.viewAllHostsButton = page.getByRole('button', { name: 'View data for all hosts' });
  }

  async waitForReady(): Promise<void> {
    await expect(this.backButton).toBeVisible();
  }

  /** Leaves the browser on the report's own results page, across every host. */
  async viewAllHosts(): Promise<void> {
    await this.viewAllHostsButton.click();
  }
}
