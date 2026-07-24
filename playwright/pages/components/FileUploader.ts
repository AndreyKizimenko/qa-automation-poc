import { Page, Locator } from '@playwright/test';
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

  constructor(page: Page) {
    this.page = page;
    this.input = page.locator('input#upload-file');
    this.toast = new Toast(page);
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
