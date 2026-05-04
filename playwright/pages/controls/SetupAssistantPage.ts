import { Page, Locator, Download, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/setup-assistant` — singleton automatic-enrollment
 * profile per fleet. Empty state shows the standard `FileUploader`
 * (`input#upload-file`, `accept=".json"`, auto-submits on file selection).
 * Populated state replaces the uploader with a profile card that exposes
 * download (FileSaver client-side) and delete actions.
 */
export class SetupAssistantPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly card: Locator;
  readonly profileName: Locator;
  readonly downloadButton: Locator;
  readonly deleteButton: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Setup Assistant' });
    this.card = page.locator('.setup-assistant-profile-card');
    this.profileName = this.card.locator('.setup-assistant-profile-card__profile-name');
    this.downloadButton = this.card.locator('.setup-assistant-profile-card__download-button');
    this.deleteButton = this.card.locator('.setup-assistant-profile-card__delete-button');

    this.deleteModal = page.locator('.modal__modal_container')
      .filter({ hasText: 'Delete automatic enrollment profile' });
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete', exact: true });
  }

  /** `fleetId=0` targets "No team". Omit to use the current fleet. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/setup-experience/setup-assistant${qs}`);
    await expect(this.heading).toBeVisible();
  }

  /** Setting the file on the hidden input triggers FileUploader's auto-submit. */
  async upload(filePath: string): Promise<void> {
    await this.uploader.setFile(filePath);
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.card).toBeVisible();
  }

  /** Client-side FileSaver download — Playwright still captures the event. */
  async download(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return downloadPromise;
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await this.toast.expectSuccess('Successfully deleted.');
    await expect(this.card).toBeHidden();
  }

  async deleteIfPresent(): Promise<void> {
    if (await this.card.isVisible().catch(() => false)) {
      await this.delete();
    }
  }
}
