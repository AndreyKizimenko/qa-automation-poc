import { Page, Locator, expect } from '@playwright/test';

/**
 * Host status filter on /hosts/manage (Online / Offline / Missing / New).
 *
 * react-select trigger has no accessible role; options use Fleet's
 * `data-testid="dropdown-option"`.
 */
export class StatusFilter {
  readonly page: Page;
  readonly trigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.locator('.manage-hosts__status-filter .react-select__control');
  }

  async selectByName(status: string): Promise<void> {
    await this.trigger.click();
    const option = this.page.getByTestId('dropdown-option').filter({ hasText: status });
    await expect(option).toBeVisible();
    await option.click();
  }
}
