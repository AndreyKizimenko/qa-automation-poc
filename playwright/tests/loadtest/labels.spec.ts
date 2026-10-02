import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Labels load times', () => {
  test('Labels', async ({ labelsPage, page }, testInfo) => {
    await measureNav(page, testInfo, 'Labels', async () => {
      await labelsPage.goto();
      // goto() anchors on the heading, which renders before the labels API
      // answers; the 500-row table is what this measurement is for.
      await expect(labelsPage.table.firstRow).toBeVisible();
    });
  });
});
