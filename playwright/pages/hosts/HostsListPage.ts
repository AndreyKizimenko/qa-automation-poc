import { Page, Locator, expect, Download } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { StatusFilter } from '../components/StatusFilter';
import { LabelFilter } from '../components/LabelFilter';
import { AddHostsModal } from '../components/AddHostsModal';
import { TransferHostModal } from '../components/TransferHostModal';
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
  readonly addHostsModal: AddHostsModal;
  readonly transferModal: TransferHostModal;
  readonly toast: Toast;

  // Bulk-select bar. Selecting rows swaps the table's header for a
  // `thead.active-selection` holding the count and the bulk actions; each action
  // is a plain text button, so only the bar itself needs a class scope.
  readonly selectAllOnPageCheckbox: Locator;
  readonly selectionBar: Locator;
  readonly transferSelectedButton: Locator;
  readonly deleteSelectedButton: Locator;
  readonly clearSelectionButton: Locator;
  /**
   * "Select all matching hosts" — widens the selection past the current page.
   * Only rendered once a full page is selected and no unsupported filter is
   * active (`DataTable.tsx` `shouldRenderToggleAllPages`).
   */
  readonly selectAllMatchingButton: Locator;

  readonly search: Locator;
  readonly addHostsButton: Locator;
  readonly enrollSecretsButton: Locator;
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
    this.addHostsModal = new AddHostsModal(page);
    this.transferModal = new TransferHostModal(page);
    this.toast = new Toast(page);

    // Fleet's Checkbox hides the real input behind a role="checkbox" div with no
    // accessible name, so the header one is reached positionally within the
    // table head — which holds only that checkbox in both header states.
    this.selectAllOnPageCheckbox = this.table.table
      .locator('thead')
      .getByRole('checkbox')
      .first();
    this.selectionBar = this.table.table.locator('thead.active-selection');
    this.transferSelectedButton = this.selectionBar.getByRole('button', {
      name: 'Transfer',
      exact: true,
    });
    this.deleteSelectedButton = this.selectionBar.getByRole('button', {
      name: 'Delete',
      exact: true,
    });
    this.clearSelectionButton = this.selectionBar.getByRole('button', {
      name: 'Clear selection',
    });
    this.selectAllMatchingButton = this.selectionBar.getByRole('button', {
      name: 'Select all matching hosts',
    });

    this.search = page.getByPlaceholder('Search');
    this.addHostsButton = page.getByRole('button', { name: 'Add hosts' });
    // Exact so it doesn't also match the empty-state "Manage enroll secrets"
    // banner link. Both this and Add hosts are gated on the enroll-hosts role.
    this.enrollSecretsButton = page.getByRole('button', { name: 'Enroll secrets', exact: true });
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

  /** Opens the Add hosts modal via the header button. */
  async openAddHosts(): Promise<void> {
    await this.addHostsButton.click();
    await expect(this.addHostsModal.modal).toBeVisible();
  }

  /**
   * Ticks the header checkbox, selecting every host on the current page and
   * raising the bulk-select bar.
   */
  async selectAllOnPage(): Promise<void> {
    await this.selectAllOnPageCheckbox.click();
    await expect(this.selectionBar).toBeVisible();
  }

  /** Opens the Transfer modal from the bulk-select bar. */
  async openTransferForSelection(): Promise<void> {
    await this.transferSelectedButton.click();
    await expect(this.transferModal.modal).toBeVisible();
  }

  /** The bulk-select bar's "N selected" tally. */
  get selectedCount(): Locator {
    return this.selectionBar.getByText(/^\d+ selected$/);
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
