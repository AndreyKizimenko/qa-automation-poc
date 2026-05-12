import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * /policies/manage — list of policies. Supports team scoping and an
 * `automation_type` query param for filtering (Other / Software).
 *
 * Bulk delete: select rows via the row checkbox, then click the "Delete"
 * action button that appears in the table header. The confirmation modal
 * is titled "Delete policies".
 */
export class PoliciesListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly addPolicyButton: Locator;

  readonly search: Locator;

  readonly bulkDeleteButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    this.addPolicyButton = page.getByRole('button', { name: /add policy/i });
    this.search = page.getByPlaceholder('Search by name');

    this.bulkDeleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete policies' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  async goto(opts: { fleetId?: number; automationType?: 'other' | 'software' } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.automationType) params.set('automation_type', opts.automationType);
    const qs = params.toString();
    await this.page.goto(`/policies/manage${qs ? '?' + qs : ''}`);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /** Click "Add policy" → editor for a new policy. */
  async addPolicy(): Promise<void> {
    await this.addPolicyButton.click();
    await expect(this.page).toHaveURL(/\/policies\/new/);
  }

  /** Click a policy's name link in the list to open its details page. */
  async openPolicy(name: string): Promise<void> {
    await this.page.getByRole('link', { name, exact: true }).click();
    await expect(this.page).toHaveURL(/\/policies\/\d+/);
  }

  /**
   * Selects the row matching `name` via its checkbox, clicks the bulk
   * "Delete" button, and confirms in the "Delete policies" modal. The
   * list is narrowed by name first so a row past the first page is
   * still reachable.
   */
  async deletePolicy(name: string): Promise<void> {
    await this.search.fill(name);
    const row = this.table.rowWith(name);
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').check();
    await this.bulkDeleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }

  /** Reload the current page with an automation_type filter applied. */
  async applyAutomationFilter(type: 'other' | 'software'): Promise<void> {
    const url = new URL(this.page.url());
    url.searchParams.set('automation_type', type);
    await this.page.goto(url.pathname + url.search);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }
}
