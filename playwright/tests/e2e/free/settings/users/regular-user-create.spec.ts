import { test, expect } from '@fixtures';
import { deleteUser, findUserByEmail, qaTestPassword } from '@helpers/api';
import type { GlobalRole } from '@pages';

// Free omits Observer+, Technician, and GitOps — the form-only roles
// configured in Fleet's userManagementHelpers when `isPremiumTier=false`.
const FREE_GLOBAL_ROLES: readonly GlobalRole[] = ['Observer', 'Maintainer', 'Admin'];

test.describe('Create regular user (free)', { tag: '@free' }, () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const createdUserIds: number[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await deleteUser(request, id, { ignoreMissing: true });
    }
  });

  test('Add user → Regular user lands on the create sub-page', async ({
    usersPage,
    createUserPage,
    page,
  }) => {
    await usersPage.goto();
    await usersPage.openAddUser('Regular user');
    await expect(page).toHaveURL(/\/settings\/users\/new\/human\b/);
    await expect(createUserPage.form.fullName).toBeVisible();
  });

  for (const role of FREE_GLOBAL_ROLES) {
    test(`creates user with role ${role}`, async ({
      createUserPage,
      usersPage,
      page,
      request,
    }) => {
      const slug = role.toLowerCase();
      const email = `qa-test-${stamp}-${slug}@fleetdm.com`;
      const name = `QA ${role}`;

      await createUserPage.goto();
      await createUserPage.form.fullName.fill(name);
      await createUserPage.form.email.fill(email);
      await createUserPage.form.password.fill(qaTestPassword());
      // No Permissions radio on free — role dropdown is shown by default.
      await createUserPage.form.selectGlobalRole(role);

      await createUserPage.submitButton.click();

      await expect(page).toHaveURL(/\/settings\/users\b/);
      await usersPage.toast.expectSuccess(`${name} has been created!`);
      const row = usersPage.rowByEmail(email);
      await expect(row).toBeVisible();
      await expect(row).toContainText(name);
      // Exact role-cell match — `toContainText('Observer')` would also
      // pass against an "Observer+" row on premium (not present on free,
      // but the assertion stays consistent across tiers).
      await expect(row.locator('.role__cell')).toHaveText(role);

      const created = await findUserByEmail(request, email);
      if (created) createdUserIds.push(created.id);
    });
  }

  test('activity feed shows the created-user entry', async ({ dashboard }) => {
    const sampleEmail = `qa-test-${stamp}-observer@fleetdm.com`;
    await dashboard.goto();
    await dashboard.expectActivity(
      new RegExp(`created a user\\s+${sampleEmail.replace('.', '\\.')}\\.`),
    );
  });
});
