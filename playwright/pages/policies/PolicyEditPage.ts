import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/policies/new` (new) and `/policies/:id/edit` (existing) — same form,
 * two modes. Saving a new policy opens a "Save policy" modal that
 * collects name + description + resolution + platform; saving an
 * existing one updates directly with no confirmation modal.
 *
 * The SQL editor is Fleet's `SQLEditor` (`.sql-editor` wrapper) around
 * Ace; visible content lives in `.ace_content` and keyboard input is
 * routed through the standard hidden `textarea.ace_text-input`.
 */
export class PolicyEditPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly editor: Locator;
  readonly editorContent: Locator;
  readonly editorTextarea: Locator;

  // Inline name input — only renders for an existing policy.
  readonly nameInput: Locator;
  readonly saveButton: Locator;

  // Modal that pops on Save for a new policy.
  readonly saveNewModal: Locator;
  readonly saveNewNameInput: Locator;
  readonly saveNewSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    // The /policies/:id/edit page also renders a schema-sidebar SQL example
    // that uses the same `.sql-editor` wrapper; scope to the first
    // instance so locator chains resolve to the main policy editor.
    this.editor = page.locator('.sql-editor').first();
    this.editorContent = this.editor.locator('.ace_content');
    this.editorTextarea = this.editor.locator('textarea.ace_text-input');

    this.nameInput = page.locator('input[name="policy-name"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });

    this.saveNewModal = page.locator('.modal__modal_container').filter({ hasText: 'Save policy' });
    this.saveNewNameInput = this.saveNewModal.locator('input[name="name"]');
    this.saveNewSubmitButton = this.saveNewModal.getByRole('button', { name: 'Save', exact: true });
  }

  async gotoNew(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/policies/new${qs}`);
    await expect(this.editorContent).toBeVisible();
  }

  async gotoEdit(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/policies/${id}`);
    // Policies route to the details page; navigate explicitly to the editor.
    await this.page.goto(`/policies/${id}/edit${qs}`);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  async setSql(sql: string): Promise<void> {
    await this.editorTextarea.focus();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Delete');
    await this.editorTextarea.pressSequentially(sql);
  }

  async sqlText(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  /**
   * New-policy save flow: clicks Save → opens "Save policy" modal → fills
   * the name → submits. Fleet redirects to `/policies/:id` on success;
   * the parsed id is returned.
   */
  async saveNew(name: string): Promise<number> {
    await this.saveButton.click();
    await expect(this.saveNewModal).toBeVisible();
    await this.saveNewNameInput.fill(name);
    await this.saveNewSubmitButton.click();
    await this.toast.expectSuccess('Policy created.');
    await this.page.waitForURL(/\/policies\/\d+(?:\?|$)/);
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/policies\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse policy id from ${this.page.url()}`);
    return id;
  }

  /** Existing-policy save: clicks Save and waits for the success toast. */
  async saveExisting(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Policy updated.');
  }
}
