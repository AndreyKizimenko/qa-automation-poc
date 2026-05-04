import { Page, Locator, Download, expect } from '@playwright/test';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * `/controls/scripts/library` — list of scripts uploaded for a fleet.
 *
 * Upload uses a modal (`.script-upload-modal`); selecting a file does not
 * auto-submit. Delete uses a confirmation modal. Clicking a script row
 * opens an Edit modal whose title is the script's filename and whose body
 * is an Ace editor pre-loaded with the script content — that same modal
 * is the "preview". Saving a changed script triggers a "Save changes?"
 * warning sub-modal before the update commits.
 */
export class ScriptsLibraryPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly container: Locator;
  readonly addScriptButton: Locator;

  readonly listItem: Locator;

  readonly uploadModal: Locator;
  readonly uploadConfirmButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  readonly editModal: Locator;
  readonly editorContent: Locator;
  readonly editorTextarea: Locator;
  readonly editSaveButton: Locator;
  readonly editCancelButton: Locator;

  readonly warningModal: Locator;
  readonly warningSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Library', level: 2 });
    this.container = page.locator('.script-library');
    this.addScriptButton = page.getByRole('button', { name: 'Add script' });

    this.listItem = page.locator('.script-list-item');

    this.uploadModal = page.locator('.script-upload-modal');
    // The modal's submit button shares its label with the page-level
    // "Add script" button — scope the locator inside the modal.
    this.uploadConfirmButton = this.uploadModal.getByRole('button', { name: 'Add script' });

    this.deleteModal = page.locator('.delete-script-modal');
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete' });

    this.editModal = page.locator('.edit-script-modal').first();
    // Ace editor renders the visible code into `.ace_content` and routes
    // keyboard input through a hidden `.ace_text-input` textarea.
    this.editorContent = this.editModal.locator('.ace_content');
    this.editorTextarea = this.editModal.locator('textarea.ace_text-input');
    this.editSaveButton = this.editModal.getByRole('button', { name: 'Save', exact: true });
    this.editCancelButton = this.editModal.getByRole('button', { name: 'Cancel' });

    // Sub-modal that prompts when saving a changed script. Distinct from the
    // main edit modal by the `__warning` class suffix.
    this.warningModal = page.locator('.edit-script-modal__warning');
    this.warningSaveButton = this.warningModal.getByRole('button', { name: 'Save' });
  }

  /** `fleetId=0` targets "No team". Omit to use the current team. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/scripts/library${qs}`);
    await expect(this.heading).toBeVisible();
  }

  itemByName(name: string): Locator {
    return this.listItem.filter({ hasText: name });
  }

  async uploadScript(filePath: string): Promise<void> {
    await this.addScriptButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploader.setFile(filePath);
    await this.uploadConfirmButton.click();
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.uploadModal).toBeHidden();
  }

  /**
   * Opens the edit/preview modal by clicking the script's name link, then
   * waits for the editor to render its content. Returns the modal locator
   * so callers can compose further assertions before closing it.
   */
  async openScript(name: string): Promise<Locator> {
    await this.itemByName(name).getByRole('button', { name }).first().click();
    await expect(this.editModal).toBeVisible();
    await expect(this.editorContent).not.toBeEmpty();
    return this.editModal;
  }

  /** Trimmed text of the script content in the open edit modal's editor. */
  async openScriptContent(): Promise<string> {
    return (await this.editorContent.innerText()).trim();
  }

  async closeScript(): Promise<void> {
    await this.editCancelButton.click();
    await expect(this.editModal).toBeHidden();
  }

  /**
   * Replaces the open editor's content with `newContent`. Sends a
   * platform-aware Select-All then types the replacement; Ace consumes the
   * input via the hidden textarea.
   */
  async replaceEditorContent(newContent: string): Promise<void> {
    await this.editorTextarea.focus();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Delete');
    await this.editorTextarea.pressSequentially(newContent);
  }

  /**
   * Full edit flow: open by name, replace content, save through the
   * "Save changes?" warning modal, expect success toast.
   */
  async editScript(name: string, newContent: string): Promise<void> {
    await this.openScript(name);
    await this.replaceEditorContent(newContent);
    await this.editSaveButton.click();
    await expect(this.warningModal).toBeVisible();
    await this.warningSaveButton.click();
    await this.toast.expectSuccess('Successfully saved script.');
    await expect(this.editModal).toBeHidden();
  }

  /** Triggers a download for the script and returns the Download handle. */
  async downloadScript(name: string): Promise<Download> {
    const row = this.itemByName(name);
    const downloadPromise = this.page.waitForEvent('download');
    await row.getByTestId('download-icon').click();
    return downloadPromise;
  }

  async deleteScript(name: string): Promise<void> {
    const row = this.itemByName(name);
    // Trash icon is hover-revealed.
    await row.hover();
    await row.getByTestId('trash-icon').click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(row).toBeHidden();
  }

  async deleteIfExists(name: string): Promise<void> {
    const row = this.itemByName(name);
    if (await row.isVisible().catch(() => false)) {
      await this.deleteScript(name);
    }
  }
}
