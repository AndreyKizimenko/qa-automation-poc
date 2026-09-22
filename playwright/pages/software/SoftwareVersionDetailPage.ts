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

  /**
   * The CVE identifiers rendered on the current page, in the order the table
   * shows them. Pair with `findRenderableCve` from `@helpers/api` to choose one
   * Fleet's CVE detail endpoint can serve, then hand it to {@link clickCve} —
   * the top row is the newest match and so the likeliest to 404
   * (fleetdm/fleet#49913).
   */
  async cveNames(): Promise<string[]> {
    const links = this.table.table.locator('tbody a', { hasText: /^CVE-\d{4}-\d+$/ });
    await expect(links.first()).toBeVisible();
    const names = await links.allInnerTexts();
    return names.map((n) => n.trim()).filter((n) => /^CVE-\d{4}-\d+$/.test(n));
  }

  /** Click a named CVE's row link. */
  async clickCve(cve: string): Promise<void> {
    const cveLink = this.table.table.locator('tbody a', { hasText: cve }).first();
    await expect(cveLink).toHaveText(cve);
    await cveLink.click();
  }

  async waitForReady(): Promise<void> {
    await expect(this.table.firstRow).toBeVisible();
  }
}
