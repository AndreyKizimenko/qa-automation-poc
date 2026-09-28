import { Page, Locator, expect } from '@playwright/test';
import { waitForTableSettled } from './DataTable';

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
  /** The dialog itself, scoped by its BEM class — Fleet's Modal exposes no role. */
  readonly modal: Locator;
  readonly vulnerableSwitch: Locator;
  /**
   * Premium-only severity controls. `SoftwareFiltersModal` renders them behind
   * `isPremiumTier`, and disables them until the Vulnerable software toggle is
   * on. react-select exposes no role on either the trigger or the value, so both
   * are reached through the SeverityFilter's own container class.
   */
  readonly severityTrigger: Locator;
  readonly severityValue: Locator;
  readonly applyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.software-filters-modal');
    // Button text toggles between "Add filters" and "1 filter" depending on state
    this.openButton = page.getByRole('button', { name: /filter/i });
    // The "Vulnerable software" toggle is rendered as <button role="switch"> by Fleet's Slider component
    this.vulnerableSwitch = page.locator('form').getByRole('switch');
    this.severityTrigger = page.locator('.severity-filter__dropdown .react-select__control');
    this.severityValue = page.locator('.severity-filter__dropdown .react-select__single-value');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /**
   * Open the filter modal. Fleet disables the trigger when the table has nothing
   * to filter, so this asserts it's enabled first — otherwise the click waits out
   * the whole test timeout and reports a bare `locator.click` failure instead of
   * the real problem (an empty table).
   */
  async open(): Promise<void> {
    await expect(this.openButton).toBeEnabled();
    await this.openButton.click();
  }

  /** Dismisses the modal without applying anything it changed. */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.modal).toBeHidden();
  }

  /**
   * The severity dropdown's options, in render order, each as
   * "<label> <help text>" — e.g. "Critical severity CVSS score 9.0-10". Fleet
   * stacks the two on separate lines, so the newline between them is collapsed.
   *
   * The menu is dismissed before returning: react-select renders it as an
   * overlay above the rest of the form, and an open one intercepts the click on
   * the modal's own Apply / Cancel buttons. Dismissed by re-clicking the
   * trigger rather than with Escape — Fleet's `Modal` closes on Escape too, so
   * that key takes the whole dialog down with the menu.
   */
  async severityOptions(): Promise<string[]> {
    await this.severityTrigger.click();
    const options = this.page.getByTestId('dropdown-option');
    await expect(options.first()).toBeVisible();
    const labels = (await options.allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim(),
    );
    await this.severityTrigger.click();
    await expect(options).toHaveCount(0);
    return labels;
  }

  /**
   * Full flow: open, toggle vulnerable, apply. Waits for the item count to
   * change so the caller knows the filtered data has actually rendered.
   */
  async applyVulnerable(): Promise<void> {
    await this.open();
    await this.vulnerableSwitch.click();
    await this.applyButton.click();
    // The vulnerable filter is reflected in the URL on both the software-titles
    // list and the host software tab, so asserting it confirms the filter took
    // effect without depending on the row count changing (a fully-vulnerable list
    // keeps its count).
    await expect(this.page).toHaveURL(/[?&]vulnerable=true/);
    // The URL flips on click, well ahead of the filtered result: `vulnerable=true`
    // is the slowest query the suite issues. Settling here means every caller
    // reads the filtered table rather than the unfiltered one it replaces.
    await waitForTableSettled(this.page);
  }
}
