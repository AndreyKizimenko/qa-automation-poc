import { Page, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /labels/manage — the list of host labels. Label table rows don't contain
 * links (labels are edited via row actions), so we wait for any row rather
 * than a row with a link.
 */
export class LabelsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/labels/manage');
    await expect(this.table.firstRow).toBeVisible();
  }
}
