import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /controls/variables/global-variables — global custom variables (secrets)
 * referenced in scripts and configuration profiles as `$FLEET_SECRET_<NAME>`.
 * Table-based; add via the "Add custom variable" modal, delete via a per-row
 * trash action + confirm modal. Variable names are auto-uppercased on input.
 */
export class VariablesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly addVariableButton: Locator;

  // "Add custom variable" modal
  readonly addModal: Locator;
  readonly nameInput: Locator;
  readonly valueInput: Locator;
  readonly saveButton: Locator;

  // "Delete custom variable?" confirm modal
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Global variables' });
    // The empty state also renders an "Add variable" button, so scope to the
    // first (the section-header one) to stay single-match when the list is empty.
    this.addVariableButton = page.getByRole('button', { name: 'Add variable' }).first();

    this.addModal = page.locator('.modal__modal_container').filter({ hasText: 'Add custom variable' });
    this.nameInput = this.addModal.getByRole('textbox', { name: 'Name' });
    this.valueInput = this.addModal.getByRole('textbox', { name: 'Value' });
    this.saveButton = this.addModal.getByRole('button', { name: 'Save', exact: true });

    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete custom variable' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/variables/global-variables${qs}`);
    await expect(this.heading).toBeVisible();
  }

  /** A variable's row in the table, matched by its (uppercased) name. */
  variableRow(name: string): Locator {
    return this.table.rowWith(name);
  }

  async openAddModal(): Promise<void> {
    await this.addVariableButton.click();
    await expect(this.addModal).toBeVisible();
  }

  async fillVariable(name: string, value: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.valueInput.fill(value);
  }

  /** Submit the add modal; waits for it to close + the success toast. */
  async saveVariable(): Promise<void> {
    await this.saveButton.click();
    await expect(this.addModal).toBeHidden();
    await this.toast.expectSuccess('Variable created.');
  }

  /** Delete a variable via its per-row trash action + the confirm modal. */
  async deleteVariable(name: string): Promise<void> {
    await this.page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.deleteModal).toBeHidden();
  }
}
