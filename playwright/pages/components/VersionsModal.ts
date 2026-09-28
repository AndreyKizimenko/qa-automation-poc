import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/**
 * The "Versions" modal on a software title's detail page (Fleet's
 * `VersionsModal`). Premium + Fleet-maintained apps only — it's how a title is
 * pinned to a version instead of tracking whatever Fleet ships next.
 *
 * Fleet offers exactly three shapes of pin, all rendered as radios in one
 * fieldset:
 *   - *latest*  — "Automatically update to latest"; PATCHed as an empty
 *     `version`, which clears the pin.
 *   - *exact*   — "Pin to 1.2.3", one per cached version, newest first.
 *   - *major*   — "Pin to major version (1)", tracking the newest version's
 *     major; PATCHed as `^1`.
 *
 * The option list is derived from the title's cached `fleet_maintained_versions`,
 * so a freshly-added app offers one exact pin (its current version) and one
 * major pin. Resolve the labels from the API rather than hard-coding a version
 * string: Fleet re-publishes upstream releases and the cache grows over time.
 *
 * Save stays disabled until the selection differs from the stored pin, which is
 * also the signal that `select()` actually changed something.
 */

export type PinTarget =
  | { kind: 'latest' }
  | { kind: 'exact'; version: string }
  | { kind: 'major'; major: string };

/** The radio label Fleet renders for a pin target. */
export const pinTargetLabel = (target: PinTarget): string => {
  switch (target.kind) {
    case 'latest':
      return 'Automatically update to latest';
    case 'exact':
      return `Pin to ${target.version}`;
    case 'major':
      return `Pin to major version (${target.major})`;
  }
};

/** The `version` value Fleet PATCHes for a pin target — what the API reads back. */
export const pinTargetApiValue = (target: PinTarget): string => {
  switch (target.kind) {
    case 'latest':
      return '';
    case 'exact':
      return target.version;
    case 'major':
      return `^${target.major}`;
  }
};

export class VersionsModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly options: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly toast: Toast;

  constructor(page: Page) {
    this.page = page;
    // Fleet's Modal renders no role="dialog" and its title sits in a plain
    // <span>, so the container is its BEM class. `.versions-modal` is unique.
    this.modal = page.locator('.versions-modal');
    this.options = this.modal.getByRole('radio');
    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel', exact: true });
    this.toast = new Toast(page);
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.options.first()).toBeAttached();
  }

  /**
   * The radio for a pin target. Fleet's `Radio` hides the real `<input>` and
   * drives it through a `<label for=…>`, so the input is present but not
   * visible; the label text is its accessible name, which `getByRole` resolves.
   */
  radio(target: PinTarget): Locator {
    return this.modal.getByRole('radio', { name: pinTargetLabel(target), exact: true });
  }

  /** Every option label, in the order Fleet lists them. */
  async optionLabels(): Promise<string[]> {
    return (await this.modal.locator('.radio__label').allInnerTexts()).map((t) => t.trim());
  }

  /**
   * Pick a pin target. Clicks the label because the `<input>` itself is
   * `display: none`, then confirms the radio took the selection.
   */
  async select(target: PinTarget): Promise<void> {
    await this.modal
      .locator('.radio__radio-control')
      .filter({ hasText: pinTargetLabel(target) })
      .click();
    await expect(this.radio(target)).toBeChecked();
  }

  /**
   * Save the pin and wait for the success toast and the modal to close.
   * `displayName` is the software's rendered name, which Fleet bolds into
   * "Successfully updated <name> version."
   */
  async save(displayName: string): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.toast.expectSuccess(`Successfully updated ${displayName} version.`);
    await expect(this.modal).toBeHidden();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.modal).toBeHidden();
  }
}
