import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/**
 * Fleet's `FileUploader` widget — a hidden `<input id="upload-file">` used
 * for uploads across the app (bootstrap package, scripts, custom packages,
 * configuration profiles, etc.).
 *
 * Some pages auto-submit on file selection (`upload()`); others stage the
 * file and require a separate submit click (`setFile()` + `expectToast()`).
 */
export class FileUploader {
  readonly page: Page;
  readonly input: Locator;
  readonly toast: Toast;

  /** The widget's own control — present whenever no file is staged. */
  readonly chooseFileButton: Locator;
  /**
   * The uploader's card: the graphic, its title or error line, the message and
   * the button. Fleet renders it as a `Card` with no role or accessible name,
   * so it's located by the `file-uploader` class the component gives it.
   */
  readonly card: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.locator('input#upload-file');
    this.toast = new Toast(page);

    this.chooseFileButton = page.getByRole('button', { name: 'Choose file' });
    this.card = page.locator('.file-uploader');
  }

  /**
   * Assert the uploader is showing an error in its own card. Fleet puts the
   * error in place of the card's title: a dropped file the `accept` list
   * refuses, or a picked one the page rejects (the Custom package form's
   * "File type isn't supported"). Scoped to the card so an error toast with
   * the same words can't satisfy it.
   */
  async expectInlineError(text: string | RegExp): Promise<void> {
    await expect(this.card.getByText(text)).toBeVisible();
  }

  /**
   * Accepts a path (or paths) or an in-memory payload
   * (`{ name, mimeType, buffer }`) so callers can stage a runtime-generated
   * file without writing it to disk.
   */
  async setFile(files: Parameters<Locator['setInputFiles']>[0]): Promise<void> {
    await this.input.setInputFiles(files);
  }

  async expectToast(text: string | RegExp = /^Successfully/): Promise<void> {
    await this.toast.expectSuccess(text);
  }

  /** For auto-submit pages. For modal-submit pages, use `setFile()` + your own submit. */
  async upload(filePath: string, text?: string | RegExp): Promise<void> {
    await this.setFile(filePath);
    await this.expectToast(text);
  }
}
