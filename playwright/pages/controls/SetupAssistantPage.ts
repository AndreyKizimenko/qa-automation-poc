import { Page, Locator, Download, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/setup-assistant` — singleton automatic-enrollment
 * profile per fleet. Fleet always renders a `.setup-assistant-profile-card`:
 * a download-only `--default-profile` variant when nothing is uploaded, and
 * the user's custom card after `upload()`. `delete()` swaps the custom card
 * back to the default-profile card — there is no "empty" state to reach.
 *
 * Uploading goes through the standard `FileUploader` (`input#upload-file`,
 * `accept=".json"`, auto-submits on file selection).
 */
export class SetupAssistantPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

  readonly heading: Locator;

  /** Matches both the default-profile and custom-profile cards. */
  readonly card: Locator;
  /** Always present when no custom profile is uploaded; download-only. */
  readonly defaultCard: Locator;
  /** Present only when the admin has uploaded a custom profile. */
  readonly customCard: Locator;

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
    this.defaultCard = page.locator(
      '.setup-assistant-profile-card.setup-assistant-profile-card--default-profile',
    );
    this.customCard = page.locator(
      '.setup-assistant-profile-card:not(.setup-assistant-profile-card--default-profile)',
    );

    // Profile name + download button live on both card variants; delete
    // only exists on the custom-profile variant, so we scope it there.
    this.profileName = this.card.locator('.setup-assistant-profile-card__profile-name');
    this.downloadButton = this.card.locator('.setup-assistant-profile-card__download-button');
    this.deleteButton = this.customCard.locator(
      '.setup-assistant-profile-card__delete-button',
    );

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

  /**
   * Setting the file on the hidden input triggers FileUploader's auto-submit.
   * The custom-profile card replaces the default-profile card on success.
   */
  async upload(filePath: string): Promise<void> {
    await this.uploader.setFile(filePath);
    await this.toast.expectSuccess('Successfully uploaded.');
    await expect(this.customCard).toBeVisible();
    await expect(this.defaultCard).toBeHidden();
  }

  /** Client-side FileSaver download — Playwright still captures the event. */
  async download(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return downloadPromise;
  }

  /**
   * Deletes the uploaded custom profile and waits for the default-profile
   * card to take its place. Errors if there's no custom profile to delete.
   */
  async delete(): Promise<void> {
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await this.toast.expectSuccess('Successfully deleted.');
    await expect(this.customCard).toBeHidden();
    await expect(this.defaultCard).toBeVisible();
  }

  /** Safe to call from a cold start — no-op when the default profile is showing. */
  async deleteIfCustomPresent(): Promise<void> {
    if (await this.customCard.isVisible().catch(() => false)) {
      await this.delete();
    }
  }
}
