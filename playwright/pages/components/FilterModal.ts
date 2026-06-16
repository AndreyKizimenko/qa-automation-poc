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

    // The table footer shows a "N items"/"N results" count. Capturing it before
    // applying lets us prove the filtered set re-rendered, since the count drops
    // when the vulnerable filter narrows the list (the first-row identity can stay
    // the same across that change, so the count — not the row — is the real signal).
    // Wait for the count first so the before-value is a real read, not an empty
    // pre-render one that would silently skip the assertion.
    const countLocator = this.page.locator('text=/\\d[\\d,]*\\s+(items?|results?)/').first();
    await expect(countLocator).toBeVisible();
    const countBefore = await countLocator.innerText();

    await this.applyButton.click();

    await expect(countLocator).not.toHaveText(countBefore, { timeout: 10000 });
  }
}
