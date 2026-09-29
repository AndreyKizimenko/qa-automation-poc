import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from './DataTable';

/**
 * Pagination controls used on every paginated list page. Click methods take
 * the page's `DataTable` so they can wait for the first row to change —
 * confirming the next/previous page rendered fresh data. The first row's
 * primary link is the signal where rows carry one; a table whose rows have no
 * link (Labels, Users) is compared on the whole first row's text instead.
 *
 * Each click settles the table first. Paging is a server round trip and Fleet
 * keeps the current page's rows on screen under a loading overlay until it
 * returns, so the text comparison is only meaningful once the overlay clears —
 * waiting on the overlay keys the wait to the request actually finishing rather
 * than to a guess at how long it takes.
 *
 * Compares via `innerText` (`useInnerText: true`) so injected `<style>` tags
 * from React-Tooltip don't pollute the comparison.
 */
export class Pagination {
  readonly next: Locator;
  readonly previous: Locator;

  constructor(page: Page) {
    this.next = page.getByRole('button', { name: 'Next' });
    this.previous = page.getByRole('button', { name: 'Previous' });
  }

  /** Click Next if enabled, then wait for the first row to change. */
  async nextIfEnabled(table: DataTable): Promise<boolean> {
    return this.turn(this.next, table);
  }

  /** Click Previous if enabled, then wait for the first row to change. */
  async previousIfEnabled(table: DataTable): Promise<boolean> {
    return this.turn(this.previous, table);
  }

  private async turn(control: Locator, table: DataTable): Promise<boolean> {
    if (await control.isDisabled()) return false;
    await expect(table.firstRow).toBeVisible();
    // Reading a link that isn't there has no timeout of its own, so a
    // link-less table is compared on the row itself.
    const marker = (await table.firstRowPrimaryLink.count()) ? table.firstRowPrimaryLink : table.firstRow;
    const before = (await marker.innerText()).trim();
    await control.click();
    await table.waitForSettled();
    await expect(marker).not.toHaveText(before, { useInnerText: true });
    return true;
  }
}
