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
   * The expandable panel on an error toast, carrying Fleet's raw response.
   * Rendered as `role="region"` labelled "Error details"; only present once
   * {@link expandErrorDetails} has opened it.
   */
  readonly errorDetails: Locator;
  readonly expandErrorDetailsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.locator('input#upload-file');
    this.toast = new Toast(page);

    this.chooseFileButton = page.getByRole('button', { name: 'Choose file' });
    this.expandErrorDetailsButton = page.getByRole('button', { name: 'Expand error details' });
    this.errorDetails = page.getByRole('region', { name: 'Error details' });
  }

  /**
   * Assert a staged file was refused, and why. Fleet raises a short error toast
   * (the Add software flow's is "Couldn't add.") and keeps the reason in the
   * toast's collapsed "Raw response" panel, so the reason is only assertable
   * after expanding it — asserting the toast alone would pass for any failure
   * at all.
   */
  async expectRejected(
    reason: string | RegExp,
    message: string | RegExp = "Couldn't add.",
  ): Promise<void> {
    await this.toast.expectError(message);
    await this.expandErrorDetailsButton.click();
    await expect(this.errorDetails).toContainText(reason);
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
