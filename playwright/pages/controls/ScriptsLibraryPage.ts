import { Page, Locator, Download, expect } from '@playwright/test';
import { clickHoverAction } from '../components/clickHoverAction';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';
import { setAceValue } from '../components/aceEditor';
import { normalizeScript } from '../components/EditSoftwareModal';
import { FileUploader } from '../components/FileUploader';
import { TeamDropdown } from '../components/TeamDropdown';
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
  readonly teamDropdown: TeamDropdown;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly container: Locator;
  readonly addScriptButton: Locator;
  /** Shown while script execution is off in organization settings. */
  readonly disabledBanner: Locator;

  readonly listItem: Locator;

  readonly uploadModal: Locator;
  readonly uploadConfirmButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  readonly editModal: Locator;
  readonly editorContent: Locator;
  readonly editSaveButton: Locator;
  readonly editCancelButton: Locator;

  readonly warningModal: Locator;
  readonly warningSaveButton: Locator;

  /** The Scripts side nav's second page, beside Library. */
  readonly batchProgressLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
    this.uploader = new FileUploader(page);
    this.teamDropdown = new TeamDropdown(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Library', level: 2 });
    this.container = page.locator('.script-library');
    // The tab header carries a "+ Add script" button for every role that can
    // upload, in both the empty and populated states, so it's the one stable
    // way into the upload modal. Scoped to that header because an empty
    // library *also* renders an "Upload" button in its empty state, and a
    // locator matching either label resolves to two elements at once. The
    // plus icon prepends "plus" to the accessible name ("plus Add script"),
    // so the name is matched loosely.
    this.addScriptButton = page
      .locator('.script-library__tab-header')
      .getByRole('button', { name: 'Add script' });

    this.disabledBanner = page.getByText(
      'Running scripts is disabled in organization settings. You can still manage your library',
    );

    this.listItem = page.locator('.script-list-item');

    this.uploadModal = page.locator('.script-upload-modal');
    // The modal's submit button shares its label with the page-level
    // "Add script" button — scope the locator inside the modal.
    this.uploadConfirmButton = this.uploadModal.getByRole('button', { name: 'Add script' });

    this.deleteModal = page.locator('.delete-script-modal');
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete' });

    this.editModal = page.locator('.edit-script-modal').first();
    // The Ace editor renders the visible code into `.ace_content`.
    this.editorContent = this.editModal.locator('.ace_content');
    this.editSaveButton = this.editModal.getByRole('button', { name: 'Save', exact: true });
    this.editCancelButton = this.editModal.getByRole('button', { name: 'Cancel' });

    // Sub-modal that prompts when saving a changed script. Distinct from the
    // main edit modal by the `__warning` class suffix.
    this.warningModal = page.locator('.edit-script-modal__warning');
    this.warningSaveButton = this.warningModal.getByRole('button', { name: 'Save' });

    this.batchProgressLink = page.getByRole('link', { name: 'Batch progress', exact: true });
  }

  /** `fleetId=0` targets "No team". Omit to use the current team. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/scripts/library${qs}`);
    await expect(this.heading).toBeVisible();
  }

  itemByName(name: string): Locator {
    // Match the row whose title button is exactly `name`. `filter({ hasText })`
    // would do a substring match on full row content (filename + platform
    // tag + date), which lets a sibling row match when the platform tag or
    // adjacent text happens to share a substring with another script's name.
    return this.listItem.filter({ has: this.page.getByRole('button', { name, exact: true }) });
  }

  /** `file` is a path on disk, or a `{ name, mimeType, buffer }` built at run time. */
  async uploadScript(file: Parameters<FileUploader['setFile']>[0]): Promise<void> {
    await this.addScriptButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploader.setFile(file);
    await this.uploadConfirmButton.click();
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.uploadModal).toBeHidden();
  }

  /**
   * Stages a script in the upload modal and submits without asserting
   * success — for negative-path uploads where the caller asserts the
   * rejection toast. A refused upload leaves the modal open with the file
   * still chosen, so `uploadConfirmButton` sends the same file again.
   */
  async submitScriptUpload(file: Parameters<FileUploader['setFile']>[0]): Promise<void> {
    await this.addScriptButton.click();
    await expect(this.uploadModal).toBeVisible();
    await this.uploader.setFile(file);
    await this.uploadConfirmButton.click();
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
   * Replaces the open editor's content with `newContent` through Ace's own API
   * and checks the editor shows it. Typing would go through Ace's key handling,
   * which auto-indents and closes quotes and brackets, so a multi-line script
   * would be saved different from what was typed.
   */
  async replaceEditorContent(newContent: string): Promise<void> {
    await setAceValue(this.editorContent, newContent);
    await expect.poll(async () => normalizeScript(await this.editorContent.innerText())).toBe(
      normalizeScript(newContent),
    );
  }

  async editScript(name: string, newContent: string): Promise<void> {
    await this.stageEdit(name, newContent);
    await this.confirmEdit();
  }

  /**
   * Opens a script, replaces its content and clicks Save, stopping at the
   * "Save changes?" warning, which says saving cancels the script's pending
   * runs. {@link confirmEdit} saves.
   */
  async stageEdit(name: string, newContent: string): Promise<void> {
    await this.openScript(name);
    await this.replaceEditorContent(newContent);
    await this.editSaveButton.click();
    await expect(this.warningModal).toBeVisible();
  }

  /** Confirms the "Save changes?" warning and waits for the save to land. */
  async confirmEdit(): Promise<void> {
    await this.warningSaveButton.click();
    await this.toast.expectSuccess('Successfully saved script.');
    await expect(this.editModal).toBeHidden();
  }

  /** Controls → Scripts' side nav → Batch progress. */
  async goToBatchProgress(): Promise<void> {
    await this.batchProgressLink.click();
    await expect(this.page).toHaveURL(/\/controls\/scripts\/progress/);
  }

  /** Triggers a download for the script and returns the Download handle. */
  async downloadScript(name: string): Promise<Download> {
    const row = this.itemByName(name);
    const downloadPromise = this.page.waitForEvent('download');
    // ScriptListItem renders the hover action as a Button with aria-label
    // "Download <name>"; scoping to the row keeps similar filenames distinct.
    await clickHoverAction(row, row.getByRole('button', { name: `Download ${name}` }));
    return downloadPromise;
  }

  async deleteScript(name: string): Promise<void> {
    const row = this.itemByName(name);
    await clickHoverAction(row, row.getByRole('button', { name: `Delete ${name}` }));
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(row).toBeHidden();
  }

  /**
   * Delete `name` if the library lists it. Waits for the list to have rendered
   * — rows or the empty state — before looking: a check that runs ahead of the
   * list's fetch sees nothing, skips the delete, and the upload that follows is
   * refused as a duplicate ("A script with this name already exists."), which
   * is how a serial group's retry fails after a leftover from its first attempt.
   */
  async deleteIfExists(name: string): Promise<void> {
    await expect(this.list.firstItem.or(this.list.emptyState)).toBeVisible();
    if (await this.itemByName(name).isVisible()) {
      await this.deleteScript(name);
    }
  }
}
