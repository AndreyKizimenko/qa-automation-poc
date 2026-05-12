import { Page, Locator, expect } from '@playwright/test';

/**
 * Visible labels in the platform combobox on the App store tab of the
 * Add software view. "Apple (...)" covers VPP for macOS/iOS/iPadOS;
 * "Android" switches the form to the Managed Google Play picker.
 */
export type AppStorePlatformLabel = 'Apple (macOS, iOS, and iPadOS)' | 'Android';

/**
 * Platform combobox shown on `/software/add/app-store`. Backed by
 * react-select v5 — same accessibility gap as the team dropdown, so we
 * scope by the form-field's BEM container class and rely on the
 * generic `react-select__*` children inside it.
 */
export class PlatformDropdown {
  readonly page: Page;
  readonly trigger: Locator;
  readonly currentValue: Locator;

  constructor(page: Page) {
    this.page = page;
    // Container class scopes to the App store tab's platform field
    // specifically (the team dropdown reuses the same react-select
    // primitives but lives under a different parent class).
    this.trigger = page.locator('.software-app-store__platform-dropdown .react-select__control');
    this.currentValue = page.locator('.software-app-store__platform-dropdown .react-select__single-value');
  }

  /**
   * Idempotently selects a platform by its visible label. Switching the
   * platform updates the `platform=` URL query param and swaps the form
   * (VPP list vs. Android applicationId input).
   */
  async select(label: AppStorePlatformLabel): Promise<void> {
    const current = (await this.currentValue.textContent())?.trim();
    if (current === label) return;
    await this.trigger.click();
    await this.page.locator('.react-select__option').filter({ hasText: label }).click();
    await expect(this.currentValue).toHaveText(label);
  }
}
