import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /settings/organization/info — the Organization info subpage. Has an h1
 * "Settings" for the whole Settings section plus an h2 "Organization info"
 * for this subpage. Mutating this page changes global app config, so specs
 * snapshot + restore via the config API helper.
 */
export class OrganizationInfoPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;

  readonly heading: Locator;
  readonly orgNameInput: Locator;
  readonly supportUrlInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'Organization info' });
    this.orgNameInput = page.getByRole('textbox', { name: 'Organization name' });
    this.supportUrlInput = page.getByRole('textbox', { name: 'Organization support URL' });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/info');
    await expect(this.heading).toBeVisible();
    await expect(this.orgNameInput).toBeVisible();
  }

  async setOrgName(name: string): Promise<void> {
    await this.orgNameInput.fill(name);
  }

  async setSupportUrl(url: string): Promise<void> {
    await this.supportUrlInput.fill(url);
  }

  /** Save the form and wait for the success toast. */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.toast.expectSuccess('Successfully updated settings.');
  }
}
