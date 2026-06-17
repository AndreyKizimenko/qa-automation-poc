import { test, expect } from '@fixtures';
import { createUser, deleteUser, withApiRequest } from '@helpers/api';

test.describe('Users search', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const alphaEmail = `qa-test-${stamp}-searchalpha@fleetdm.com`;
  const betaEmail = `qa-test-${stamp}-searchbeta@fleetdm.com`;
  const alphaName = `QA Search Alpha ${stamp}`;
  const betaName = `QA Search Beta ${stamp}`;
  const createdUserIds: number[] = [];

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const a = await createUser(request, {
        name: alphaName,
        email: alphaEmail,
        global_role: 'observer',
        admin_forced_password_reset: false,
      });
      const b = await createUser(request, {
        name: betaName,
        email: betaEmail,
        global_role: 'maintainer',
        admin_forced_password_reset: false,
      });
      createdUserIds.push(a.user.id, b.user.id);
    });
  });

  test.afterAll(async () => {
    await withApiRequest(async (request) => {
      for (const id of createdUserIds) {
        await deleteUser(request, id, { ignoreMissing: true });
      }
    });
  });

  test('search by name narrows the table to the matching user', async ({ usersPage }) => {
    await usersPage.goto();
    await usersPage.search.fill(alphaName);

    await expect(usersPage.rowByName(alphaName)).toBeVisible();
    await expect(usersPage.table.rowWith(betaName)).toHaveCount(0);
  });

  test('search by email narrows the table to the matching user', async ({ usersPage }) => {
    await usersPage.goto();
    await usersPage.search.fill(betaEmail);

    await expect(usersPage.rowByEmail(betaEmail)).toBeVisible();
    await expect(usersPage.table.rowWith(alphaEmail)).toHaveCount(0);
  });

  test('clearing the search restores the unfiltered list', async ({ usersPage }) => {
    await usersPage.goto();
    await usersPage.search.fill(alphaName);
    // The unique name narrows the table to exactly its one row. Waiting on that
    // exact count is the reliable "filter settled" signal — a plain "alpha visible"
    // or a row-count read can be spoofed by a pre-debounce render, or by the other
    // user simply paginating off page 1 rather than being filtered out.
    await expect(usersPage.table.table.locator('tbody tr')).toHaveCount(1);
    await expect(usersPage.rowByName(alphaName)).toBeVisible();

    await usersPage.search.fill('');
    // Clearing lifts the filter; the table returns to its multi-row first page.
    await expect
      .poll(async () => usersPage.table.table.locator('tbody tr').count())
      .toBeGreaterThan(1);
  });
});
