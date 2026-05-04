import { Page, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /controls/os-updates — table of OS versions currently in the fleet with
 * host counts. Each row has a hover-only "View all hosts" button.
 */
export class OsUpdatesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/controls/os-updates');
    await expect(this.table.firstRow).toBeVisible();
  }

  /**
   * Hover the first OS row and click its "View all hosts" button. The button
   * uses `row-hover-button` and is only visible on hover, so we must hover
   * first.
   */
  async viewHostsForFirstOs(): Promise<void> {
    const firstRow = this.table.firstRow;
    await firstRow.hover();
    await firstRow.getByRole('button', { name: 'View all hosts' }).click();
  }
}
