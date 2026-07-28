import { Page, Locator, expect } from '@playwright/test';

/**
 * The "Select a report" modal opened from a host's Actions → Live report.
 * Lists every saved report the host's fleet can run, plus a link to author a new
 * one. Picking a report navigates to that report's edit screen with the host
 * pre-selected as the live-run target.
 *
 * Fleet's `Modal` renders its title in a `<span>` with no `role="dialog"`, so
 * the container is scoped by the modal's own `select-report-modal` class.
 */
export class SelectReportModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly filterInput: Locator;
  /** Link to author a new report instead of running a saved one. */
  readonly createReportLink: Locator;
  readonly closeButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.select-report-modal');
    this.filterInput = this.modal.getByPlaceholder('Filter reports');
    this.createReportLink = this.modal.getByRole('button', { name: 'create a report' });
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
    this.emptyState = this.modal.getByText('No saved reports');
  }

  /**
   * A report entry by name. Each entry is a button whose accessible name is the
   * report name followed by its description, so the match is a substring one.
   */
  report(name: string): Locator {
    return this.modal.getByRole('button', { name });
  }

  /** Filters the list by report name (client-side, case-insensitive). */
  async filter(term: string): Promise<void> {
    await this.filterInput.fill(term);
  }

  /** Picks a report, leaving the browser on that report's edit screen. */
  async selectReport(name: string): Promise<void> {
    await this.report(name).click();
    await expect(this.modal).toBeHidden();
  }
}
