import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from './DataTable';

/**
 * Budget for a page turn. Paging is a server round trip rather than a local
 * re-render, and the slowest of them — the vulnerable-filtered software-titles
 * query — measures ~10s on the QA instances, which is exactly the project's
 * default assertion timeout. Waiting well past it keeps a slow list from
 * reading as a pagination failure.
 */
const PAGE_CHANGE_TIMEOUT = 30_000;

/**
 * Pagination controls used on every paginated list page. Click methods take
 * the page's `DataTable` so they can wait for the first row's primary link
 * text to change — confirming the next/previous page rendered fresh data.
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

  /** Click Next if enabled, then wait for the first row's primary link text to change. */
  async nextIfEnabled(table: DataTable): Promise<boolean> {
    if (await this.next.isDisabled()) return false;
    const before = await table.firstRowPrimaryLinkText();
    await this.next.click();
    await expect(table.firstRowPrimaryLink).not.toHaveText(before, {
      useInnerText: true,
      timeout: PAGE_CHANGE_TIMEOUT,
    });
    return true;
  }

  /** Click Previous if enabled, then wait for the first row's primary link text to change. */
  async previousIfEnabled(table: DataTable): Promise<boolean> {
    if (await this.previous.isDisabled()) return false;
    const before = await table.firstRowPrimaryLinkText();
    await this.previous.click();
    await expect(table.firstRowPrimaryLink).not.toHaveText(before, {
      useInnerText: true,
      timeout: PAGE_CHANGE_TIMEOUT,
    });
    return true;
  }
}
