import { test } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Labels load times', () => {
  test('Labels', { tag: '@loadtest' }, async ({ labelsPage, page }, testInfo) => {
    await measureNav(page, testInfo, 'Labels', async () => {
      await labelsPage.goto();
    });
  });
});
