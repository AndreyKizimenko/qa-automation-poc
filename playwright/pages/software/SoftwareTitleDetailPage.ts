import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { SoftwareInstallerCard } from '../components/SoftwareInstallerCard';

/**
 * /software/titles/:id — versions table for a software title. Titles with
 * an uploaded installer also expose a `SoftwareInstallerCard`.
 */
export class SoftwareTitleDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly installerCard: SoftwareInstallerCard;
  /**
   * The page's main software-name heading. The visible text is the title's
   * display name, but the accessible name is the static `software display
   * name` aria-label, so getByLabel resolves the element correctly.
   */
  readonly displayHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.installerCard = new SoftwareInstallerCard(page);
    this.displayHeading = page.getByLabel('software display name');
  }

  /** The visible display-name text shown in the title's `<h1>` heading. */
  async displayName(): Promise<string> {
    return (await this.displayHeading.innerText()).trim();
  }

  async goto(opts: { titleId: number; fleetId?: number }): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/software/titles/${opts.titleId}${qs}`);
  }

  async clickVersion(version: string): Promise<void> {
    await this.table.rowWith(version).getByRole('link', { name: version }).first().click();
  }

  /** Throws if no version has vulnerabilities (`---` in the column). */
  async clickFirstVersionWithVulnerabilities(): Promise<void> {
    const rows = this.table.table.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const vulnCell = await this.table.cellByColumn(row, 'Vulnerabilities');
      const text = (await vulnCell.innerText()).trim();
      if (text !== '---') {
        await row.locator('td').first().getByRole('link').first().click();
        return;
      }
    }
    throw new Error('No version with vulnerabilities found on this software title');
  }

  async waitForReady(): Promise<void> {
    await expect(this.table.firstRow).toBeVisible();
  }
}
