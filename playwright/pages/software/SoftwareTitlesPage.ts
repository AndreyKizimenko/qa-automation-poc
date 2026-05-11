import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { FilterModal } from '../components/FilterModal';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';

/**
 * /software/titles — the list of installed software with vulnerability counts.
 */
export class SoftwareTitlesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;

  // Page controls
  readonly search: Locator;
  readonly showVersionsSwitch: Locator;
  readonly manageAutomationsButton: Locator;
  readonly addSoftwareButton: Locator;

  // Tabs (Software / OS / Vulnerabilities)
  readonly softwareTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);

    this.search = page.getByRole('textbox', { name: /Search by name or vulnerability/ });
    this.showVersionsSwitch = page.getByRole('switch', { name: /versions/i });
    this.manageAutomationsButton = page.getByRole('button', { name: 'Manage automations' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software' });

    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
  }

  async goto(opts: {
    fleetId?: number;
    vulnerable?: boolean;
    availableForInstall?: boolean;
    sort?: { key: string; direction: 'asc' | 'desc' };
  } = {}) {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.vulnerable) params.set('vulnerable', 'true');
    if (opts.availableForInstall) params.set('available_for_install', 'true');
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/software/titles${qs ? '?' + qs : ''}`);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  async searchByName(name: string): Promise<void> {
    await this.search.fill(name);
    await expect(this.table.firstRow).toBeVisible();
  }

  /**
   * Click into the "Vulnerabilities" tab. Returns after the URL has changed
   * and the new table has rendered.
   */
  async gotoVulnerabilitiesTab(): Promise<void> {
    await this.vulnerabilitiesTab.click();
    await expect(this.page).toHaveURL(/\/software\/vulnerabilities/);
    await expect(this.table.firstRow).toBeVisible();
  }

  /**
   * Click into a software title by name. Assumes the table is already
   * showing the software (e.g. after `searchByName`).
   */
  async clickSoftwareTitle(name: string): Promise<void> {
    const row = this.table.rowWith(name).first();
    await row.getByRole('link', { name }).first().click();
  }

  /** Click the first software title's name link in the current view. */
  async clickFirstSoftwareTitle(): Promise<void> {
    await this.table.firstRowWithLink.locator('td').first().getByRole('link').first().click();
  }

  /**
   * Scan paginated rows on the current filtered view to find one software
   * title per target "Type" value. Returns a Map keyed by the target string.
   * Stops paginating once all target types are found or `maxPages` is reached.
   *
   * Useful for discovering a macOS/Linux/Windows software title for subsequent
   * per-OS flow tests.
   */
  async findByTypes(
    targetTypes: string[],
    maxPages = 10,
  ): Promise<Map<string, { name: string; type: string }>> {
    const found = new Map<string, { name: string; type: string }>();
    const remaining = new Set(targetTypes);

    for (let pageNum = 0; pageNum < maxPages && remaining.size > 0; pageNum++) {
      if (pageNum > 0) {
        if (!(await this.pagination.nextIfEnabled(this.table))) break;
      }

      const rows = this.table.table.locator('tbody tr');
      const rowCount = await rows.count();

      for (let i = 0; i < rowCount && remaining.size > 0; i++) {
        const row = rows.nth(i);
        const typeCell = await this.table.cellByColumn(row, 'Type');
        const type = (await typeCell.innerText()).trim();

        for (const target of remaining) {
          if (type.includes(target)) {
            const nameCell = await this.table.cellByColumn(row, 'Name');
            const link = nameCell.getByRole('link').first();
            const name = (await link.innerText()).trim();
            found.set(target, { name, type });
            remaining.delete(target);
            break;
          }
        }
      }
    }

    return found;
  }
}
