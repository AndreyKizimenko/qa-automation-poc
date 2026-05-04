import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * `/reports/new` (new) and `/reports/:id/edit` (existing) — same form, two
 * modes. Saving a new report opens a "Save report" modal that collects
 * name + description + interval before persisting; saving an existing one
 * opens a "Save changes?" confirmation modal.
 *
 * The SQL editor is Fleet's `SQLEditor` component (`.sql-editor` wrapper)
 * around Ace; visible code lives in `.ace_content` and keyboard input is
 * routed through the standard hidden `textarea.ace_text-input`.
 */
export class ReportEditPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly editor: Locator;
  readonly editorContent: Locator;
  readonly editorTextarea: Locator;

  // Inline name input — only renders for an existing report.
  readonly nameInput: Locator;
  // Buttons rendered by EditQueryForm.
  readonly saveButton: Locator;
  readonly liveReportButton: Locator;

  // Modal that pops on Save for a new report.
  readonly saveNewModal: Locator;
  readonly saveNewNameInput: Locator;
  readonly saveNewSubmitButton: Locator;

  // Modal that pops on Save for an existing report.
  readonly confirmSaveModal: Locator;
  readonly confirmSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    // The /reports/:id/edit page also renders a schema-sidebar SQL example
    // that uses the same `.sql-editor` wrapper; scope to the first
    // instance so locator chains resolve to the main report editor.
    this.editor = page.locator('.sql-editor').first();
    this.editorContent = this.editor.locator('.ace_content');
    this.editorTextarea = this.editor.locator('textarea.ace_text-input');

    this.nameInput = page.getByLabel('Name', { exact: true }).first();
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.liveReportButton = page.getByRole('button', { name: /Live report/ });

    // Fleet's Modal renders without role/aria-modal; scope by container class
    // plus heading text. New-report modal title is "Save report".
    this.saveNewModal = page.locator('.modal__modal_container').filter({ hasText: 'Save report' });
    this.saveNewNameInput = this.saveNewModal.getByLabel('Name', { exact: true });
    this.saveNewSubmitButton = this.saveNewModal.getByRole('button', { name: 'Save', exact: true });

    this.confirmSaveModal = page.locator('.modal__modal_container').filter({ hasText: 'Save changes' });
    this.confirmSaveButton = this.confirmSaveModal.getByRole('button', { name: 'Save', exact: true });
  }

  /** `/reports/new` — fresh editor, no name field, no description field. */
  async gotoNew(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/reports/new${qs}`);
    await expect(this.editorContent).toBeVisible();
  }

  /** `/reports/:id/edit` — name + description inputs render, editor pre-loaded. */
  async gotoEdit(id: number, opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/reports/${id}/edit${qs}`);
    await expect(this.nameInput).toBeVisible();
    await expect(this.editorContent).toBeVisible();
  }

  /** Replace SQL via the hidden Ace textarea (matches the scripts editor pattern). */
  async setSql(sql: string): Promise<void> {
    await this.editorTextarea.focus();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Delete');
    await this.editorTextarea.pressSequentially(sql);
  }

  /** Trimmed text shown in the editor. */
  async sqlText(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  /**
   * New-report save flow: clicks Save → opens "Save report" modal → fills
   * the name → clicks the modal's Save → waits for the post-create
   * redirect to `/reports/:id` and returns the new report's id.
   */
  async saveNew(name: string): Promise<number> {
    await this.saveButton.click();
    await expect(this.saveNewModal).toBeVisible();
    await this.saveNewNameInput.fill(name);
    await this.saveNewSubmitButton.click();
    await this.toast.expectSuccess('Report created.');
    await this.page.waitForURL(/\/reports\/\d+(?:\?|$)/);
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/reports\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse report id from ${this.page.url()}`);
    return id;
  }

  /**
   * Existing-report save flow: clicks Save → opens "Save changes?"
   * confirmation modal → clicks the modal's Save. The toast confirms
   * persistence.
   */
  async saveExisting(): Promise<void> {
    await this.saveButton.click();
    await expect(this.confirmSaveModal).toBeVisible();
    await this.confirmSaveButton.click();
    await this.toast.expectSuccess('Report updated.');
  }

  /** Click "Live report" → navigates to `/reports/:id/live`. */
  async clickLiveReport(): Promise<void> {
    await this.liveReportButton.click();
    await this.page.waitForURL(/\/reports\/\d+\/live/);
  }
}
