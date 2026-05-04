import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';

/**
 * `/controls/setup-experience/run-script` — admin uploads a `.sh` Fleet
 * runs on macOS hosts during ADE/Setup Experience. Singleton per fleet.
 * File input accepts `.sh` only.
 */
export class RunScriptPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;

  readonly heading: Locator;
  readonly container: Locator;

  readonly emptyUploadButton: Locator;
  readonly listItem: Locator;
  readonly listItemName: Locator;

  readonly downloadIcon: Locator;
  readonly deleteIcon: Locator;

  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);

    this.heading = page.getByRole('heading', { name: 'Run script', level: 2 });
    this.container = page.locator('.run-script');

    this.emptyUploadButton = page.getByRole('button', { name: 'Upload' });
    this.listItem = page.locator('.setup-experience-script-card');
    this.listItemName = this.listItem.locator('.setup-experience-script-card__info');

    // testid is on a child div; click bubbles to the parent button.
    this.downloadIcon = page.getByTestId('download-icon');
    this.deleteIcon = page.getByTestId('trash-icon');

    this.deleteModal = page.locator('.delete-setup-experience-script-modal');
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete' });
  }

  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/setup-experience/run-script${qs}`);
    await expect(this.heading).toBeVisible();
  }

  /** Auto-uploads on file selection. */
  async upload(filePath: string): Promise<void> {
    await this.uploader.upload(filePath);
    await expect(this.listItem).toBeVisible();
  }

  async delete(): Promise<void> {
    await this.deleteIcon.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.listItem).toBeHidden();
    await expect(this.emptyUploadButton).toBeVisible();
  }
}
