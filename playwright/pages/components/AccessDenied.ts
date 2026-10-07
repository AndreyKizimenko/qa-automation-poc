import { Page, Locator, expect } from '@playwright/test';

/**
 * Fleet's 403 page (`Fleet403`): what a route guard renders in place of a page
 * the signed-in role may not open — `/policies/new` for an observer, the whole
 * Controls area for one, and so on. It's a bare `<h1>403</h1>` over "Access
 * denied.", with no page chrome of its own beyond the navbar.
 */
export class AccessDenied {
  readonly page: Page;
  readonly statusCode: Locator;
  readonly message: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusCode = page.getByRole('heading', { name: '403', level: 1 });
    this.message = page.getByText('Access denied.', { exact: true });
  }

  /** Opens `path` and asserts the route guard turned the role away. */
  async expectAt(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.statusCode).toBeVisible();
    await expect(this.message).toBeVisible();
  }
}
