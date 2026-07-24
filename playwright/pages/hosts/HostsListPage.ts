import { Page, Locator, expect, Download } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { StatusFilter } from '../components/StatusFilter';
import { LabelFilter } from '../components/LabelFilter';
import { Toast } from '../components/Toast';

/**
 * /hosts/manage — the list of all hosts enrolled in Fleet.
 */
export class HostsListPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;
  readonly statusFilter: StatusFilter;
  readonly labelFilter: LabelFilter;
  readonly toast: Toast;

  readonly search: Locator;
  readonly addHostsButton: Locator;
  readonly editColumnsButton: Locator;
  readonly exportHostsButton: Locator;
  readonly filterPill: Locator;

  readonly editColumnsModal: Locator;
  readonly saveColumnsButton: Locator;

  // Enroll-secret modals (shared EnrollSecrets components).
  readonly enrollSecretsModal: Locator;
  readonly addSecretButton: Locator;
  readonly secretEditorModal: Locator;
  readonly secretInput: Locator;
  readonly saveSecretButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);
    this.statusFilter = new StatusFilter(page);
    this.labelFilter = new LabelFilter(page);
    this.toast = new Toast(page);

    this.search = page.getByPlaceholder('Search');
    this.addHostsButton = page.getByRole('button', { name: 'Add hosts' });
    this.editColumnsButton = page.getByRole('button', { name: /edit columns/i });
    this.exportHostsButton = page.getByRole('button', { name: 'Export hosts' });
    // FilterPill (frontend/.../ManageHostsPage/components/FilterPill) renders
    // role="status" with aria-label "hosts filtered by <label>" when the list
    // is scoped by a software title, OS, policy, etc.
    this.filterPill = page.getByRole('status', { name: /hosts filtered by/ });

    this.editColumnsModal = page.locator('.modal__modal_container').filter({ hasText: 'Edit columns' });
    this.saveColumnsButton = this.editColumnsModal.getByRole('button', { name: 'Save', exact: true });

    this.enrollSecretsModal = page.locator('.modal__modal_container').filter({ hasText: 'Manage enroll secrets' });
    this.addSecretButton = this.enrollSecretsModal.getByRole('button', { name: 'Add secret' });
    // SecretEditorModal shares the "Add secret" title with the button above, so
    // scope it by its unique helper text instead.
    this.secretEditorModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Must contain at least 32 characters' });
    this.secretInput = this.secretEditorModal.getByRole('textbox', { name: 'Secret' });
    this.saveSecretButton = this.secretEditorModal.getByRole('button', { name: 'Save', exact: true });
  }

  /**
   * Open the "Manage enroll secrets" modal for a fleet via its deep-link query
   * param (avoids hunting the header/empty-state button).
   */
  async openEnrollSecrets(fleetId: number): Promise<void> {
    await this.page.goto(`/hosts/manage?fleet_id=${fleetId}&manage_enroll_secrets=1`);
    await expect(this.enrollSecretsModal).toBeVisible();
  }

  /**
   * Add a new enroll secret: opens the editor (pre-filled with a generated
   * secret), captures it, and saves. Returns the added secret string.
   */
  async addEnrollSecret(): Promise<string> {
    await this.addSecretButton.click();
    await expect(this.secretEditorModal).toBeVisible();
    const secret = await this.secretInput.inputValue();
    await this.saveSecretButton.click();
    return secret;
  }

  async goto(opts: { fleetId?: number; sort?: { key: string; direction: 'asc' | 'desc' } } = {}) {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    if (opts.sort) {
      params.set('order_key', opts.sort.key);
      params.set('order_direction', opts.sort.direction);
    }
    const qs = params.toString();
    await this.page.goto(`/hosts/manage${qs ? '?' + qs : ''}`);
    await expect(this.table.firstRowWithLink).toBeVisible();
  }

  /** Read the display name of the first host in the list. */
  async firstHostName(): Promise<string> {
    const link = this.table.firstRowWithLink.getByRole('link').first();
    return (await link.textContent())?.trim() ?? '';
  }

  /** Click the first host in the list — navigates to its detail page. */
  async clickFirstHost(): Promise<void> {
    await this.table.firstRowWithLink.getByRole('link').first().click();
  }

  /** Clicks "Export hosts" and returns the CSV download of the current view. */
  async exportHosts(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.exportHostsButton.click();
    return downloadPromise;
  }

  /** A hosts-table column header by its visible name. */
  columnHeader(name: string): Locator {
    return this.table.table.getByRole('columnheader', { name });
  }

  /**
   * Toggles a column's visibility via the Edit columns modal and saves. The
   * column checkbox is a Fleet `<Checkbox>` (role="checkbox", accessible name =
   * the column title). Hidden columns are stored per-context in localStorage.
   */
  async toggleColumn(name: string): Promise<void> {
    await this.editColumnsButton.click();
    await expect(this.editColumnsModal).toBeVisible();
    await this.editColumnsModal.getByRole('checkbox', { name }).click();
    await this.saveColumnsButton.click();
    await expect(this.editColumnsModal).toBeHidden();
  }
}
