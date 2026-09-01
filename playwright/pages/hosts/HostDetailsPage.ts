import { Page, Locator, expect } from '@playwright/test';
import { DataSet } from '../components/DataSet';
import { DataTable } from '../components/DataTable';
import { FilterModal } from '../components/FilterModal';
import { Navbar } from '../components/Navbar';
import { SelectReportModal } from '../components/SelectReportModal';
import { Toast } from '../components/Toast';
import { TransferHostModal } from '../components/TransferHostModal';

/**
 * /hosts/:id/details — detailed view of a single host with tabs for Details,
 * Software, Reports, and Policies.
 *
 * The Software tab hosts a DataTable with a Vulnerable filter (same
 * FilterModal component as on /software/titles). Library is a sub-tab of
 * Software.
 */
export class HostDetailsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;
  /** Vitals term/value pairs in the host's summary panel (Agent, Memory, …). */
  readonly vitals: DataSet;
  readonly selectReportModal: SelectReportModal;
  /** Raised by Actions → Transfer; the same component the hosts list uses. */
  readonly transferModal: TransferHostModal;
  readonly toast: Toast;
  /** Confirmation raised by Actions → Delete; its own modal class. */
  readonly deleteModal: Locator;

  readonly hostHeading: Locator;
  readonly backButton: Locator;
  readonly refetchButton: Locator;
  /**
   * The same header button while a refetch is in flight — `HostHeader` swaps the
   * one button's label and disables it, so this and `refetchButton` never
   * resolve at the same time.
   */
  readonly refetchingButton: Locator;
  readonly actionsButton: Locator;
  /**
   * The header's "Last fetched <relative time>" line. `HostHeader` renders it as
   * a role-less `<div class="host-header__last-fetched">` holding a bare text
   * node plus the relative time, so there's no role or label to target. Assert
   * with `toContainText` rather than `toHaveText`: the nested tooltip injects a
   * `<style>` block and an absolute timestamp into this element's text.
   */
  readonly lastFetched: Locator;

  // Details tab — "Local user accounts" card. Scoped to the card because the
  // Details tab renders a second table (host certificates) that an unscoped
  // table locator would also match.
  readonly usersCard: Locator;
  readonly usersHeading: Locator;
  readonly usersSearch: Locator;
  readonly usersRows: Locator;

  // Reports tab. The tab, its controls, and the report cards are role-less
  // wrappers, so each is scoped by the `host-reports-tab` / `host-report-card`
  // component classes; the values inside them are reached by role.
  readonly reportsTabPanel: Locator;
  readonly reportsCount: Locator;
  /**
   * "Show reports that don't store results". Fleet's `Slider` renders a
   * `role="switch"` button whose visible label is a *sibling* span, so it has no
   * accessible name — read its state from `aria-checked`.
   */
  readonly dontStoreResultsToggle: Locator;
  readonly reportsSearch: Locator;
  readonly reportsSortTrigger: Locator;
  readonly reportCards: Locator;
  readonly reportsEmptyState: Locator;

  readonly detailsTab: Locator;
  readonly softwareTab: Locator;
  readonly reportsTab: Locator;
  readonly policiesTab: Locator;

  readonly inventoryTab: Locator;
  readonly libraryTab: Locator;
  readonly softwareSearch: Locator;
  /**
   * The Software tab's inventory table. `HostSoftwareTable` renders as a
   * role-less wrapper div, and its own class is the only scope that separates
   * it from the "Munki issues" table the same tab renders for macOS hosts — an
   * unscoped `getByRole('table')` matches both, and resolves to Munki rows
   * whenever the inventory is empty.
   */
  readonly softwareTable: Locator;
  readonly softwareRows: Locator;
  /** Name-column links in the inventory table, in row order. */
  readonly softwareNameLinks: Locator;

  readonly vitalsDiskSpace: Locator;
  readonly vitalsOperatingSystem: Locator;

  readonly firstActivityTimestamp: Locator;
  // Empty-state placeholder rendered by the Activity card when the host has
  // no past activities yet. Use `firstActivityTimestamp.or(activityEmptyState)`
  // when the test only needs the card to finish loading.
  readonly activityEmptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);
    this.vitals = new DataSet(page);
    this.selectReportModal = new SelectReportModal(page);
    this.transferModal = new TransferHostModal(page);
    this.toast = new Toast(page);
    this.deleteModal = page.locator('.delete-host-modal');

    this.hostHeading = page.getByRole('heading', { level: 1 });
    this.backButton = page.getByRole('button', { name: 'Back to all hosts' });
    // Matches the idle-state label only; `refetchingButton` matches the same
    // button once a refetch is under way.
    this.refetchButton = page.getByRole('button', { name: 'Refetch' });
    this.refetchingButton = page.getByRole('button', { name: 'Fetching fresh vitals' });
    this.actionsButton = page.getByRole('button', { name: 'Actions' });
    this.lastFetched = page.locator('.host-header__last-fetched');

    // `local-user-accounts-card` is the card's own modifier class; Fleet's Card
    // renders as a role-less div, so it's the only stable scope for the card.
    this.usersCard = page.locator('.local-user-accounts-card');
    this.usersHeading = this.usersCard.getByRole('heading', { name: 'Local user accounts' });
    this.usersSearch = this.usersCard.getByPlaceholder('Search local user accounts by username');
    this.usersRows = this.usersCard.getByRole('table').locator('tbody').getByRole('row');

    this.reportsTabPanel = page.locator('.host-reports-tab');
    this.reportsCount = this.reportsTabPanel.locator('.host-reports-tab__count');
    this.dontStoreResultsToggle = this.reportsTabPanel
      .locator('.host-reports-tab__toggle')
      .getByRole('switch');
    this.reportsSearch = this.reportsTabPanel.getByPlaceholder('Search by name');
    // react-select trigger — the visible click target is a role-less div, so it's
    // scoped by the sort dropdown's own wrapper class.
    this.reportsSortTrigger = this.reportsTabPanel.locator(
      '.host-reports-tab__sort-dropdown .react-select__control',
    );
    this.reportCards = this.reportsTabPanel.locator('.host-report-card');
    this.reportsEmptyState = page.getByRole('heading', { name: 'No reports scheduled' });

    this.detailsTab = page.getByRole('tab', { name: 'Details' });
    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.reportsTab = page.getByRole('tab', { name: 'Reports' });
    this.policiesTab = page.getByRole('tab', { name: 'Policies' });

    this.inventoryTab = page.getByRole('tab', { name: 'Inventory' });
    this.libraryTab = page.getByRole('tab', { name: 'Library' });
    this.softwareSearch = page.getByPlaceholder('Search by name or vulnerability (CVE)');
    this.softwareTable = page.locator('.host-software-table');
    this.softwareRows = this.softwareTable.locator('tbody').getByRole('row');
    this.softwareNameLinks = this.softwareRows.locator('td:first-child a');

    this.vitalsDiskSpace = page.getByText('Disk space available');
    this.vitalsOperatingSystem = page.getByText('Operating system');

    // Activity rows are buttons whose aria-label ends with "ago".
    this.firstActivityTimestamp = page.getByRole('button', { name: /\bago\b/ }).first();
    // EmptyFeed renders an `<h3>No activity</h3>` inside the Activity card
    // when the host has no past activities yet.
    this.activityEmptyState = page.getByRole('heading', { level: 3, name: 'No activity' });
  }

  async goto(hostId: number): Promise<void> {
    await this.page.goto(`/hosts/${hostId}`);
    await expect(this.vitalsDiskSpace).toBeVisible();
  }

  async openSoftwareTab(): Promise<void> {
    await this.softwareTab.click();
    // Settle on either rows or the empty state — a macOS host defaults to the
    // "Applications" view, which is empty when the host reports only non-app
    // packages (so rows alone would never resolve; callers switch to full
    // inventory via showFullInventory() next).
    await expect(this.softwareRowOrEmpty()).toBeVisible();
  }

  /** First inventory row, or the table's empty state — the tab has settled either way. */
  softwareRowOrEmpty(): Locator {
    return this.softwareRows.first().or(this.softwareTable.locator('.empty-state'));
  }

  /**
   * macOS hosts default the Software list to the "Applications" view (top-level
   * apps only) and expose a filter dropdown to switch it; other platforms show
   * the full list and render no dropdown. Selects "Full inventory" so the table
   * lists every reported package. No-op on Windows/Linux hosts, where the
   * dropdown isn't present.
   *
   * The react-select trigger has no accessible role, so it's scoped by the host
   * software table's filter container class to avoid colliding with the team
   * dropdown or the vulnerable filter modal; options carry `dropdown-option`.
   */
  async showFullInventory(): Promise<void> {
    // The dropdown renders in the same controls row as the search field, so
    // waiting for that field is what makes the absence check meaningful. Reading
    // `count()` straight after the tab click is a non-retrying query: on a host
    // whose Applications view is empty the controls may not have rendered yet,
    // and the method would silently no-op — leaving the caller on a view with no
    // rows and a disabled "Add filters" button.
    await expect(this.softwareSearch).toBeVisible();

    const trigger = this.page.locator(
      '.host-software-table__software-filter .react-select__control',
    );
    if ((await trigger.count()) === 0) return;
    await trigger.click();
    await this.page.getByTestId('dropdown-option').filter({ hasText: 'Full inventory' }).click();
    // The selection drives the list via the `macos_applications` query param.
    // The URL flips as soon as the option is picked, ahead of the response that
    // repaints the table, so callers that read rows wait on the table itself —
    // which view is empty depends on the host, so that wait belongs to them.
    await expect(this.page).toHaveURL(/macos_applications=false/);
  }

  async applyVulnerableFilter(): Promise<void> {
    await this.filter.applyVulnerable();
  }

  /**
   * Titles listed in the host's software table, in row order. Read from the
   * Name column's links rather than row text, so values carried by other
   * columns — a File path like `C:\Program Files\Adobe\DNG Converter` — are not
   * mistaken for titles. The Name cell is addressed positionally because the
   * table's cells expose no role or label distinguishing one column from
   * another.
   */
  async softwareNames(): Promise<string[]> {
    return (await this.softwareNameLinks.allInnerTexts()).map((t) => t.trim());
  }

  /**
   * The Name-column link for one software title. Matched on the link's exact
   * accessible name so a title contained in a longer one — "Dropbox" inside
   * "Dropbox Update Helper" — still resolves to a single row.
   */
  softwareNameLink(name: string): Locator {
    return this.softwareTable.getByRole('link', { name, exact: true });
  }

  /** Filters the host's software table by name (server-side `query` param). */
  async searchSoftware(term: string): Promise<void> {
    await this.softwareSearch.fill(term);
  }

  async clickFirstSoftware(): Promise<void> {
    await this.table.firstRowWithLink.locator('td').first().getByRole('link').first().click();
  }

  /**
   * Asks Fleet to re-collect the host's vitals. While a refetch is in flight
   * `HostHeader` relabels the one button to "Fetching fresh vitals...this may
   * take a moment" and disables it, so the idle "Refetch" label is what marks
   * the control as clickable again. The wait spans a whole round trip: the live
   * hosts are shared, so another spec — or a previous attempt of this one — can
   * leave a refetch running, and this rides that out instead of failing on a
   * button that isn't rendered yet. The result lands on the host's own poll
   * cadence, so callers confirm it through the API rather than the button.
   */
  async refetch(): Promise<void> {
    await expect(this.refetchButton).toBeEnabled({ timeout: 60_000 });
    await this.refetchButton.click();
  }

  /**
   * Options currently offered by the host's Actions menu. Fleet builds this list
   * per role and per host (`HostActionsDropdown/helpers.tsx`
   * `removeUnavailableOptions`), so it's the surface a role-permission spec
   * asserts on. Only meaningful while the menu is open.
   */
  get actionOptions(): Locator {
    return this.page.locator('.actions-dropdown__option');
  }

  /**
   * One Actions-menu option by its exact label. Use `toBeVisible()` /
   * `toHaveCount(0)` on it to assert an action is offered or withheld — Fleet
   * builds the list per role, per platform and per MDM state.
   */
  actionOption(label: string): Locator {
    return this.actionOptions.filter({ hasText: new RegExp(`^${label}$`) });
  }

  /** Opens the host's Actions menu and waits for its options to render. */
  async openActions(): Promise<void> {
    await this.actionsButton.click();
    await expect(this.actionOptions.first()).toBeVisible();
  }

  /**
   * Picks an option from the host's Actions menu (Transfer, Live report, Run
   * script, Delete, and the MDM-only Lock/Wipe/Unlock entries). The menu is a
   * react-select with no ARIA roles on the options, so they're matched by their
   * option class and exact visible text.
   */
  async runAction(label: string): Promise<void> {
    await this.actionsButton.click();
    await this.actionOptions.filter({ hasText: new RegExp(`^${label}$`) }).click();
  }

  /** Opens the "Select a report" modal via Actions → Live report. */
  async openLiveReport(): Promise<void> {
    await this.runAction('Live report');
    await expect(this.selectReportModal.modal).toBeVisible();
  }

  /** Confirms the delete-host modal and waits for it to close. */
  async confirmDelete(): Promise<void> {
    await this.deleteModal.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.deleteModal).toBeHidden();
  }

  /** Filters the "Local user accounts" card by username (client-side). */
  async searchUsers(term: string): Promise<void> {
    await this.usersSearch.fill(term);
  }

  /** A "Local user accounts" row by its exact username cell. */
  userRow(username: string): Locator {
    return this.usersRows.filter({
      has: this.page.getByRole('cell', { name: username, exact: true }),
    });
  }

  // ── Reports tab ───────────────────────────────────────────────────────────

  /** Opens the Reports tab and waits for it to settle to cards or its empty state. */
  async openReportsTab(): Promise<void> {
    await this.reportsTab.click();
    await expect(this.page).toHaveURL(/\/reports$/);
    await expect(this.reportCards.first().or(this.reportsEmptyState)).toBeVisible();
  }

  /** A report card by its name (the card's `h3` heading). */
  reportCard(name: string): Locator {
    return this.reportCards.filter({
      has: this.page.getByRole('heading', { level: 3, name, exact: true }),
    });
  }

  /** Report card names in the order they're rendered — the sort assertion's input. */
  async reportCardNames(): Promise<string[]> {
    const names = await this.reportsTabPanel
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
    return names.map((n) => n.trim());
  }

  /** Filters the Reports tab by report name (server-side `query` param). */
  async searchReports(term: string): Promise<void> {
    await this.reportsSearch.fill(term);
  }

  /**
   * Re-sorts the Reports tab. Options come from Fleet's `DropdownWrapper`, which
   * tags each with `data-testid="dropdown-option"`. The choice is reflected in the
   * `sort` query param, so callers can wait on the URL before reading order.
   */
  async sortReports(label: 'Newest results' | 'Oldest results' | 'Name A-Z' | 'Name Z-A'): Promise<void> {
    await this.reportsSortTrigger.click();
    await this.page
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
  }

  /**
   * Picks an action from a report card's Actions menu. "Show details" is only
   * offered once the report has a stored result for this host (`HostReportCard.tsx`
   * gates it on `last_fetched`); "View report for all hosts" is always there.
   * The card's menu is a react-select, so the trigger is its control class and
   * the options carry no roles.
   */
  async runReportCardAction(reportName: string, label: string): Promise<void> {
    await this.reportCard(reportName).locator('.actions-dropdown-select__control').click();
    await this.page
      .locator('.actions-dropdown__option')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
  }

  /**
   * Hovers the Agent vitals value to reveal its osquery/Orbit/Fleet Desktop
   * tooltip. Only fleetd hosts render the tooltip — on a vanilla-osquery host
   * the value is plain text (see `Vitals.tsx`), so resolve the host with
   * `findOnlineHost(..., { withOrbit: true })` before calling this.
   *
   * The hover target is the tooltip wrapper's inner element, since the `<dd>`
   * itself spans padding that doesn't trigger the tooltip.
   */
  async hoverAgentVersion(): Promise<void> {
    await this.vitals
      .value('Agent')
      .locator('.component__tooltip-wrapper__element')
      .hover();
  }
}
