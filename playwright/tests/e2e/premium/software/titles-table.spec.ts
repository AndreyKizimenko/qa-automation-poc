/**
 * Premium • Software • Library vs Inventory. The premium-only half of the
 * software table: Fleet #44467 split the old titles page into an **Inventory**
 * tab (everything the hosts report) and a **Library** tab (only what Fleet can
 * install — custom packages, FMA, VPP, Android). The Library tab is what the
 * "installable software" filter used to be, and it does not exist on free, where every
 * installer path is paywalled.
 *
 * The rest of the table — its columns and its two sortable headers — is
 * identical on both tiers and lives in `shared/software/titles-table.spec.ts`.
 *
 * Read-only: both counts are read, neither list is touched.
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Software • Library vs Inventory', () => {
  test('the Library tab is the installable subset of Inventory', async ({ softwareTitles }) => {
    await softwareTitles.goto({ fleetId: 0 });
    await softwareTitles.teamDropdown.select('Unassigned');
    const inventoryCount = await itemCount(softwareTitles.resultsCount);

    await softwareTitles.gotoLibraryTab();
    const libraryCount = await itemCount(softwareTitles.resultsCount);

    // Inventory is everything the hosts report; Library is only what Fleet can
    // install. The subset relation is the invariant — the exact counts move
    // with whatever the library lifecycle specs have added in parallel.
    expect(libraryCount).toBeLessThan(inventoryCount);
  });
});

/** Parses the "1,234 items" summary into a number. */
async function itemCount(locator: { innerText(): Promise<string> }): Promise<number> {
  const text = await locator.innerText();
  const match = text.match(/([\d,]+)\s+items?/);
  if (!match) throw new Error(`Could not read an item count from "${text}"`);
  return Number(match[1].replace(/,/g, ''));
}
