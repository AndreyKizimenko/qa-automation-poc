import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * /settings/organization/advanced — the Advanced options subpage under
 * Organization settings.
 */
export class OrganizationAdvancedPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.heading = page.getByRole('heading', { name: 'Advanced options', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/organization/advanced');
    await expect(this.heading).toBeVisible();
  }
}
