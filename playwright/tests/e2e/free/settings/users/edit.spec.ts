import { test, expect } from '@fixtures';
import { createUser, deleteUser, withApiRequest } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';

test.describe('Edit user', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const email = `qa-test-${stamp}-edit@fleetdm.com`;
  const initialName = 'QA Edit Initial';
  const updatedName = 'QA Edit Updated';

  let userId: number;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const { user } = await createUser(request, {
        name: initialName,
        email,
        global_role: 'observer',
        admin_forced_password_reset: false,
      });
      userId = user.id;
    });
  });

  test.afterAll(async () => {
    if (userId === undefined) return;
    await withApiRequest((request) => deleteUser(request, userId, { ignoreMissing: true }));
  });

  test('Save is disabled while Full name is empty', async ({ editUserPage }) => {
    await editUserPage.goto(userId);
    await editUserPage.form.fullName.fill('');
    await editUserPage.form.fullName.press('Tab');
    await expect(editUserPage.saveButton).toBeDisabled();
  });

  test('admin edits via row Actions → Edit; users row reflects the change', async ({
    usersPage,
    editUserPage,
    page,
  }) => {
    await usersPage.goto();
    await usersPage.search.fill(email);
    const row = usersPage.rowByEmail(email);
    await expect(row).toBeVisible();
    await usersPage.clickRowAction(row, 'Edit');

    await expect(page).toHaveURL(/\/settings\/users\/\d+\/edit\b/);
    await expect(editUserPage.humanHeading).toBeVisible();

    await editUserPage.form.fullName.fill(updatedName);
    await editUserPage.form.selectGlobalRole('Maintainer');
    await editUserPage.saveButton.click();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`Successfully edited ${updatedName}`);
    const updatedRow = usersPage.rowByEmail(email);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(updatedName);
    await expect(updatedRow).toContainText('Maintainer');
  });

  test('activity feed shows the edited-user entry', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivity(activityCopy.user.changedGlobalRole({ email, role: 'maintainer' }));
  });
});
