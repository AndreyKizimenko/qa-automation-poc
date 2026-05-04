import { Page, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /software/versions/:id — detail page for a specific software version.
 * Shows the list of CVEs affecting this version.
 */
export class SoftwareVersionDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
  }

  /** Click into the first CVE row. Returns the clicked CVE identifier. */
  async clickFirstCve(): Promise<string> {
    const firstRow = this.table.firstRowWithLink;
    const cveCell = await this.table.cellByColumn(firstRow, 'Vulnerability');
    const cveLink = cveCell.getByRole('link');
    await expect(cveLink).toHaveText(/^CVE-\d{4}-\d+$/);
    const cveText = (await cveLink.innerText()).trim();
    await cveLink.click();
    return cveText;
  }

  async waitForReady(): Promise<void> {
    await expect(this.table.firstRow).toBeVisible();
  }
}
