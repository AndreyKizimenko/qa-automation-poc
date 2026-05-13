import { test, expect } from '@fixtures';
import { createUser, deleteUser, withApiRequest } from '@helpers/api';

const BULK_COUNT = 20;

test.describe('Users pagination', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const createdUserIds: number[] = [];

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const creates = Array.from({ length: BULK_COUNT }, (_, i) => {
        const idx = String(i).padStart(2, '0');
        return createUser(request, {
          name: `QA Pagination ${idx}`,
          email: `qa-test-${stamp}-pag${idx}@fleetdm.com`,
          global_role: 'observer',
          admin_forced_password_reset: false,
        });
      });
      const results = await Promise.all(creates);
      for (const r of results) createdUserIds.push(r.user.id);
    });
  });

  test.afterAll(async () => {
    await withApiRequest(async (request) => {
      for (const id of createdUserIds) {
        await deleteUser(request, id, { ignoreMissing: true });
      }
    });
  });

  test('Next pagination control becomes enabled and advances the table', async ({
    usersPage,
    page,
  }) => {
    await usersPage.goto();

    const nextButton = page.getByRole('button', { name: /next page/i }).or(
      page.getByRole('button', { name: 'Next' }),
    );
    await expect(nextButton).toBeEnabled();

    const firstPageFirstRowText = (await usersPage.table.firstRow.innerText()).trim();
    await nextButton.click();
    await expect.poll(async () => (await usersPage.table.firstRow.innerText()).trim())
      .not.toBe(firstPageFirstRowText);
  });
});
