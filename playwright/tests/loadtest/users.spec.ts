import { test } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Users load times', () => {
  test('Users', async ({ usersPage, page }, testInfo) => {
    await measureNav(page, testInfo, 'Users', async () => {
      await usersPage.goto();
    });
  });
});
