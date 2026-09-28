import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { FilterModal } from '../components/FilterModal';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';
import { Toast } from '../components/Toast';

/**
 * /software/inventory — the list of installed software with vulnerability counts.
 */
export class SoftwareTitlesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;
  readonly pagination: Pagination;
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  // Page controls
  readonly search: Locator;
  readonly showVersionsSwitch: Locator;
  readonly manageAutomationsButton: Locator;
  readonly manageAutomationsModal: Locator;
  readonly addSoftwareButton: Locator;

  // "Manage automations" modal — vulnerability-automations controls.
  readonly vulnAutomationsToggle: Locator;
  readonly vulnWebhookUrlInput: Locator;
  readonly saveAutomationsButton: Locator;

  // Tabs (Inventory / OS / Vulnerabilities / Library)
  readonly inventoryTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;
  readonly libraryTab: Locator;

  /** "N items" summary above the table, plus its "Updated <time> ago" line. */
  readonly resultsCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);
    this.pagination = new Pagination(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    this.search = page.getByRole('textbox', { name: /Search by name or vulnerability/ });
    this.showVersionsSwitch = page.getByRole('switch', { name: /versions/i });
    // AutomationsButton renders the visible label "Manage automations"; clicking
    // it (when enabled) opens the modal of the same name. Only global admins see
    // it, and only under the "All fleets" aggregate is it enabled.
    this.manageAutomationsButton = page.getByRole('button', { name: 'Manage automations', exact: true });
    // Fleet's Modal renders a role-less title <span>, so target the shared
    // container class filtered by the modal's title text.
    this.manageAutomationsModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Manage automations' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software' });

    // Vulnerability-automations controls inside the modal. The toggle is Fleet's
    // Slider (a role="switch" button with aria-checked). The webhook URL field's
    // "Destination URL" label is tooltip-wrapped (no htmlFor association), so
    // target it by placeholder.
    this.vulnAutomationsToggle = this.manageAutomationsModal.getByRole('switch');
    this.vulnWebhookUrlInput = this.manageAutomationsModal.getByPlaceholder('https://server.com/example');
    this.saveAutomationsButton = this.manageAutomationsModal.getByRole('button', { name: 'Save', exact: true });

    // First software subnav tab; renders <TabText>Inventory</TabText> via react-tabs.
    this.inventoryTab = page.getByRole('tab', { name: 'Inventory' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
    this.libraryTab = page.getByRole('tab', { name: 'Library' });

    // TableContainer renders the count as a role-less <div>; there is no
    // heading or label to anchor on.
    this.resultsCount = page.locator('.table-container__results-count');
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
    // /software/inventory is canonical; /software/titles only resolves via a legacy redirect.
    await this.page.goto(`/software/inventory${qs ? '?' + qs : ''}`);
    // Assert the resolved tab so a removed redirect fails loudly rather than on a blank page.
    await expect(this.inventoryTab).toHaveAttribute('aria-selected', 'true');
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  async searchByName(name: string): Promise<void> {
    await this.search.fill(name);
    await expect(this.table.firstRow).toBeVisible();
  }

  /** Visible column headers, in render order, with the trailing action column dropped. */
  async columnHeaders(): Promise<string[]> {
    const headers = await this.table.table.locator('thead th').allInnerTexts();
    return headers.map((h) => h.trim()).filter(Boolean);
  }

  /**
   * The header's sort control. Fleet renders sortable headers as
   * `<button class="sortable-header">` and non-sortable ones as a plain div, so
   * a zero count is how "this column can't be sorted" reads.
   */
  sortControl(column: string): Locator {
    return this.table.table.locator('thead').getByRole('button', { name: column, exact: true });
  }

  /**
   * Click a column's sort control and wait for the re-fetched page. Sorting is
   * server-side: the click flips `order_key` / `order_direction` in the URL
   * well before the new rows arrive, so the URL is asserted first and the
   * loading overlay is what separates the new page from the old one.
   */
  async sortBy(column: string, orderKey: string, direction: 'asc' | 'desc'): Promise<void> {
    await this.sortControl(column).click();
    await expect(this.page).toHaveURL(new RegExp(`order_key=${orderKey}(&|$)`));
    await expect(this.page).toHaveURL(new RegExp(`order_direction=${direction}(&|$)`));
    await this.table.waitForSettled();
  }

  /** Trimmed values of one column across the rows currently rendered. */
  async columnValues(column: string): Promise<string[]> {
    const rows = this.table.table.locator('tbody tr');
    const count = await rows.count();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const cell = await this.table.cellByColumn(rows.nth(i), column);
      values.push((await cell.innerText()).trim());
    }
    return values;
  }

  /**
   * Click into the "Library" tab — the installer-backed titles (custom
   * packages, FMA, VPP, Android), as opposed to Inventory's host-reported
   * software. Carries the currently selected fleet scope.
   */
  async gotoLibraryTab(): Promise<void> {
    await this.libraryTab.click();
    await expect(this.page).toHaveURL(/\/software\/library/);
    await expect(this.table.rowOrEmpty()).toBeVisible();
  }

  /**
   * Click the "Add software" button. Fleet lands on the Fleet-maintained
   * tab by default and carries the current `fleet_id` query param into
   * the new URL, so the destination inherits the team scope selected via
   * `teamDropdown.select()`.
   */
  async clickAddSoftware(): Promise<void> {
    await this.addSoftwareButton.click();
    await expect(this.page).toHaveURL(/\/software\/add\/fleet-maintained/);
  }

  /** Open the "Manage automations" modal (button must be enabled — All fleets). */
  async openManageAutomations(): Promise<void> {
    await this.manageAutomationsButton.click();
    await expect(this.manageAutomationsModal).toBeVisible();
  }

  /**
   * Toggle the "Vulnerability automations" slider to `enabled`. The slider is a
   * role="switch" button; reads/asserts its aria-checked state so the call is
   * idempotent.
   */
  async setVulnerabilityAutomations(enabled: boolean): Promise<void> {
    const isOn = (await this.vulnAutomationsToggle.getAttribute('aria-checked')) === 'true';
    if (isOn !== enabled) await this.vulnAutomationsToggle.click();
    await expect(this.vulnAutomationsToggle).toHaveAttribute('aria-checked', String(enabled));
  }

  /**
   * Select the "Webhook" workflow radio (the modal may open on "Ticket"). The
   * Radio's real <input> is hidden, so click the label; the destination-URL
   * field renders once it's selected.
   */
  async selectWebhookWorkflow(): Promise<void> {
    await this.manageAutomationsModal.locator('label').filter({ hasText: 'Webhook' }).click();
    await expect(this.vulnWebhookUrlInput).toBeVisible();
  }

  /**
   * Save the manage-automations modal. Waits for the modal to close, which is
   * the reliable save-completed signal (the success toast lives only 5s and can
   * linger from a prior save, so it's not a safe wait on its own).
   */
  async saveAutomations(): Promise<void> {
    await this.saveAutomationsButton.click();
    await expect(this.manageAutomationsModal).toBeHidden();
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
   * Click into the "OS" tab. Returns after the URL has changed and the new
   * table has rendered. Carries the currently selected team scope.
   */
  async gotoOsTab(): Promise<void> {
    await this.osTab.click();
    await expect(this.page).toHaveURL(/\/software\/os/);
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
