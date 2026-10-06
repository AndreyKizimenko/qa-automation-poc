import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { FileUploader } from '../components/FileUploader';
import { Toast } from '../components/Toast';

/**
 * `/controls/setup-experience/bootstrap-package` — admin uploads a `.pkg`
 * Fleet auto-installs on macOS hosts during ADE/Setup Experience.
 * Singleton per fleet: only one package can be active at a time.
 *
 * Below the uploader, an "Advanced options" reveal holds "Install Fleet's agent
 * (fleetd) manually" with its own Save. Fleet disables the checkbox until the
 * fleet has a package, and while it's saved on, the fleet's Install software
 * (macOS) and Run script cards are disabled.
 */
export class BootstrapPackagePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly uploader: FileUploader;
  readonly toast: Toast;

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

  readonly advancedOptionsButton: Locator;
  readonly manualAgentInstallCheckbox: Locator;
  readonly advancedOptionsSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.uploader = new FileUploader(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Bootstrap package', level: 2 });
    this.container = page.locator('.bootstrap-package');
    this.statusTable = page.getByRole('table');

    // Fleet's <FileUploader> renders as `.file-uploader` with no role;
    // scope to the bootstrap-package container so we don't collide with
    // other uploaders (script library, custom package, etc.).
    this.emptyUploader = this.container.locator('.file-uploader');
    this.listItem = page.locator('.bootstrap-package-list-item');
    this.listItemName = page.locator('.bootstrap-package-list-item__list-item-name');

    // testid is on a child div; click bubbles to the parent button.
    this.downloadIcon = page.getByTestId('download-icon');
    this.deleteIcon = page.getByTestId('trash-icon');

    this.deleteModal = page.locator('.delete-bootstrap-package-modal');
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: 'Delete' });

    // The advanced options render in a role-less <div> with a Save of its own;
    // its BEM root scopes them so that Save can't be confused with another.
    const advanced = page.locator('.bootstrap-advanced-options');
    this.advancedOptionsButton = advanced.getByRole('button', { name: 'Advanced options' });
    this.manualAgentInstallCheckbox = advanced.getByRole('checkbox', {
      name: "Install Fleet's agent (fleetd) manually",
    });
    this.advancedOptionsSaveButton = advanced.getByRole('button', { name: 'Save', exact: true });
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

  /** Reveals the Advanced options form. A no-op when it's already open. */
  async openAdvancedOptions(): Promise<void> {
    if (!(await this.manualAgentInstallCheckbox.isVisible())) await this.advancedOptionsButton.click();
    await expect(this.manualAgentInstallCheckbox).toBeVisible();
  }

  /** Saves the Advanced options form and waits for its own toast. */
  async saveAdvancedOptions(): Promise<void> {
    await this.toast.dismissAll();
    await this.advancedOptionsSaveButton.click();
    await this.toast.expectSuccess('Successfully updated.');
  }

  async delete(): Promise<void> {
    await this.deleteIcon.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.listItem).toBeHidden();
    await expect(this.emptyUploader).toBeVisible();
  }
}
