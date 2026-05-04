/**
 * Vulnerability-domain helpers that don't fit neatly on a single page object.
 *
 * The page objects in `pages/` (SoftwareTitlesPage, CveDetailPage, etc.) cover
 * most vulnerability-related UI interactions. This file holds only the
 * assertion helpers specific to the "Vulnerabilities" column in tables and
 * a few shared types / re-exports used by specs.
 */
import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../pages/components/DataTable';

// Re-export API helpers (Hosts discovery used by vuln specs to find hosts by platform)
export type { HostRef } from './api';
export { getApiToken, findHostByPlatform } from './api';

/** Shape of a software title discovered by `SoftwareTitlesPage.findByTypes`. */
export interface SoftwareRef {
  name: string;
  type: string;
}

/**
 * Assert that a row's "Vulnerabilities" cell shows real data (not the "---"
 * placeholder that means the server hasn't aggregated vuln info for this row).
 */
export async function expectRowHasVulnData(page: Page, row: Locator): Promise<void> {
  const table = new DataTable(page);
  const cell = await table.cellByColumn(row, 'Vulnerabilities');
  await expect(cell).not.toHaveText('---');
}

/**
 * Assert that a row's "Vulnerabilities" cell shows a single CVE ID directly
 * (rather than the "N vulnerabilities" aggregate). Returns the CVE text.
 */
export async function expectSingleCve(page: Page, row: Locator): Promise<string> {
  const table = new DataTable(page);
  const cell = await table.cellByColumn(row, 'Vulnerabilities');
  await expect(cell).toHaveText(/^CVE-\d{4}-\d+$/);
  return (await cell.innerText()).trim();
}

/**
 * Hover over a "N vulnerabilities" cell and assert that the tooltip renders
 * with a list of CVE entries.
 */
export async function assertVulnTooltip(page: Page, row: Locator): Promise<void> {
  const table = new DataTable(page);
  const cell = await table.cellByColumn(row, 'Vulnerabilities');
  await cell.hover();

  const tooltip = page
    .getByRole('list')
    .filter({ has: page.getByRole('listitem').filter({ hasText: /^CVE-/ }) });
  await expect(tooltip).toBeVisible({ timeout: 5000 });
  await expect(tooltip.getByRole('listitem').first()).toHaveText(/^CVE-\d{4}-\d+$/);
}
