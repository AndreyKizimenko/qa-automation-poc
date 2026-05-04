import { Page, expect } from '@playwright/test';
import { ContentList } from '../components/ContentList';
import { Navbar } from '../components/Navbar';

/**
 * /controls/variables — custom variables defined for the fleet.
 */
export class VariablesPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly list: ContentList;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.list = new ContentList(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/controls/variables');
    await expect(this.list.firstItem).toBeVisible();
  }
}
