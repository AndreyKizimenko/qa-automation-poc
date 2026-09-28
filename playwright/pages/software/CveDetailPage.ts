import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { DataSet } from '../components/DataSet';
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

  /** Summary term/value pairs — Severity, Probability of exploit, Detected, Affected hosts. */
  readonly summary: DataSet;

  readonly detectedLabel: Locator;
  readonly affectedHostsLabel: Locator;
  readonly description: Locator;
  readonly nvdLink: Locator;
  readonly vulnerableSoftwareHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);

    this.summary = new DataSet(page);

    this.detectedLabel = page.getByText('Detected');
    this.affectedHostsLabel = page.getByText('Affected hosts');
    // Premium-only.
    this.description = page.locator('.software-vuln-summary__description');
    this.nvdLink = page.getByRole('link', { name: 'Visit NVD page' });
    this.vulnerableSoftwareHeading = page.getByRole('heading', {
      level: 2,
      name: 'Vulnerable software',
      exact: true,
    });
  }

  /**
   * How many hosts Fleet reports as affected by this CVE. The value cell also
   * carries an "Updated N mins ago" note, so the number is parsed out rather
   * than compared as text.
   */
  async affectedHostCount(): Promise<number> {
    const text = (await this.summary.value('Affected hosts').innerText()).trim();
    const match = text.match(/[\d,]+/);
    if (!match) throw new Error(`Unexpected affected-hosts value: "${text}"`);
    return Number(match[0].replace(/,/g, ''));
  }

  /** Name, Version and Hosts of one row of the Vulnerable software table. */
  async softwareRowValues(row: Locator): Promise<{
    name: string;
    version: string;
    hosts: number;
  }> {
    const read = async (column: string): Promise<string> =>
      (await (await this.table.cellByColumn(row, column)).innerText()).trim();
    const hosts = await read('Hosts');
    return {
      name: await read('Name'),
      version: await read('Version'),
      hosts: Number(hosts.replace(/,/g, '')),
    };
  }

  /**
   * Follows a vulnerable-software row out to the hosts running that exact
   * version. "View all hosts" is a `row-hover-button` Fleet keeps hidden until
   * the row is hovered, so the click goes through `clickHoverAction` to survive
   * a hover lost to a re-render.
   */
  async viewAllHostsFor(row: Locator): Promise<void> {
    await clickHoverAction(row, row.getByText('View all hosts'));
    await expect(this.page).toHaveURL(/\/hosts\/manage\?.*software_version_id=\d+/);
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
      // NVD 301-redirects the CVE path to lowercase, so the landed URL doesn't
      // carry the identifier's original case.
      await expect(newPage).toHaveURL(
        new RegExp(`nvd\\.nist\\.gov/vuln/detail/${cve}`, 'i'),
      );
      await newPage.close();
    }

    await expect(this.table.firstRow).toBeVisible();
  }
}
