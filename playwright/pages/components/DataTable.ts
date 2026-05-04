import { Page, Locator } from '@playwright/test';

/**
 * Reusable component object for Fleet's DataTable — the `<table>` used on
 * hosts, software, versions, vulnerabilities, and every other list page.
 *
 * Exposes three row signals:
 *   - `firstRow`          — any first row (the table shell has rendered a row)
 *   - `firstRowWithLink`  — the first row that contains a link (actual data
 *                           has rendered, not just the skeleton). Use this for
 *                           perf timing and for pages that load data async.
 *   - `rowOrEmpty()`      — firstRow OR the empty-state container, for pages
 *                           that might have zero data.
 *
 * Also provides:
 *   - `rowWith(text)`     — find a row by its textual content
 *   - `cellByColumn(row, header)` — find a cell by visible column header text
 *
 * For waiting after pagination, use `Pagination.nextIfEnabled(table)` /
 * `previousIfEnabled(table)` — they assert the first row's text changed.
 * For waiting after a tab switch or filter change, await
 * `expect(table.firstRow).toBeVisible()` (after capturing previous text if
 * you also need to confirm content changed).
 */
export class DataTable {
  readonly page: Page;
  readonly table: Locator;
  readonly firstRow: Locator;
  readonly firstRowWithLink: Locator;
  /**
   * The first link in the first data row — the row's primary entity link
   * (host display name, software title, CVE ID, report name, …). Skips
   * leading checkbox-only cells since those contain no link. Prefer this
   * over hand-assembling row → cell → link locators in specs.
   */
  readonly firstRowPrimaryLink: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.table = page.getByRole('table');
    const tbodyRow = this.table.locator('tbody').getByRole('row');
    this.firstRow = tbodyRow.first();
    this.firstRowWithLink = tbodyRow.filter({ has: page.getByRole('link') }).first();
    this.firstRowPrimaryLink = this.firstRowWithLink.getByRole('link').first();
    // EmptyState wrapper has no role.
    this.emptyState = page.locator('.empty-state');
  }

  /** firstRow OR empty-state — use when the page might have no data. */
  rowOrEmpty(): Locator {
    return this.firstRow.or(this.emptyState);
  }

  /** Find a row by its visible text (anywhere in the row). */
  rowWith(text: string | RegExp): Locator {
    return this.table.getByRole('row').filter({ hasText: text });
  }

  /**
   * Trimmed visible text of the first row's primary link. Use as the input
   * for any "did the first row identity change" wait — pair with
   * `expect.poll(...)` to compare against a captured `before` value.
   * Reads via `innerText`, so injected `<style>` tags from tooltip widgets
   * don't pollute the result.
   */
  async firstRowPrimaryLinkText(): Promise<string> {
    return (await this.firstRowPrimaryLink.innerText()).trim();
  }

  /**
   * Find the cell in `row` that corresponds to the visible column header.
   * Resolves the column position from the header once; works regardless of
   * column order or column-count changes.
   */
  async cellByColumn(row: Locator, header: string): Promise<Locator> {
    const headers = this.table.locator('thead th');
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const text = (await headers.nth(i).innerText()).trim();
      if (text === header) return row.locator('td').nth(i);
    }
    throw new Error(`Column "${header}" not found in table headers`);
  }

  /**
   * Find the first row whose given column text matches the regex.
   * Returns the row locator, or `null` if no matching row is on the current page.
   */
  async findRowByColumnPattern(header: string, pattern: RegExp): Promise<Locator | null> {
    const rows = this.table.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const cell = await this.cellByColumn(row, header);
      const text = (await cell.innerText()).trim();
      if (pattern.test(text)) return row;
    }
    return null;
  }
}
