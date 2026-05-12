import { Page, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
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
   * Click the first row's "View all hosts" button. The button uses
   * `row-hover-button` and only renders while the row is hovered.
   */
  async viewHostsForFirstOs(): Promise<void> {
    const firstRow = this.table.firstRow;
    await clickHoverAction(firstRow, firstRow.getByRole('button', { name: 'View all hosts' }));
  }
}
