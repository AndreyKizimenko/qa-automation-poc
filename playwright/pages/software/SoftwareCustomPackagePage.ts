import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * `/software/add/package` — the "Custom package" tab of the Add software
 * flow. Reuses the shared `FileUploader` component (`input#upload-file`).
 * Submitting the "Add software" button uploads the package and Fleet
 * redirects to the new title's detail page.
 *
 * Toast on success: "<filename> successfully added." (the filename text
 * comes from the uploaded file). The Toast component scopes to
 * `.flash-message--success`, so we match on the loose default regex.
 */
export class SoftwareCustomPackagePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly customPackageTab: Locator;
  readonly addSoftwareButton: Locator;
  readonly cancelButton: Locator;
  readonly progressModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.customPackageTab = page.getByRole('tab', { name: 'Custom package' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    this.progressModal = page.locator('.file-progress-modal');
  }

  /** `fleetId` is required for the page to render content (use 0 for no-team). */
  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/package?fleet_id=${opts.fleetId}`);
    await expect(this.heading).toBeVisible();
    await expect(this.customPackageTab).toBeVisible();
  }

  /**
   * Stages the file, clicks "Add software", waits for the upload progress
   * modal to clear, and confirms Fleet redirected to the new title's
   * detail page. Returns the new title's id (parsed from the URL).
   */
  async uploadPackage(filePath: string): Promise<number> {
    await this.uploader.setFile(filePath);
    await expect(this.addSoftwareButton).toBeEnabled();
    await this.addSoftwareButton.click();

    // Progress modal may flash briefly or not at all for tiny packages.
    if (await this.progressModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(this.progressModal).toBeHidden({ timeout: 120_000 });
    }

    await this.page.waitForURL(/\/software\/titles\/\d+/);
    await this.toast.expectSuccess(/successfully added/);

    const url = new URL(this.page.url());
    const id = parseInt(url.pathname.match(/\/software\/titles\/(\d+)/)?.[1] ?? '0', 10);
    if (!id) throw new Error(`Could not parse software title id from URL: ${this.page.url()}`);
    return id;
  }
}
