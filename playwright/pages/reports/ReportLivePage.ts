import { Page, Locator, Download, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/** Which live run the page belongs to: a report's or a policy's. */
export type LiveRunKind = 'report' | 'policy';

/**
 * `/reports/:id/live` — the live-run flow for a saved report. Two screens share
 * the route:
 *
 *  1. **Select targets** — host/label/fleet picker. Reached with a host already
 *     selected when the run was started from a host's Actions → Live report.
 *  2. **Run** — opened by "Run". Streams results over a websocket, so the
 *     heading goes "Running report" → "Report finished" once every online
 *     targeted host has answered. Nothing else ends the run: a host that stays
 *     online without answering keeps it running until someone presses Stop, so
 *     a spec bounds its wait on the finished heading.
 *
 * A host that answers may return rows, no rows, or an error, so a spec asserting
 * a completed run should key on the finished heading and the responded count,
 * and treat `resultsRows` / `noResultsState` as alternatives.
 *
 * A policy's live run (`/policies/:id/live`) renders the same two screens with
 * its own heading copy and target-count class; `PolicyLivePage` builds this
 * page object for that kind and adds the policy's Yes / No summary.
 */
export class ReportLivePage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly kind: LiveRunKind;

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
  /** "Target specific hosts": a host search whose results are picked by clicking a row. */
  readonly hostSearch: Locator;

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
  /** "Export results": downloads the results table as a CSV. */
  readonly exportResultsButton: Locator;
  /** The "N result(s)" count above the results table. */
  readonly resultsCount: Locator;
  /** The results table's header row. */
  readonly resultsHeader: Locator;

  constructor(page: Page, kind: LiveRunKind = 'report') {
    this.page = page;
    this.navbar = new Navbar(page);
    this.kind = kind;

    this.heading = page.getByRole('heading', { name: 'Select targets', level: 1 });
    this.runButton = page.getByRole('button', { name: 'Run', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.targetRows = page.getByRole('table').locator('tbody').getByRole('row');
    // The picker takes its page's base class, so the count's class differs by kind.
    this.targetsTotalCount = page.locator(
      kind === 'report' ? '.run-query-page__targets-total-count' : '.live-policy-page__targets-total-count',
    );
    this.hostSearch = page.getByPlaceholder('Search name, user email, hostname, UUID, serial number, or IP address');

    const kindLabel = kind === 'report' ? 'Report' : 'Policy';
    this.runningHeading = page.getByRole('heading', { name: `Running ${kind}`, level: 1 });
    this.finishedHeading = page.getByRole('heading', { name: `${kindLabel} finished`, level: 1 });
    this.stopButton = page.getByRole('button', { name: 'Stop', exact: true });
    this.closeButton = page.getByRole('button', { name: 'Close', exact: true });
    this.runAgainButton = page.getByRole('button', { name: 'Run again' });
    this.resultsTab = page.getByRole('tab', { name: 'Results' });
    this.errorsTab = page.getByRole('tab', { name: 'Errors' });
    // The results table only exists once rows have streamed in; scoped to the
    // results container so it can't match the targets table.
    const resultsTable = page.locator('.query-results__results-table-container').getByRole('table');
    this.resultsRows = resultsTable.locator('tbody').getByRole('row');
    this.resultsHeader = resultsTable.locator('thead');
    this.noResultsState = page.getByText('No results returned');
    this.runSummary = page.locator('.live-results-heading__information');
    this.exportResultsButton = page.getByRole('button', { name: 'Export results' });
    this.resultsCount = page.locator('.query-results').getByText(/^[\d,]+ results?$/);
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

  /**
   * Adds one host to the targets by searching for it and clicking its result. The
   * results drop down in a table of their own beside the selected-hosts table,
   * and only the dropdown wrapper's class tells the two apart.
   */
  async targetHost(displayName: string): Promise<void> {
    await this.hostSearch.fill(displayName);
    const result = this.page
      .locator('.targets-input__hosts-search-dropdown')
      .getByRole('row')
      .filter({ hasText: displayName });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect(this.targetRows.filter({ hasText: displayName })).toHaveCount(1);
  }

  /** Starts the run; leaves the browser on the streaming results screen. */
  async run(): Promise<void> {
    await this.runButton.click();
  }

  /**
   * A results column's sort control. A sortable header renders as a button named
   * after the column; the live tables sort in the browser, with no request.
   */
  resultsSortControl(column: string): Locator {
    return this.resultsHeader.getByRole('button', { name: column, exact: true });
  }

  /**
   * One results column's cell text, row by row as rendered. The column is found
   * by its header's position, read once the run has finished and the table has
   * stopped re-rendering.
   */
  async resultsColumnValues(column: string): Promise<string[]> {
    const headers = (await this.resultsHeader.locator('th').allInnerTexts()).map((h) => h.trim());
    const index = headers.indexOf(column);
    expect(index, `no "${column}" column among ${JSON.stringify(headers)}`).toBeGreaterThanOrEqual(0);
    const cells = await this.resultsRows.locator(`td:nth-child(${index + 1})`).allInnerTexts();
    return cells.map((c) => c.trim());
  }

  /** Clicks "Export results" and returns the CSV download. */
  async exportResults(): Promise<Download> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.exportResultsButton.click()]);
    return download;
  }
}
