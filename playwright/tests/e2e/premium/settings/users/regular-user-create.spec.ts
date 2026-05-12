import { test, expect } from '@fixtures';
import { deleteUser, findUserByEmail, qaTestPassword } from '@helpers/api';
import type { GlobalRole } from '@pages';

const PREMIUM_GLOBAL_ROLES: readonly GlobalRole[] = [
  'Observer',
  'Observer+',
  'Technician',
  'Maintainer',
  'Admin',
];

test.describe('Create regular user (premium)', () => {
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

  for (const role of PREMIUM_GLOBAL_ROLES) {
    test(`creates global user with role ${role}`, async ({
      createUserPage,
      usersPage,
      page,
      request,
    }) => {
      // "Observer+" must produce a different slug from "Observer".
      const slug = role.replace(/\+/g, 'plus').toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `qa-test-${stamp}-${slug}@fleetdm.com`;
      const name = `QA ${role}`;

      await createUserPage.goto();
      await createUserPage.form.fullName.fill(name);
      await createUserPage.form.email.fill(email);
      await createUserPage.form.password.fill(qaTestPassword());
      // Premium defaults Permissions to "Assign to fleet(s)"; switch to
      // Global user so the role dropdown renders.
      await createUserPage.form.useGlobalUser();
      await createUserPage.form.selectGlobalRole(role);

      await createUserPage.submitButton.click();

      await expect(page).toHaveURL(/\/settings\/users\b/);
      await usersPage.toast.expectSuccess(`${name} has been created!`);
      const row = await usersPage.findRowByEmail(email);
      await expect(row).toBeVisible();
      await expect(row).toContainText(name);
      // Anchored on `.role__cell` with exact text so Observer and Observer+
      // never collide.
      await expect(row.locator('.role__cell')).toHaveText(role);
      // Email cell shows the address we submitted — confirms the UI →
      // API → UI round-trip on the email field.
      await expect(row.locator('.email__cell')).toHaveText(email);
      await expect(row).toContainText('Global');

      const created = await findUserByEmail(request, email);
      if (created) createdUserIds.push(created.id);
    });
  }

  test('creates user assigned to Workstations with Maintainer role', async ({
    createUserPage,
    usersPage,
    page,
    request,
  }) => {
    const email = `qa-test-${stamp}-wsmaintainer@fleetdm.com`;
    const name = 'QA Workstations Maintainer';

    await createUserPage.goto();
    await createUserPage.form.fullName.fill(name);
    await createUserPage.form.email.fill(email);
    await createUserPage.form.password.fill(qaTestPassword());

    // Assign-to-fleets is already the default on premium — no radio click needed.
    await createUserPage.form.toggleFleet('Workstations');
    await createUserPage.form.selectFleetRole('Workstations', 'Maintainer');

    await createUserPage.submitButton.click();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByEmail(email);
    await expect(row).toBeVisible();
    await expect(row).toContainText(name);
    await expect(row.locator('.role__cell')).toHaveText('Maintainer');
    await expect(row.locator('.email__cell')).toHaveText(email);
    await expect(row).toContainText('Workstations');

    const created = await findUserByEmail(request, email);
    if (created) createdUserIds.push(created.id);
  });

  test('creates user assigned to 2 fleets with different roles', async ({
    createUserPage,
    usersPage,
    page,
    request,
  }) => {
    const email = `qa-test-${stamp}-twofleetsdiff@fleetdm.com`;
    const name = 'QA Two Fleets Diff';

    await createUserPage.goto();
    await createUserPage.form.fullName.fill(name);
    await createUserPage.form.email.fill(email);
    await createUserPage.form.password.fill(qaTestPassword());

    await createUserPage.form.toggleFleet('Workstations');
    await createUserPage.form.selectFleetRole('Workstations', 'Observer');
    await createUserPage.form.toggleFleet('QA');
    await createUserPage.form.selectFleetRole('QA', 'Admin');

    await createUserPage.submitButton.click();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByEmail(email);
    await expect(row).toBeVisible();
    // Fleet collapses mixed-role assignments to "2 fleets" + "Various".
    await expect(row).toContainText('2 fleets');
    await expect(row.locator('.role__cell')).toHaveText('Various');
    await expect(row.locator('.email__cell')).toHaveText(email);

    const created = await findUserByEmail(request, email);
    if (created) createdUserIds.push(created.id);
  });

  test('creates user assigned to 2 fleets with the same role', async ({
    createUserPage,
    usersPage,
    page,
    request,
  }) => {
    const email = `qa-test-${stamp}-twofleetssame@fleetdm.com`;
    const name = 'QA Two Fleets Same';

    await createUserPage.goto();
    await createUserPage.form.fullName.fill(name);
    await createUserPage.form.email.fill(email);
    await createUserPage.form.password.fill(qaTestPassword());

    await createUserPage.form.toggleFleet('Workstations');
    await createUserPage.form.selectFleetRole('Workstations', 'Observer');
    await createUserPage.form.toggleFleet('QA');
    await createUserPage.form.selectFleetRole('QA', 'Observer');

    await createUserPage.submitButton.click();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByEmail(email);
    await expect(row).toBeVisible();
    // Same role across fleets → Role cell shows the role name (exact),
    // not "Various". Anchoring on `.role__cell` keeps the match precise.
    await expect(row).toContainText('2 fleets');
    await expect(row.locator('.role__cell')).toHaveText('Observer');
    await expect(row.locator('.email__cell')).toHaveText(email);

    const created = await findUserByEmail(request, email);
    if (created) createdUserIds.push(created.id);
  });

  test('activity feed shows the created-user entry', async ({ dashboard }) => {
    // Use one of the users we just created to anchor the activity match.
    // The first global-role test creates "qa-test-<stamp>-observer@fleetdm.com".
    const sampleEmail = `qa-test-${stamp}-observer@fleetdm.com`;
    await dashboard.goto();
    await dashboard.expectActivity(new RegExp(`created a user\\s+${sampleEmail.replace('.', '\\.')}\\.`));
  });
});
