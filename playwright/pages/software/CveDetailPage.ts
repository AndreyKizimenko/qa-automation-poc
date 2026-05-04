import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /software/vulnerabilities/:cve — detail page for a specific CVE.
 * Shows CVE metadata (severity, probability, published/detected dates),
 * a link to the NVD page, and a table of vulnerable software versions.
 */
export class CveDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  readonly detectedLabel: Locator;
  readonly affectedHostsLabel: Locator;
  readonly description: Locator;
  readonly nvdLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);

    this.detectedLabel = page.getByText('Detected');
    this.affectedHostsLabel = page.getByText('Affected hosts');
    // Premium-only.
    this.description = page.locator('.software-vuln-summary__description');
    this.nvdLink = page.getByRole('link', { name: 'Visit NVD page' });
  }

  async goto(cve: string): Promise<void> {
    await this.page.goto(`/software/vulnerabilities/${cve}`);
    await this.waitForReady(cve);
  }

  heading(cve: string): Locator {
    return this.page.getByRole('heading', { name: cve, level: 1 });
  }

  async waitForReady(cve: string): Promise<void> {
    // Extended timeout — the page hydrates from an enrichment API that's
    // slow on a cold cache.
    await expect(this.heading(cve)).toBeVisible({ timeout: 10000 });
  }

  /** `clickNvdLink` actually clicks the link (slow); default just asserts the href. */
  async assertOk(cve: string, opts: { clickNvdLink?: boolean } = {}): Promise<void> {
    await this.waitForReady(cve);

    await expect(this.detectedLabel).toBeVisible();
    await expect(this.affectedHostsLabel).toBeVisible();

    await expect(this.nvdLink).toBeVisible();
    await expect(this.nvdLink).toHaveAttribute(
      'href',
      `https://nvd.nist.gov/vuln/detail/${cve}`,
    );

    if (opts.clickNvdLink) {
      const [newPage] = await Promise.all([
        this.page.context().waitForEvent('page'),
        this.nvdLink.click(),
      ]);
      await expect(newPage).toHaveURL(new RegExp(`nvd\\.nist\\.gov/vuln/detail/${cve}`));
      await newPage.close();
    }

    await expect(this.table.firstRow).toBeVisible();
  }
}
