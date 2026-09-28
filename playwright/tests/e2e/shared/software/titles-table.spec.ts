/**
 * Software • Inventory table. Read-only checks on the software inventory's own
 * controls: which columns Fleet renders, which of them it sorts on, and that
 * sorting actually orders the page it returns.
 *
 * Shared because the table is identical on both tiers — same columns, same two
 * sortable headers, same server-side ordering. What differs is the Library tab
 * beside it, which is premium-only; that case lives in
 * `premium/software/titles-table.spec.ts`.
 *
 * **Only page one is compared.** The source flow paged the whole table and
 * diffed the collected values against a locally-sorted copy, which re-tests
 * MySQL's ordering over thousands of rows for minutes at a time. Fleet sorts on
 * the server, so the contract is "the page Fleet returned is ordered" plus "the
 * order_key/order_direction I asked for is what it was asked for" — both
 * assertable on one page.
 *
 * Name ordering is asserted case-insensitively: the column uses a MySQL
 * case-insensitive collation, so "Zoom" and "zoom" tie and their relative order
 * is arbitrary.
 *
 * Grounded in frontend/pages/SoftwarePage's software-titles table config —
 * only Name and Hosts render a `sortable-header` button.
 */
import { test, expect } from '@fixtures';

// The columns the inventory table renders, in order. A named list survives a
// column being inserted; the source flow's nth(0)/nth(2)/nth(4) did not.
const COLUMNS = ['Name', 'Version', 'Type', 'Vulnerabilities', 'Hosts'];

// Fleet sorts on these two only; the rest render a plain header.
const SORTABLE = ['Name', 'Hosts'];
const NOT_SORTABLE = COLUMNS.filter((c) => !SORTABLE.includes(c));

const caseInsensitive = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { sensitivity: 'base' });

const isSorted = (values: string[], compare: (a: string, b: string) => number): boolean =>
  values.every((value, i) => i === 0 || compare(values[i - 1], value) <= 0);

/**
 * Host counts are read from the rendered cell, and Fleet formats a count over
 * 999 with a thousands separator — `Number('1,234')` is `NaN`, which would make
 * every ordering comparison silently false rather than failing. Both QA instances
 * sit well under that today; a loadtest-scale instance would not.
 */
const hostCount = (cell: string): number => Number(cell.replace(/,/g, ''));

test.describe('Software • inventory table', () => {
  test('renders its columns and marks only Name and Hosts sortable', async ({ softwareTitles }) => {
    await softwareTitles.goto();
    // No-op on free; on premium this is the scope holding the simulated pool,
    // which is the one with a wide spread of names and host counts to sort.
    await softwareTitles.teamDropdown.select('Unassigned');

    expect(await softwareTitles.columnHeaders()).toEqual(COLUMNS);

    for (const column of SORTABLE) {
      await expect(softwareTitles.sortControl(column)).toBeVisible();
    }
    for (const column of NOT_SORTABLE) {
      await expect(softwareTitles.sortControl(column)).toHaveCount(0);
    }
  });

  test('sorting by Name orders the page in both directions', async ({ softwareTitles }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');

    await softwareTitles.sortBy('Name', 'name', 'asc');
    const ascending = await softwareTitles.columnValues('Name');
    expect(ascending.length).toBeGreaterThan(1);
    expect(isSorted(ascending, caseInsensitive)).toBe(true);

    await softwareTitles.sortBy('Name', 'name', 'desc');
    const descending = await softwareTitles.columnValues('Name');
    expect(isSorted(descending, (a, b) => caseInsensitive(b, a))).toBe(true);
    // The two directions must not be the same page — a sort control that
    // flipped the URL without re-querying would otherwise pass both checks.
    expect(descending[0]).not.toBe(ascending[0]);
  });

  test('sorting by Hosts orders the page in both directions', async ({ softwareTitles }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');

    await softwareTitles.sortBy('Hosts', 'hosts_count', 'asc');
    const ascending = (await softwareTitles.columnValues('Hosts')).map(hostCount);
    expect(ascending.length).toBeGreaterThan(1);
    expect(ascending.every((n, i) => i === 0 || ascending[i - 1] <= n)).toBe(true);

    await softwareTitles.sortBy('Hosts', 'hosts_count', 'desc');
    const descending = (await softwareTitles.columnValues('Hosts')).map(hostCount);
    expect(descending.every((n, i) => i === 0 || descending[i - 1] >= n)).toBe(true);
    expect(descending[0]).toBeGreaterThan(ascending[0]);
  });
});
