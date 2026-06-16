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

  test('clearing the search shows both users again', async ({ usersPage }) => {
    await usersPage.goto();
    await usersPage.search.fill(alphaName);
    await expect(usersPage.rowByName(alphaName)).toBeVisible();

    await usersPage.search.fill('');
    await expect(usersPage.rowByEmail(alphaEmail)).toBeVisible();
    await expect(usersPage.rowByEmail(betaEmail)).toBeVisible();
  });
});
