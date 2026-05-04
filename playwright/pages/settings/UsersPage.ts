import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

/**
 * /settings/users — user management. Table rows contain no links (user
 * edits happen via per-row action menus), so we wait for any row.
 */
export class UsersPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;

  readonly createUserButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.createUserButton = page.getByRole('button', { name: /create user/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings/users');
    await expect(this.table.firstRow).toBeVisible();
  }
}
