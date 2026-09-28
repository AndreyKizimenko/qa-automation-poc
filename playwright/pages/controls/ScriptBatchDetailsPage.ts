import { Page, Locator, expect } from '@playwright/test';

/** The per-status tabs of a batch run, in the order Fleet shows them. */
export type BatchHostStatus = 'Ran' | 'Errored' | 'Pending' | 'Incompatible' | 'Canceled';

/**
 * `/controls/scripts/progress/:batchExecutionId` — one batch script run: the
 * script's name as the heading, "N hosts targeted (P% responded)", and a tab per
 * host status, each listing its hosts with the output they returned.
 *
 * A tab's accessible name carries its count when it has hosts ("Ran 1") and is
 * the bare status when it has none. Incompatible hosts never count as having
 * responded — a `.sh` batch on a Windows host lands there.
 */
export class ScriptBatchDetailsPage {
  readonly page: Page;
  readonly root: Locator;
  readonly heading: Locator;
  readonly summary: Locator;
  readonly backButton: Locator;
  /** The open tab's host table rows. */
  readonly hostRows: Locator;
  readonly emptyTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('.script-batch-details-page');
    this.heading = this.root.getByRole('heading', { level: 2 });
    this.summary = this.root.getByText(/hosts targeted/);
    this.backButton = this.root.getByRole('button', { name: 'Back to script activity' });
    this.hostRows = this.root.getByRole('tabpanel').getByRole('table').locator('tbody').getByRole('row');
    this.emptyTab = this.root.getByRole('tabpanel').getByText('No hosts with this status');
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
}
