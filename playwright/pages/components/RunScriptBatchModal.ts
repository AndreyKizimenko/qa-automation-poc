import { Page, Locator, expect } from '@playwright/test';
import { Toast } from './Toast';

/**
 * Hosts list → select hosts → **Run script**: pick one of the fleet's library
 * scripts and run it on every selected host now, or schedule it. The modal first
 * lists the scripts ("Run a script on N hosts…"), then, once one is picked,
 * names it with the platforms it can run on and offers Run now / Schedule for
 * later.
 *
 * Fleet's `Modal` renders no dialog role, so the modal is scoped by its own
 * class; the scripts are list items whose "Run script" button only appears on
 * hover.
 */
export class RunScriptBatchModal {
  readonly page: Page;
  readonly toast: Toast;
  readonly modal: Locator;
  /** "Run a script on <b>N hosts</b>, or schedule a script…" */
  readonly summary: Locator;
  readonly runNowRadio: Locator;
  readonly runButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.modal = page.locator('.run-script-batch-modal');
    this.summary = this.modal.getByText(/^Run a script on/);
    this.runNowRadio = this.modal.getByRole('radio', { name: 'Run now' });
    this.runButton = this.modal.getByRole('button', { name: 'Run', exact: true });
  }

  scriptItem(name: string): Locator {
    return this.modal.getByRole('listitem').filter({ hasText: name });
  }

  /** Picks a script and runs it now; resolves once Fleet has accepted the batch. */
  async runNow(scriptName: string, platformsNote: string): Promise<void> {
    const item = this.scriptItem(scriptName);
    await item.hover();
    await item.getByRole('button', { name: 'Run script' }).click();
    await expect(this.modal).toContainText(`${scriptName} will run on compatible hosts (${platformsNote}).`);
    await expect(this.runNowRadio).toBeChecked();
    await this.runButton.click();
    await this.toast.expectSuccess(/^Successfully ran script\./);
    await expect(this.modal).toBeHidden();
  }

  /** Follows the success toast's "Show script activity" link to Controls → Scripts → Batch progress. */
  async showScriptActivity(): Promise<void> {
    await this.toast.success.getByRole('link', { name: 'Show script activity' }).click();
  }
}
