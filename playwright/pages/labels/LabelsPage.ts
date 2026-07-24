import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /labels/manage — the dedicated Labels page, plus its add (/labels/new) and
 * edit (/labels/:id) forms.
 *
 * The list shows only *custom* labels (built-ins are filtered out), so it can
 * be empty — `goto()` anchors on the page heading, not a table row. Each row's
 * actions live behind a react-select `ActionsDropdown` (Edit / Delete / View
 * all hosts); the menu portals to <body> and its options carry no test id, so
 * they're matched by their BEM class + visible text.
 */
export type LabelType = 'Dynamic' | 'Manual' | 'Host vitals';
export type LabelPlatform = 'All platforms' | 'macOS' | 'Windows' | 'Ubuntu' | 'Centos';
export type LabelRowAction = 'Edit' | 'Delete' | 'View all hosts';

export class LabelsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly pagination: Pagination;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly addLabelButton: Locator;

  // Add / edit form
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly queryEditorContent: Locator;
  readonly platformDropdown: Locator;
  readonly hostSearch: Locator;
  readonly saveButton: Locator;

  // Delete-confirm modal
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.pagination = new Pagination(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Labels', level: 1 });
    this.addLabelButton = page.getByRole('button', { name: 'Add label' });

    this.nameInput = page.getByRole('textbox', { name: 'Name' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Description' });
    // SQLEditor name="query" → Ace wrapper div id="query"; visible code in .ace_content.
    this.queryEditorContent = page.locator('#query .ace_content');
    // PlatformField renders a DropdownWrapper (react-select v5); its options
    // carry data-testid="dropdown-option".
    this.platformDropdown = page.locator('.platform-field__platform-dropdown .react-select__control');
    // Manual-label host picker (TargetsInput). Its search input has no
    // associated label, so target it by role.
    this.hostSearch = page.getByRole('searchbox');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    // DeleteLabelModal — Fleet Modal renders a role-less title; scope by the
    // shared container class filtered by the title text.
    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete label' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/labels/manage');
    await expect(this.heading).toBeVisible();
  }

  /** Click "Add label" → the new-label form at /labels/new. */
  async clickAddLabel(): Promise<void> {
    await this.addLabelButton.click();
    await expect(this.page).toHaveURL(/\/labels\/new/);
    await expect(this.nameInput).toBeVisible();
  }

  /** Select the label-type radio by visible label (Dynamic is the default). */
  async selectType(type: LabelType): Promise<void> {
    // Fleet's Radio hides the real <input type="radio"> (display:none) behind a
    // styled proxy, so the accessible radio isn't clickable; click the
    // associated <label> text instead.
    await this.page.locator('label').filter({ hasText: type }).click();
    await expect(this.page.getByRole('radio', { name: type })).toBeChecked();
  }

  async fillDetails(name: string, description: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.descriptionInput.fill(description);
  }

  /** Select a Dynamic label's platform by its visible label. */
  async selectPlatform(label: LabelPlatform): Promise<void> {
    await this.platformDropdown.click();
    const option = this.page.getByTestId('dropdown-option').filter({ hasText: label });
    await expect(option).toBeVisible();
    await option.click();
  }

  /**
   * Search the manual-label host picker and add the first matching host,
   * returning its display name. Before selection `.display_name__cell` belongs
   * to the search-results table; after selection the host moves to the
   * selected-hosts table (and the search clears). Verifying it landed in the
   * selected table guards against saving a manual label with no hosts (the
   * server rejects that with a "missing required parameter(s)" 422).
   */
  async addHost(searchTerm: string): Promise<string> {
    await this.hostSearch.fill(searchTerm);
    const firstResult = this.page.locator('.display_name__cell').first();
    await expect(firstResult).toBeVisible();
    const hostName = (await firstResult.innerText()).trim();
    await firstResult.click();
    await expect(
      this.page
        .locator('.targets-input__hosts-selected-table .display_name__cell')
        .filter({ hasText: hostName }),
    ).toBeVisible();
    return hostName;
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /** A label's row on the *current* page, matched by name. */
  rowFor(name: string): Locator {
    return this.table.rowWith(name);
  }

  /** Label names in the "Name" column across every row on the current page. */
  async labelNames(): Promise<string[]> {
    await expect(this.table.firstRow).toBeVisible();
    const rows = this.table.table.locator('tbody tr');
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const cell = await this.table.cellByColumn(rows.nth(i), 'Name');
      names.push((await cell.innerText()).trim());
    }
    return names;
  }

  /** Click a sortable column header to toggle its sort (client-side). */
  async sortByColumn(header: 'Name' | 'Description' | 'Type'): Promise<void> {
    await this.page.getByRole('button', { name: header, exact: true }).click();
  }

  /**
   * Page through the client-side-paginated list until a label's row is found,
   * and return it. The list sorts by name and pages at 20, so a label can land
   * on a later page; callers assert on the returned locator.
   */
  async locateRow(name: string): Promise<Locator> {
    await expect(this.table.firstRow).toBeVisible();
    for (;;) {
      const row = this.rowFor(name);
      if (await row.count()) return row;
      if (!(await this.pagination.nextIfEnabled(this.table))) return row;
    }
  }

  /**
   * Open a label row's Actions dropdown (without picking an option). Pages to
   * the row first; the dropdown reveals on row hover and its option menu
   * portals to <body>. Use with `rowActionOption` to inspect which actions a
   * role is offered.
   */
  async openRowActions(name: string): Promise<void> {
    const row = await this.locateRow(name);
    await row.hover();
    await row.locator('.actions-dropdown-select__control').click();
  }

  /** A row-actions menu option by its visible label (matched by text). */
  rowActionOption(action: LabelRowAction): Locator {
    return this.page.locator('.actions-dropdown-select__option').filter({ hasText: action });
  }

  /** Open a label row's Actions dropdown and pick an option. */
  async runRowAction(name: string, action: LabelRowAction): Promise<void> {
    await this.openRowActions(name);
    await this.rowActionOption(action).click();
  }
}
