import { test, expect } from '@fixtures';
import { createUser, deleteUser, qaTestEmail, withApiRequest } from '@helpers/api';

test.describe('Delete user', { tag: '@free' }, () => {
  test.describe.configure({ mode: 'serial' });

  const email = qaTestEmail('delete');
  const name = 'QA Delete Target';
  let userId: number | undefined;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const { user } = await createUser(request, {
        name,
        email,
        global_role: 'observer',
        admin_forced_password_reset: false,
      });
      userId = user.id;
    });
  });

  test.afterAll(async () => {
    if (userId === undefined) return;
    await withApiRequest((request) => deleteUser(request, userId!, { ignoreMissing: true }));
  });

  test('admin deletes a user via the row Actions menu', async ({ usersPage }) => {
    await usersPage.goto();
    const row = usersPage.rowByEmail(email);
    await expect(row).toBeVisible();

    await usersPage.clickRowAction(row, 'Delete');
    await expect(usersPage.deleteModal).toBeVisible();
    await expect(usersPage.deleteModal).toContainText(name);

    await usersPage.deleteConfirmButton.click();
    await expect(usersPage.deleteModal).toBeHidden();
    await usersPage.toast.expectSuccess(`Successfully deleted ${name}.`);
    // toHaveCount(0) auto-waits until the row locator resolves to zero,
    // so this is sufficient as a "row is gone" check.
    await expect(usersPage.table.rowWith(email)).toHaveCount(0);

    userId = undefined;
  });

  test('activity feed shows the deleted-user entry', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivity(
      new RegExp(`deleted a user ${email.replace('.', '\\.')}\\.`),
    );
  });
});
