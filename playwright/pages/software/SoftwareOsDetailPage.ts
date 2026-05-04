import { Page, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /software/os/:id — detail page for a specific operating system version.
 * Shows the vulnerabilities table for that OS.
 */
export class SoftwareOsDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
  }

  async waitForReady(): Promise<void> {
    // Wait for the vulnerabilities table to populate
    await expect(this.table.firstRowWithLink).toBeVisible();
  }
}
