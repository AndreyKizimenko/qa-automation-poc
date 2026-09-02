import { test, expect } from '@fixtures';
import { createApiUser, createUser, deleteUser, withApiRequest } from '@helpers/api';
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

  test('clearing Full name blocks Save without disabling it', async ({ editUserPage, page }) => {
    // Validation is a pure form-behaviour check, so direct navigation is
    // fine here — the row-Actions entry point is exercised by the flow
    // test below.
    await editUserPage.goto(userId);
    await editUserPage.form.fullName.fill('');
    await editUserPage.form.fullName.press('Tab');
    await expect(page.getByText('Enter a name')).toBeVisible();
    await expect(editUserPage.saveButton).toBeEnabled();

    // Save refuses the empty name, so the edit never reaches the API and the
    // user this serial block goes on to edit is left untouched.
    await editUserPage.saveButton.click();
    await expect(page).toHaveURL(/\/settings\/users\/\d+\/edit\b/);
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
    // Fleet only appends the period (and confirmation-email suffix) when
    // the user's email was changed too; for a name+role-only edit the
    // toast ends at the user's name.
    await usersPage.toast.expectSuccess(`Successfully edited ${updatedName}`);
    // The save redirect lands on an unfiltered list; re-search so the row is on
    // page 1 regardless of how crowded the table is under concurrency.
    const updatedRow = await usersPage.findRowByEmail(email);
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(updatedName);
    await expect(updatedRow).toContainText('Maintainer');
  });

  test('activity feed shows the edited-user entry', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivity(activityCopy.user.changedGlobalRole({ email, role: 'maintainer' }));
  });
});

test.describe('Edit API-only user', () => {
  const stamp = Date.now();
  const name = `QA API Edit ${stamp}`;
  let apiUserId: number;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      const { user } = await createApiUser(request, { name, global_role: 'observer' });
      apiUserId = user.id;
    });
  });

  test.afterAll(async () => {
    if (apiUserId === undefined) return;
    await withApiRequest((request) => deleteUser(request, apiUserId, { ignoreMissing: true }));
  });

  test('switches an API user from All to Specific endpoints and saves', async ({
    editUserPage,
    usersPage,
    page,
  }) => {
    await editUserPage.goto(apiUserId);
    await expect(editUserPage.apiUserHeading).toBeVisible();

    // Default is All endpoints; switching reveals the endpoint selector.
    await expect(editUserPage.endpointTable).toBeHidden();
    await editUserPage.specificEndpointsLabel.click();
    await expect(editUserPage.endpointTable).toBeVisible();
    await editUserPage.addEndpoint('hosts', /List hosts/);

    await editUserPage.saveButton.click();
    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(/Successfully edited/);
  });
});
