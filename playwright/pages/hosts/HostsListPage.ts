import { Page, Locator, expect, Download } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { StatusFilter } from '../components/StatusFilter';
import { LabelFilter } from '../components/LabelFilter';
import { AddHostsModal } from '../components/AddHostsModal';
import { RunScriptBatchModal } from '../components/RunScriptBatchModal';
import { TransferHostModal } from '../components/TransferHostModal';
import { Toast } from '../components/Toast';
import { EnrollSecretModal } from '../components/EnrollSecretModal';

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
  readonly runScriptBatchModal: RunScriptBatchModal;
  readonly toast: Toast;

  // Bulk-select bar. Selecting rows swaps the table's header for a
  // `thead.active-selection` holding the count and the bulk actions; each action
  // is a plain text button, so only the bar itself needs a class scope.
  readonly selectAllOnPageCheckbox: Locator;
  readonly selectionBar: Locator;
  readonly transferSelectedButton: Locator;
  /** Selection bar → Run script: a batch run on the selected hosts (premium, one fleet at a time). */
  readonly runScriptSelectedButton: Locator;
  readonly deleteSelectedButton: Locator;
  readonly clearSelectionButton: Locator;
  /**
   * "Select all matching hosts" — widens the selection past the current page.
   * Only rendered once a full page is selected and no unsupported filter is
   * active (`DataTable.tsx` `shouldRenderToggleAllPages`).
   */
  readonly selectAllMatchingButton: Locator;
  /** Confirmation raised by the bulk Delete action; its own modal class. */
  readonly deleteModal: Locator;

  readonly search: Locator;
  readonly addHostsButton: Locator;
  readonly hostsPageSettingsButton: Locator;
  readonly enrollSecretsOption: Locator;
  readonly editColumnsButton: Locator;
  readonly exportHostsButton: Locator;
  readonly filterPill: Locator;
  /** The Pass / Fail choice shown beside a policy's filter pill. */
  readonly policyResponseValue: Locator;
  /** Beside a custom label's pill, for a global user or the label's author. */
  readonly editLabelButton: Locator;
  readonly deleteLabelButton: Locator;
  readonly deleteLabelModal: Locator;
  /** "N hosts" above the table — the list's total for the current filters. */
  readonly resultsCount: Locator;

  readonly editColumnsModal: Locator;
  readonly saveColumnsButton: Locator;

  /** "Manage enroll secrets", opened from the gear menu's Enroll secrets. */
  readonly enrollSecrets: EnrollSecretModal;

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
    this.runScriptBatchModal = new RunScriptBatchModal(page);
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
    this.runScriptSelectedButton = this.selectionBar.getByRole('button', {
      name: 'Run script',
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
    this.deleteModal = page.locator('.delete-host-modal');

    this.search = page.getByPlaceholder('Search');
    this.addHostsButton = page.getByRole('button', { name: 'Add hosts' });
    // Page-level settings live behind a gear ActionsDropdown whose accessible
    // name comes from its `placeholder`. The gear renders only when the role
    // grants at least one of its items, so its absence is what a read-only
    // role asserts against.
    this.hostsPageSettingsButton = page.getByRole('button', { name: 'Hosts page settings' });
    // ActionsDropdown options keep no role, so they're reached by the shared
    // option class. Enroll secrets sits inside the gear menu and is gated on
    // the enroll-hosts role, the same gate as Add hosts.
    this.enrollSecretsOption = page
      .locator('.actions-dropdown__option')
      .filter({ hasText: 'Enroll secrets' });
    this.editColumnsButton = page.getByRole('button', { name: /edit columns/i });
    this.exportHostsButton = page.getByRole('button', { name: 'Export hosts' });
    // FilterPill (frontend/.../ManageHostsPage/components/FilterPill) renders
    // role="status" with aria-label "hosts filtered by <label>" when the list
    // is scoped by a software title, OS, policy, etc.
    this.filterPill = page.getByRole('status', { name: /hosts filtered by/ });
    // PoliciesFilter is Fleet's react-select v1 Dropdown: its combobox has no
    // accessible name and the chosen option is a plain div, so the value is read
    // by the wrapper's class.
    this.policyResponseValue = page.locator('.policies-filter .dropdown__custom-value-label');
    this.editLabelButton = page.getByRole('button', { name: 'Edit label' });
    this.deleteLabelButton = page.getByRole('button', { name: 'Delete label' });
    // DeleteLabelModal: Fleet's Modal renders a role-less title, so the shared
    // container is scoped by it, as on the Labels page.
    this.deleteLabelModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete label' });
    this.resultsCount = page.locator('.table-container__results-count');

    this.editColumnsModal = page.locator('.modal__modal_container').filter({ hasText: 'Edit columns' });
    this.saveColumnsButton = this.editColumnsModal.getByRole('button', { name: 'Save', exact: true });

    this.enrollSecrets = new EnrollSecretModal(page);
  }

  /**
   * Opens "Manage enroll secrets" the way a user does: the gear menu's Enroll
   * secrets, for whatever scope the page is on (the global list on free, or on
   * premium with no fleet selected).
   */
  async openEnrollSecretsFromMenu(): Promise<void> {
    await this.hostsPageSettingsButton.click();
    await this.enrollSecretsOption.click();
    await expect(this.enrollSecrets.modal).toBeVisible();
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

  /**
   * How many hosts the list reports for the current filters. Fleet localises
   * the figure past 999 ("1,024 hosts"), so the separators are stripped before
   * parsing.
   */
  async hostCount(): Promise<number> {
    const text = (await this.resultsCount.innerText()).trim();
    const match = text.match(/([\d,]+)\s+hosts?/);
    if (!match) throw new Error(`Unexpected hosts count: "${text}"`);
    return Number(match[1].replace(/,/g, ''));
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
  /**
   * One host row's selection checkbox, found by the row's host link. Fleet's
   * Checkbox has no accessible name of its own, so it's scoped by the row.
   */
  hostCheckbox(displayName: string): Locator {
    return this.table.table
      .locator('tbody')
      .getByRole('row')
      .filter({ has: this.page.getByRole('link', { name: displayName, exact: true }) })
      .getByRole('checkbox');
  }

  /**
   * Searches the list (name, hostname, UUID, serial or IP) and waits for the
   * filtered table. The page rewrites its URL from the filters its table last
   * queried with, and a rewrite that lands just after a choice takes it back
   * (it does once the first load settles), so the search is made again until
   * the settled table still has its `query` param.
   */
  async searchFor(query: string): Promise<void> {
    const held = () => new URL(this.page.url()).searchParams.get('query') === query;
    await expect(async () => {
      if (!held()) await this.search.fill(query);
      await this.table.waitForSettled(15_000);
      expect(held(), `the search for "${query}" didn't hold`).toBe(true);
    }).toPass({ timeout: 45_000 });
  }

  /**
   * Filters the list by a platform (the label filter's Platforms group) and a
   * status, and waits until both hold. Like {@link searchFor}, each choice is
   * made again until the settled table's URL still carries it: the platform's
   * label route (`/hosts/manage/labels/<id>`) and `status=<status>`. Without
   * that, a rewrite can drop both, and *Select all matching* then takes every
   * host on the fleet.
   */
  async filterTo(opts: { platform: string; status: 'Online' | 'Offline' }): Promise<void> {
    const onLabel = () => /\/hosts\/manage\/labels\/\d+/.test(new URL(this.page.url()).pathname);
    const want = opts.status.toLowerCase();
    const onStatus = () => new URL(this.page.url()).searchParams.get('status') === want;
    await expect(async () => {
      if (!onLabel()) await this.labelFilter.selectPlatform(opts.platform);
      if (!onStatus()) await this.statusFilter.selectByName(opts.status);
      await this.table.waitForSettled(15_000);
      expect(onLabel() && onStatus(), `the ${opts.platform} / ${opts.status} filters didn't hold`).toBe(true);
    }).toPass({ timeout: 60_000 });
  }

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

  /** Confirms the delete-host modal and waits for it to close. */
  async confirmDelete(): Promise<void> {
    await this.deleteModal.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.deleteModal).toBeHidden();
  }

  /**
   * Switches a policy filter between the hosts that pass it and those that fail
   * it. The menu is react-select v1, whose options carry no role.
   */
  async selectPolicyResponse(response: 'Pass' | 'Fail'): Promise<void> {
    await this.page.locator('.policies-filter .Select-control').click();
    const option = this.page.locator('.policies-filter .Select-option', { hasText: response });
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.policyResponseValue).toHaveText(response);
  }

  /** A host's link in the table, by its display name. */
  hostLink(displayName: string): Locator {
    return this.table.table.locator('tbody').getByRole('link', { name: displayName, exact: true });
  }

  /** The display names on the current page, in row order. */
  async hostNames(): Promise<string[]> {
    await this.table.waitForSettled();
    const rows = this.table.table.locator('tbody').getByRole('row');
    const names: string[] = [];
    for (const row of await rows.all()) {
      const link = row.getByRole('link').first();
      if (await link.count()) names.push((await link.innerText()).trim());
    }
    return names;
  }

  /**
   * A hosts-table column header by its visible name. `exact` where the name is
   * part of another header's ("Fleet" in "Added to Fleet").
   */
  columnHeader(name: string, opts: { exact?: boolean } = {}): Locator {
    return this.table.table.getByRole('columnheader', { name, exact: opts.exact });
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
