/**
 * Premium • Labels • sort + view-all-hosts. Read-only checks against the
 * gitops-provisioned labels (no mutation): the Name column sorts ascending by
 * default and toggles to descending, and a row's "View all hosts" action lands
 * on the Hosts list filtered by that label.
 *
 * Grounded in frontend/pages/labels/ManageLabelsPage (client-side sort, default
 * name/asc) + the Hosts FilterPill (role="status" "hosts filtered by <label>").
 */
import { test, expect } from '@fixtures';

// Fleet's client-side table sort is case-sensitive (UTF-16 code-unit order):
// "ARM…" sorts before "Apple…" and "Macs with 1Password" before "…Brave".
const isSorted = (names: string[], dir: 'asc' | 'desc'): boolean => {
  for (let i = 1; i < names.length; i++) {
    if (dir === 'asc' ? names[i - 1] > names[i] : names[i - 1] < names[i]) return false;
  }
  return true;
};

test.describe('Premium • Labels • sort + view all hosts', () => {
  test('the Name column sorts ascending by default and toggles to descending', async ({ labelsPage }) => {
    await labelsPage.goto();

    const ascending = await labelsPage.labelNames();
    expect(ascending.length).toBeGreaterThan(1);
    expect(isSorted(ascending, 'asc')).toBe(true);

    await labelsPage.sortByColumn('Name');
    // Client-side re-sort is near-instant; poll until the column is descending.
    await expect.poll(async () => isSorted(await labelsPage.labelNames(), 'desc')).toBe(true);
  });

  test('"View all hosts" lands on the Hosts list filtered by that label', async ({ labelsPage, hostsList }) => {
    await labelsPage.goto();

    const name = (await labelsPage.labelNames())[0];
    await labelsPage.runRowAction(name, 'View all hosts');

    await expect(hostsList.filterPill).toBeVisible();
    await expect(hostsList.filterPill).toContainText(name);
  });
});
