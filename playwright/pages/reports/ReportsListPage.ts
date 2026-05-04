import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * /reports/manage (alias: /queries/manage) — list of saved reports/queries.
 * Supports team scoping via the team dropdown, platform filtering, and search.
 *
 * Bulk delete: select rows via their row checkbox, then click the "Delete"
 * action button that appears in the table header. The confirmation modal
 * is titled "Delete reports".
 */
export class ReportsListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly search: Locator;
  readonly addReportButton: Locator;

  readonly bulkDeleteButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    this.search = page.getByPlaceholder('Search by name');
    this.addReportButton = page.getByRole('button', { name: /add report/i });

    // Bulk-action bar appears once a row is selected; the trash-labelled
    // primary action is named "delete reports" in source but renders as
    // "Delete" — match the visible label.
    this.bulkDeleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete reports' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  async goto(opts: { fleetId?: number; platform?: string } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.platform) params.set('platform', opts.platform);
    const qs = params.toString();
    await this.page.goto(`/reports/manage${qs ? '?' + qs : ''}`);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /** Click "Add report" → editor for a new report. */
  async addReport(): Promise<void> {
    await this.addReportButton.click();
    await expect(this.page).toHaveURL(/\/reports\/new/);
  }

  /**
   * Filters by name first to ensure the row is visible on the current
   * page, then selects the row's checkbox, clicks the bulk-action
   * "Delete" button, and confirms in the modal.
   */
  async deleteReport(name: string): Promise<void> {
    await this.search.fill(name);
    const row = this.table.rowWith(name);
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').check();
    await this.bulkDeleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }

  /** Adds `?platform=` to the current URL, preserving other query params. */
  async applyPlatformFilter(platform: string): Promise<void> {
    const url = new URL(this.page.url());
    url.searchParams.set('platform', platform);
    await this.page.goto(url.pathname + url.search);
    await expect(this.table.firstRowWithLink).toBeVisible();
  }

  async firstReportName(): Promise<string> {
    const firstRow = this.table.firstRowWithLink;
    // Skip the checkbox column.
    const nameCell = firstRow.locator('td').nth(1);
    // Read from the truncated-text span when present — it holds the
    // full text without any tooltip-suffix the cell may render.
    const truncated = nameCell.locator('.data-table__tooltip-truncated-text');
    if (await truncated.count() > 0) return (await truncated.innerText()).trim();
    return (await nameCell.innerText()).trim();
  }
}
