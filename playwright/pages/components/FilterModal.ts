import { Page, Locator, expect } from '@playwright/test';

/**
 * The "Add filters" modal used on /software/titles and the host details
 * Software tab. Lets users toggle the Vulnerable software filter and
 * (on Premium) configure severity / exploit filters.
 *
 * Opening the modal is done from the parent page (clicks the "Add filters"
 * button). This component exposes the form controls inside the modal.
 */
export class FilterModal {
  readonly page: Page;
  readonly openButton: Locator;
  readonly vulnerableSwitch: Locator;
  readonly applyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Button text toggles between "Add filters" and "1 filter" depending on state
    this.openButton = page.getByRole('button', { name: /filter/i });
    // The "Vulnerable software" toggle is rendered as <button role="switch"> by Fleet's Slider component
    this.vulnerableSwitch = page.locator('form').getByRole('switch');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /** Open the filter modal. */
  async open(): Promise<void> {
    await this.openButton.click();
  }

  /**
   * Full flow: open, toggle vulnerable, apply. Waits for the item count to
   * change so the caller knows the filtered data has actually rendered.
   */
  async applyVulnerable(): Promise<void> {
    await this.open();
    await this.vulnerableSwitch.click();

    // Capture the item count before applying so we can detect the re-render
    const countLocator = this.page.locator('text=/\\d[\\d,]*\\s+items?/').first();
    const countBefore = await countLocator.innerText().catch(() => '');

    await this.applyButton.click();

    if (countBefore) {
      await expect(countLocator).not.toHaveText(countBefore, { timeout: 10000 });
    }
  }
}
