import { Page, Locator, expect } from '@playwright/test';

/**
 * "Script details" — one script execution's result. Fleet raises the same
 * `RunScriptDetailsModal` from a host's Past activity, the dashboard activity
 * feed and the Run script modal's **Show run details**, so one object serves all
 * three entry points.
 *
 * The modal shows a status line (`IconStatusMessage`) and, once the run has an
 * exit code, the output the host recorded:
 *
 *   | exit code        | status line |
 *   |---|---|
 *   | 0                | `Exit code: 0 (Script ran successfully.)` |
 *   | non-zero         | `Exit code: N (Script failed.)` |
 *   | -1 (timeout)     | `Error: Timeout. Fleet stopped the script after N seconds to protect host performance.` |
 *   | none yet         | `Script is running or will run when the host comes online.` |
 *
 * Neither the status line nor the output has a role or label of its own — the
 * output is a styled `div`, not a form control — so both are reached through
 * the modal's classes.
 */
export class ScriptDetailsModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly statusMessage: Locator;
  /** The recorded output. Absent while pending, and when the run recorded none. */
  readonly output: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.run-script-details-modal');
    this.statusMessage = this.modal.locator('.icon-status-message__content');
    // Scoped to the result block: an ad-hoc run also renders its script content
    // in a code box of the same class above it.
    this.output = this.modal.locator('.run-script-details-modal__script-result .textarea--code');
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.statusMessage).toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
