import { Page, Locator } from '@playwright/test';

/**
 * Fleet's `DataSet` component renders a term/value pair as
 * `<div class="data-set"><dt>{title}</dt><dd>{value}</dd></div>` with no role,
 * so each value is reached by finding the wrapper whose `<dt>` is the requested
 * title and reading the sibling `<dd>`. Used by detail pages and side panels
 * (host vitals, policy details, my-account). Construct with a scoped container
 * when several DataSets share a page.
 */
export class DataSet {
  constructor(private readonly scope: Page | Locator) {}

  /**
   * The `<dd>` value cell of the DataSet whose `<dt>` is exactly `title`.
   *
   * The title is matched whole rather than as a substring, because Fleet ships
   * titles that contain one another — a host's vitals list has both "Fleet" and
   * "Added to Fleet", and a substring match resolves to both. A horizontal
   * DataSet appends a colon to its term, so one is tolerated.
   */
  value(title: string): Locator {
    // Expressed as one selector rather than a `filter({ has })`: a `has` locator
    // keeps the chain of whatever root built it, so a DataSet scoped to a
    // container would look for that container *inside* each `.data-set`.
    const t = title.replace(/"/g, '\\"');
    return this.scope
      .locator(`.data-set:has(dt:text-is("${t}")), .data-set:has(dt:text-is("${t}:"))`)
      .locator('dd');
  }
}
