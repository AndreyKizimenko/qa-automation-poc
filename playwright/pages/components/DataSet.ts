import { Page, Locator } from '@playwright/test';

/**
 * Fleet's `DataSet` component renders a term/value pair as
 * `<div class="data-set"><dt>{title}</dt><dd>{value}</dd></div>` with no role,
 * so each value is reached by filtering the `.data-set` wrapper to its visible
 * title and reading the sibling `<dd>`. Used by detail pages and side panels
 * (policy details, my-account). Construct with a scoped container when several
 * DataSets share a page.
 */
export class DataSet {
  constructor(private readonly scope: Page | Locator) {}

  /** The `<dd>` value cell of the DataSet whose `<dt>` shows `title`. */
  value(title: string): Locator {
    return this.scope.locator('.data-set').filter({ hasText: title }).locator('dd');
  }
}
