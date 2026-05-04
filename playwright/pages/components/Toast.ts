import { Page, Locator, expect } from '@playwright/test';

/**
 * Fleet's flash-message banner — the toast that pops in after every CRUD
 * action ("Successfully uploaded.", "Successfully updated.", error text, …).
 *
 * Scoped to `.flash-message--success` / `.flash-message--error` so the
 * assertion only matches the toast itself, not body copy that happens to
 * contain the same words. Exact-match by default; pass a RegExp for
 * substring/looser checks.
 */
export class Toast {
  readonly page: Page;
  readonly success: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.success = page.locator('.flash-message--success');
    this.error = page.locator('.flash-message--error');
  }

  async expectSuccess(text: string | RegExp = /^Successfully/): Promise<void> {
    await expect(this.success).toBeVisible();
    await expect(this.success).toContainText(text);
  }

  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.error).toBeVisible();
    await expect(this.error).toContainText(text);
  }
}
