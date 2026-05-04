import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';

/**
 * `/controls/setup-experience/bootstrap-package` — admin uploads a `.pkg`
 * Fleet auto-installs on macOS hosts during ADE/Setup Experience.
 * Singleton per fleet: only one package can be active at a time.
 */
export class BootstrapPackagePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;

  readonly heading: Locator;
  readonly container: Locator;
  readonly statusTable: Locator;

  readonly emptyUploader: Locator;
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

    this.heading = page.getByRole('heading', { name: 'Bootstrap package', level: 2 });
    this.container = page.locator('.bootstrap-package');
    this.statusTable = page.getByRole('table');

    this.emptyUploader = page.locator('.bootstrap-package-uploader');
    this.listItem = page.locator('.bootstrap-package-list-item');
    this.listItemName = page.locator('.bootstrap-package-list-item__list-item-name');

    // testid is on a child div; click bubbles to the parent button.
    this.downloadIcon = page.getByTestId('download-icon');
    this.deleteIcon = page.getByTestId('trash-icon');

    this.deleteModal = page.locator('.delete-bootstrap-package-modal');
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete' });
  }

  /** `fleetId=0` targets the "Unassigned" (no-team) bootstrap. */
  async goto(opts: { fleetId?: number } = {}): Promise<void> {
    const qs = opts.fleetId !== undefined ? `?fleet_id=${opts.fleetId}` : '';
    await this.page.goto(`/controls/setup-experience/bootstrap-package${qs}`);
    await expect(this.heading).toBeVisible();
  }

  async upload(filePath: string): Promise<void> {
    await this.uploader.upload(filePath);
    await expect(this.listItem).toBeVisible();
  }

  async download(): Promise<import('@playwright/test').Download> {
    const dl = this.page.waitForEvent('download');
    await this.downloadIcon.click();
    return dl;
  }

  async delete(): Promise<void> {
    await this.deleteIcon.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.listItem).toBeHidden();
    await expect(this.emptyUploader).toBeVisible();
  }
}
