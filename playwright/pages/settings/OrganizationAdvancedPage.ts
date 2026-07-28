import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { Toast } from '../components/Toast';

/**
 * /settings/organization/advanced — the Advanced options subpage under
 * Organization settings.
 *
 * One Save covers the whole card: `performSave` posts host-lifecycle,
 * activity-retention, features and server-authentication values together
 * regardless of which one was edited.
 */
export class OrganizationAdvancedPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly toast: Toast;
  readonly heading: Locator;

  /** SMTP domain — the card's most inert field, unused on the QA instances. */
  readonly domainInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.toast = new Toast(page);
    // The page has no "Advanced options" title of its own — it opens straight
    // into its sections, of which Host lifecycle is the first.
    this.heading = page.getByRole('heading', { name: 'Host lifecycle', exact: true });

    this.domainInput = page.getByLabel('Domain', { exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/advanced');
    await expect(this.heading).toBeVisible();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }
}
