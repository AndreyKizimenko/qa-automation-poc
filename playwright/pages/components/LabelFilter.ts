import { Page, Locator, expect } from '@playwright/test';

/**
 * Platform / label filter dropdown on /hosts/manage. Filters by OS platform
 * (macOS, Windows, Linux, ...) or by a custom label.
 *
 * Backed by react-select v5; the visible trigger has no accessible role, so
 * class selectors are unavoidable.
 */
const BUILT_IN_PLATFORMS = ['macOS', 'Windows', 'Linux', 'ChromeOS', 'iOS', 'iPadOS', 'Android'];

export class LabelFilter {
  readonly page: Page;
  readonly trigger: Locator;
  readonly options: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.locator('.label-filter-select__control');
    this.options = page.locator('.label-filter-select__option');
  }

  async selectPlatform(platform: string): Promise<void> {
    await this.trigger.click();
    const option = this.options.filter({ hasText: platform });
    await expect(option).toBeVisible();
    await option.click();
  }

  /** Picks the first non-platform label (or the first option if none exist). */
  async selectFirstCustomLabel(): Promise<void> {
    await this.trigger.click();
    const count = await this.options.count();
    for (let i = 0; i < count; i++) {
      const text = await this.options.nth(i).textContent();
      if (text && !BUILT_IN_PLATFORMS.some((p) => text.includes(p))) {
        await this.options.nth(i).click();
        return;
      }
    }
    await this.options.first().click();
  }
}
