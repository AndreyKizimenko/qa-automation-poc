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
  readonly scheduleRadio: Locator;
  /**
   * "Date (UTC)" / "Time (UTC)", shown only once Schedule for later is picked.
   * A field's label is replaced by its error while the value is invalid, so
   * these are found by label only before anything is typed into them.
   */
  readonly dateInput: Locator;
  readonly timeInput: Locator;
  readonly runButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.modal = page.locator('.run-script-batch-modal');
    this.summary = this.modal.getByText(/^Run a script on/);
    this.runNowRadio = this.modal.getByRole('radio', { name: 'Run now' });
    this.scheduleRadio = this.modal.getByRole('radio', { name: 'Schedule for later' });
    this.dateInput = this.modal.getByRole('textbox', { name: 'Date (UTC)' });
    this.timeInput = this.modal.getByRole('textbox', { name: 'Time (UTC)' });
    this.runButton = this.modal.getByRole('button', { name: 'Run', exact: true });
  }

  scriptItem(name: string): Locator {
    return this.modal.getByRole('listitem').filter({ hasText: name });
  }

  /**
   * Picks a script from the list and waits for the run step, which names the
   * script and the platforms it runs on, with Run now preselected.
   */
  async pickScript(scriptName: string, platformsNote: string): Promise<void> {
    const item = this.scriptItem(scriptName);
    await item.hover();
    await item.getByRole('button', { name: 'Run script' }).click();
    await expect(this.modal).toContainText(`${scriptName} will run on compatible hosts (${platformsNote}).`);
    await expect(this.runNowRadio).toBeChecked();
  }

  /**
   * Picks a script and runs it now; resolves once Fleet has accepted the batch.
   * Toasts left from earlier actions are cleared first, so the success card
   * waited for here, and the link {@link showScriptActivity} follows, are this
   * run's: a card from an earlier run would satisfy the wait before this run is
   * accepted, and would put a second "Show script activity" link on screen.
   */
  async runNow(scriptName: string, platformsNote: string): Promise<void> {
    await this.pickScript(scriptName, platformsNote);
    await this.toast.dismissAll();
    await this.runButton.click();
    await this.toast.expectSuccess(/^Successfully ran script\./);
    await expect(this.modal).toBeHidden();
  }

  /**
   * Switches the picked script to Schedule for later, which reveals the Date
   * and Time fields (both UTC). Fleet's `Radio` hides its `<input>`
   * (`display:none`), so the label is what takes the click.
   */
  async chooseSchedule(): Promise<void> {
    await this.modal.getByText('Schedule for later', { exact: true }).click();
    await expect(this.scheduleRadio).toBeChecked();
    await expect(this.dateInput).toBeVisible();
    await expect(this.timeInput).toBeVisible();
  }

  /**
   * Fills the schedule (`date` as YYYY-MM-DD, `time` as HH:MM, both UTC) and
   * submits; resolves once Fleet has accepted the scheduled batch. Each field is
   * filled in one action, so it's never seen half-typed and invalid. Earlier
   * toasts are cleared first, as in {@link runNow}.
   */
  async submitSchedule(date: string, time: string): Promise<void> {
    await this.dateInput.fill(date);
    await this.timeInput.fill(time);
    await expect(this.runButton).toBeEnabled();
    await this.toast.dismissAll();
    await this.runButton.click();
    await this.toast.expectSuccess(/^Successfully scheduled script\./);
    await expect(this.modal).toBeHidden();
  }

  /**
   * Follows the success toast's "Show script activity" link to Controls → Scripts → Batch progress.
   * Exactly one such link must be on screen: two cards would make it ambiguous which run it opens.
   */
  async showScriptActivity(): Promise<void> {
    await this.followToastLink('Show script activity');
  }

  /** Follows the scheduled toast's "Show schedule" link to Batch progress → Scheduled. */
  async showSchedule(): Promise<void> {
    await this.followToastLink('Show schedule');
  }

  private async followToastLink(name: string): Promise<void> {
    const link = this.toast.success.getByRole('link', { name });
    await expect(link, `exactly one "${name}" toast on screen`).toHaveCount(1);
    await link.click();
  }
}
