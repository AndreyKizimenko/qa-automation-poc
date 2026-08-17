import { Page, Locator, expect } from '@playwright/test';

/**
 * Fleet's toast notifications — the cards that slide into the bottom-right
 * after a CRUD action ("Successfully uploaded.", "Policy created.", an API
 * error, …). Rendered by `ToastNotification` on top of Sonner.
 *
 * Each card is a `role="alert"` element; success and error share identical
 * role and message markup, so the only thing that tells the two variants
 * apart is the `toast-notification__card--{success|error}` modifier class.
 * We anchor on the accessible role and narrow by that class.
 *
 * Sonner stacks up to ten cards and success toasts auto-dismiss after 5s,
 * so the matchers scope to a card carrying the expected text and take the
 * first hit — a second card lingering in the corner can't trip strict mode.
 */
export class Toast {
  readonly page: Page;
  readonly success: Locator;
  readonly error: Locator;
  readonly dismissButton: Locator;

  constructor(page: Page) {
    this.page = page;
    const card = page.getByRole('alert');
    this.success = card.and(page.locator('.toast-notification__card--success'));
    this.error = card.and(page.locator('.toast-notification__card--error'));
    this.dismissButton = page.getByRole('button', { name: 'Dismiss notification' });
  }

  /**
   * Clears every visible toast card. Because a success card lingers for 5s, a
   * flow that acts twice in quick succession can satisfy `expectSuccess` with
   * the *previous* action's card and so never wait for its own. Clearing first
   * makes the next `expectSuccess` match only the card the next action raises.
   */
  async dismissAll(): Promise<void> {
    for (const button of await this.dismissButton.all()) {
      await button.click();
    }
    await expect(this.dismissButton).toHaveCount(0);
  }

  /**
   * Asserts a success toast carrying `text` is showing. Success toasts live
   * for 5s, so assert this right after the triggering action rather than
   * after other post-action UI checks.
   */
  async expectSuccess(text: string | RegExp = /^Successfully/): Promise<void> {
    await expect(this.success.filter({ hasText: text }).first()).toBeVisible();
  }

  /**
   * Asserts an error toast carrying `text` is showing. Error toasts never
   * auto-dismiss, so other assertions may run before this one.
   */
  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.error.filter({ hasText: text }).first()).toBeVisible();
  }
}
