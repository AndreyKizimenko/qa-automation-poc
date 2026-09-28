import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/reports/:id/live` — the live-run flow for a saved report. Two screens share
 * the route:
 *
 *  1. **Select targets** — host/label/fleet picker. Reached with a host already
 *     selected when the run was started from a host's Actions → Live report.
 *  2. **Run** — opened by "Run". Streams results over a websocket, so the
 *     heading goes "Running report" → "Report finished" once every targeted host
 *     has answered or the campaign times out.
 *
 * A host that answers may return rows, no rows, or an error, so a spec asserting
 * a completed run should key on the finished heading and the responded count,
 * and treat `resultsRows` / `noResultsState` as alternatives.
 */
export class ReportLivePage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly heading: Locator;
  readonly runButton: Locator;
  readonly cancelButton: Locator;
  /** Rows of the selected-targets table on the "Select targets" screen. */
  readonly targetRows: Locator;
  /**
   * "N hosts targeted (P% online)" under the picker. Rendered as role-less
   * spans, so it's scoped by the page's own class; empty until something is
   * selected.
   */
  readonly targetsTotalCount: Locator;

  // Run screen.
  readonly runningHeading: Locator;
  readonly finishedHeading: Locator;
  readonly stopButton: Locator;
  readonly closeButton: Locator;
  readonly runAgainButton: Locator;
  readonly resultsTab: Locator;
  readonly errorsTab: Locator;
  readonly resultsRows: Locator;
  /** Shown when the run finished but no targeted host returned rows. */
  readonly noResultsState: Locator;
  /**
   * The heading's "N host(s) targeted (P% responded)" summary. `LiveResultsHeading`
   * renders it as role-less spans, so it's scoped by the component's own class.
   */
  readonly runSummary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.heading = page.getByRole('heading', { name: 'Select targets', level: 1 });
    this.runButton = page.getByRole('button', { name: 'Run', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.targetRows = page.getByRole('table').locator('tbody').getByRole('row');
    this.targetsTotalCount = page.locator('.run-query-page__targets-total-count');

    this.runningHeading = page.getByRole('heading', { name: 'Running report', level: 1 });
    this.finishedHeading = page.getByRole('heading', { name: 'Report finished', level: 1 });
    this.stopButton = page.getByRole('button', { name: 'Stop', exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close', exact: true });
    this.runAgainButton = page.getByRole('button', { name: 'Run again' });
    this.resultsTab = page.getByRole('tab', { name: 'Results' });
    this.errorsTab = page.getByRole('tab', { name: 'Errors' });
    // The results table only exists once rows have streamed in; scoped to the
    // results container so it can't match the targets table.
    this.resultsRows = page
      .locator('.query-results__results-table-container')
      .getByRole('table')
      .locator('tbody')
      .getByRole('row');
    this.noResultsState = page.getByText('No results returned');
    this.runSummary = page.locator('.live-results-heading__information');
  }

  async waitForReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  /**
   * A target chip — "All hosts", a platform, a fleet, or a label. Each is a
   * button whose accessible name is the target's name prefixed by its state
   * icon ("plus" unselected, "check" selected), so the match is a substring and
   * selection is read from `data-selected` rather than from the name.
   */
  targetChip(name: string): Locator {
    // Anchored to the end of the accessible name so a target cannot be matched by
    // a longer one that contains it. The picker lists fleets and labels side by
    // side, so a label sharing a fleet's name is a real strict-mode collision,
    // not a theoretical one. The state icon supplies the prefix.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.getByRole('button', { name: new RegExp(`${escaped}\\s*$`) });
  }

  /** Toggles a target chip and waits for its selected state to settle. */
  async toggleTarget(name: string, selected: boolean): Promise<void> {
    const chip = this.targetChip(name);
    if ((await chip.getAttribute('data-selected')) === String(selected)) return;
    await chip.click();
    await expect(chip).toHaveAttribute('data-selected', String(selected));
  }

  /** Starts the run; leaves the browser on the streaming results screen. */
  async run(): Promise<void> {
    await this.runButton.click();
  }
}
