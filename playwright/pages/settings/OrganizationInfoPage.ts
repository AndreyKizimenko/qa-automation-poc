import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * /settings/organization/info — the Organization info subpage. Has an h1
 * "Settings" for the whole Settings section plus an h2 "Organization info"
 * for this subpage.
 */
export class OrganizationInfoPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.heading = page.getByRole('heading', { name: 'Organization info' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/info');
    await expect(this.heading).toBeVisible();
  }
}
