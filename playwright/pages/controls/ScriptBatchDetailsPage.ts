import { Page, Locator, expect } from '@playwright/test';
import { ScriptPreviewModal } from '../components/ScriptPreviewModal';
import { Toast } from '../components/Toast';

/** The per-status tabs of a batch run, in the order Fleet shows them. */
export type BatchHostStatus = 'Ran' | 'Errored' | 'Pending' | 'Incompatible' | 'Canceled';

/**
 * `/controls/scripts/progress/:batchExecutionId` — one batch script run: the
 * script's name as the heading, "N hosts targeted (P% responded)", **Show
 * script** and (until the batch finishes) **Cancel**, and a tab per host
 * status, each listing its hosts with the output they returned.
 *
 * A tab's accessible name carries its count when it has hosts ("Ran 1") and is
 * the bare status when it has none; an open tab with hosts heads its table with
 * the same count ("1 host", "3 hosts"). The counts are live until the batch
 * finishes, then cached. Incompatible hosts never count as having responded — a
 * `.sh` batch on a Windows host lands there.
 *
 * A scheduled batch lists every targeted host under Pending until it starts;
 * cancelling it finishes it at once with all of them under Canceled.
 */
export class ScriptBatchDetailsPage {
  readonly page: Page;
  readonly toast: Toast;
  readonly root: Locator;
  readonly heading: Locator;
  readonly summary: Locator;
  readonly backButton: Locator;
  /** The open tab's host table rows. */
  readonly hostRows: Locator;
  readonly emptyTab: Locator;
  /** "N host(s)" above the open tab's table; absent when the tab is empty. */
  readonly tabHostCount: Locator;

  /** The eye icon prepends its name to the button's ("eye Show script"). */
  readonly showScriptButton: Locator;
  readonly preview: ScriptPreviewModal;
  /** Absent once the batch has finished, cancelled or not. */
  readonly cancelButton: Locator;
  /** "Cancel script?" — rendered beside the page, not inside it. */
  readonly cancelModal: Locator;
  readonly cancelConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    this.root = page.locator('.script-batch-details-page');
    this.heading = this.root.getByRole('heading', { level: 2 });
    this.summary = this.root.getByText(/hosts targeted/);
    this.backButton = this.root.getByRole('button', { name: 'Back to script activity' });
    this.hostRows = this.root.getByRole('tabpanel').getByRole('table').locator('tbody').getByRole('row');
    this.emptyTab = this.root.getByRole('tabpanel').getByText('No hosts with this status');
    this.tabHostCount = this.root.getByRole('tabpanel').getByText(/^\d+ hosts?$/);

    this.showScriptButton = this.root.getByRole('button', { name: /Show script$/ });
    this.preview = new ScriptPreviewModal(page);
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
    this.cancelModal = page.locator('.cancel-script-batch-modal');
    this.cancelConfirmButton = this.cancelModal.getByRole('button', { name: 'Cancel script' });
  }

  async goto(batchExecutionId: string): Promise<void> {
    await this.page.goto(`/controls/scripts/progress/${batchExecutionId}`);
    await expect(this.heading).toBeVisible();
  }

  /** A status tab, whose name is "<status>" or "<status> <count>". */
  tab(status: BatchHostStatus): Locator {
    return this.root.getByRole('tab', { name: new RegExp(`^${status}( \\d+)?$`) });
  }

  async openTab(status: BatchHostStatus): Promise<void> {
    await this.tab(status).click();
    await expect(this.tab(status)).toHaveAttribute('aria-selected', 'true');
  }

  /** Host names listed in the open tab, in row order. */
  async hostNames(): Promise<string[]> {
    await expect(this.hostRows.first().or(this.emptyTab)).toBeVisible();
    return (await this.hostRows.getByRole('link').allInnerTexts()).map((t) => t.trim());
  }

  /** Opens **Show script**; the caller checks the content (`preview.expectContent`). */
  async showScript(): Promise<ScriptPreviewModal> {
    await this.showScriptButton.click();
    await this.preview.expectOpen();
    return this.preview;
  }

  /**
   * Opens **Cancel** and stops at the "Cancel script?" confirmation, so the
   * caller can read it; {@link confirmCancel} cancels.
   */
  async openCancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.cancelModal).toBeVisible();
  }

  /**
   * Confirms "Cancel script?" and waits for Fleet to accept the cancel. Fleet
   * then leaves for Batch progress, on the tab the batch was listed under
   * before (`?status=<scheduled|started>`), with `fleet_id` only for a batch on
   * a fleet: Unassigned's batches carry none.
   */
  async confirmCancel(): Promise<void> {
    await this.toast.dismissAll();
    await this.cancelConfirmButton.click();
    await this.toast.expectSuccess('Successfully canceled script.');
    await expect(this.cancelModal).toBeHidden();
    await expect(this.page).toHaveURL(/\/controls\/scripts\/progress(\?|$)/);
  }
}
