import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
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
    await this.page.getByRole('radio', { name: type }).check();
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

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /** A label's row in the list, matched by name. */
  rowFor(name: string): Locator {
    return this.table.rowWith(name);
  }

  /**
   * Open a label row's Actions dropdown and pick an option. The dropdown
   * only reveals on row hover; the option menu portals to <body>.
   */
  async runRowAction(name: string, action: LabelRowAction): Promise<void> {
    const row = this.rowFor(name);
    await row.hover();
    await row.locator('.actions-dropdown-select__control').click();
    await this.page
      .locator('.actions-dropdown-select__option')
      .filter({ hasText: action })
      .click();
  }
}
