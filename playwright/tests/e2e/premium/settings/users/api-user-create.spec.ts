import { test, expect } from '@fixtures';
import type { APIRequestContext, Locator } from '@playwright/test';
import { deleteUser, listUsers } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';
import type { ApiGlobalRole } from '@pages';

/**
 * API users render with a Name cell containing both the user's full name
 * (inside the standard `.data-table__tooltip-truncated-text` span) and
 * an "API" pill badge. These assertions verify both — anchoring on the
 * pill class gives a stronger check than `row.toContainText('API')`,
 * which would also match an `API` substring of the name field.
 */
async function assertApiUserRow(row: Locator, name: string, role: string): Promise<void> {
  await expect(row).toBeVisible();
  await expect(row.locator('.data-table__tooltip-truncated-text').first()).toHaveText(name);
  await expect(row.locator('.pill-badge')).toHaveText('API');
  // Anchored on `.role__cell` with exact text so Observer and Observer+
  // never collide.
  await expect(row.locator('.role__cell')).toHaveText(role);
}

const PREMIUM_API_ROLES: readonly ApiGlobalRole[] = [
  'Observer',
  'Observer+',
  'Technician',
  'GitOps',
  'Maintainer',
  'Admin',
];

/**
 * API users don't carry an email — Fleet's backend stamps a placeholder
 * address on the user record. We match by name (which we control) for
 * cleanup lookups.
 */
async function findApiUserIdByName(
  request: APIRequestContext,
  name: string,
): Promise<number | null> {
  const users = await listUsers(request, { query: name });
  const match = users.find((u) => u.api_only && u.name === name);
  return match ? match.id : null;
}

test.describe('Create API-only user (premium)', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const createdUserIds: number[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdUserIds) {
      await deleteUser(request, id, { ignoreMissing: true });
    }
  });

  test('Add user → API-only user lands on the API create sub-page', async ({
    usersPage,
    createApiUserPage,
    page,
  }) => {
    await usersPage.goto();
    await usersPage.openAddUser('API-only user');
    await expect(page).toHaveURL(/\/settings\/users\/new\/api\b/);
    await expect(createApiUserPage.name).toBeVisible();
  });

  // ── Global API users, one per role ─────────────────────────────────────────
  for (const role of PREMIUM_API_ROLES) {
    test(`creates global API user with role ${role} (all endpoints)`, async ({
      createApiUserPage,
      usersPage,
      page,
      request,
    }) => {
      const slug = role.replace(/\+/g, 'plus').toLowerCase().replace(/[^a-z0-9]/g, '');
      const name = `QA API ${role} ${stamp}-${slug}`;

      await createApiUserPage.goto();
      await createApiUserPage.name.fill(name);
      await expect(createApiUserPage.globalUserRadio).toBeChecked();
      await expect(createApiUserPage.allEndpointsRadio).toBeChecked();
      await createApiUserPage.selectGlobalRole(role);

      await createApiUserPage.submitAndDone();

      await expect(page).toHaveURL(/\/settings\/users\b/);
      await usersPage.toast.expectSuccess(`${name} has been created!`);
      await assertApiUserRow(await usersPage.findRowByName(name), name, role);

      const id = await findApiUserIdByName(request, name);
      if (id !== null) createdUserIds.push(id);
    });
  }

  // ── Fleet-scoped API users ─────────────────────────────────────────────────
  test('creates API user assigned to 1 fleet (Workstations, Maintainer)', async ({
    createApiUserPage,
    usersPage,
    page,
    request,
  }) => {
    const name = `QA API 1Fleet ${stamp}`;

    await createApiUserPage.goto();
    await createApiUserPage.name.fill(name);
    await createApiUserPage.useAssignToFleets();
    await createApiUserPage.toggleFleet('Workstations');
    await createApiUserPage.selectFleetRole('Workstations', 'Maintainer');

    await createApiUserPage.submitAndDone();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByName(name);
    await assertApiUserRow(row, name, 'Maintainer');
    await expect(row).toContainText('Workstations');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  test('creates API user assigned to 2 fleets with the same role', async ({
    createApiUserPage,
    usersPage,
    request,
  }) => {
    const name = `QA API 2FleetsSame ${stamp}`;

    await createApiUserPage.goto();
    await createApiUserPage.name.fill(name);
    await createApiUserPage.useAssignToFleets();
    await createApiUserPage.toggleFleet('Workstations');
    await createApiUserPage.selectFleetRole('Workstations', 'Observer');
    await createApiUserPage.toggleFleet('QA');
    await createApiUserPage.selectFleetRole('QA', 'Observer');

    await createApiUserPage.submitAndDone();

    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByName(name);
    await assertApiUserRow(row, name, 'Observer');
    await expect(row).toContainText('2 fleets');
    await expect(row).not.toContainText('Various');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  test('creates API user assigned to 2 fleets with different roles', async ({
    createApiUserPage,
    usersPage,
    request,
  }) => {
    const name = `QA API 2FleetsDiff ${stamp}`;

    await createApiUserPage.goto();
    await createApiUserPage.name.fill(name);
    await createApiUserPage.useAssignToFleets();
    await createApiUserPage.toggleFleet('Workstations');
    await createApiUserPage.selectFleetRole('Workstations', 'Observer');
    await createApiUserPage.toggleFleet('QA');
    await createApiUserPage.selectFleetRole('QA', 'Admin');

    await createApiUserPage.submitAndDone();

    await usersPage.toast.expectSuccess(`${name} has been created!`);
    const row = await usersPage.findRowByName(name);
    await assertApiUserRow(row, name, 'Various');
    await expect(row).toContainText('2 fleets');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  // ── Specific endpoints ─────────────────────────────────────────────────────
  test('Specific API endpoints toggle reveals the endpoint selector', async ({
    createApiUserPage,
  }) => {
    await createApiUserPage.goto();
    await expect(createApiUserPage.endpointTable).toBeHidden();

    await createApiUserPage.specificEndpointsLabel.click();
    await expect(createApiUserPage.endpointTable).toBeVisible();
    await expect(createApiUserPage.endpointSearch).toBeVisible();
  });

  test('endpoint search dropdown lists matching endpoints as the user types', async ({
    createApiUserPage,
  }) => {
    await createApiUserPage.goto();
    await createApiUserPage.specificEndpointsLabel.click();

    await createApiUserPage.endpointSearch.fill('users');
    await expect(createApiUserPage.endpointSuggestionRows.first()).toBeVisible();
    await expect(
      createApiUserPage.endpointSuggestionRows.filter({ hasText: 'List users' }),
    ).toBeVisible();
  });

  test('creates API user with specific endpoints + 1 fleet', async ({
    createApiUserPage,
    usersPage,
    page,
    request,
  }) => {
    const name = `QA API Specific ${stamp}`;

    await createApiUserPage.goto();
    await createApiUserPage.name.fill(name);
    await createApiUserPage.useAssignToFleets();
    await createApiUserPage.toggleFleet('Workstations');
    await createApiUserPage.selectFleetRole('Workstations', 'Observer');

    await createApiUserPage.specificEndpointsLabel.click();
    await expect(createApiUserPage.endpointTable).toBeVisible();
    await createApiUserPage.addEndpoint('users', /List users/);
    await createApiUserPage.addEndpoint('hosts', /List hosts/);

    await createApiUserPage.submitAndDone();

    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    // Role for this user is the per-fleet "Observer" we picked.
    await assertApiUserRow(await usersPage.findRowByName(name), name, 'Observer');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  // ── API key reveal panel ───────────────────────────────────────────────────
  test('API key reveal: heading, key visible, show/hide, copy, banner, then Done', async ({
    createApiUserPage,
    usersPage,
    page,
    request,
  }) => {
    const name = `QA API Reveal ${stamp}`;

    await createApiUserPage.goto();
    await createApiUserPage.name.fill(name);
    // Defaults (Global user + All endpoints + GitOps role on premium) are
    // fine — the focus here is the post-submit ApiKeyDisplay panel.
    await createApiUserPage.submitButton.click();

    // Panel is rendered: heading is the user's name, key input is in the
    // DOM and visible, and the "note this down" banner is shown.
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(createApiUserPage.apiKeyInput).toBeVisible();
    await expect(createApiUserPage.apiKeyBanner).toContainText(/note of this API key/i);

    // Key is masked by default.
    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'password');
    await expect(createApiUserPage.showSecretButton).toBeVisible();

    // Show: input flips to type="text" and the toggle swaps.
    await createApiUserPage.showSecretButton.click();
    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'text');
    await expect(createApiUserPage.hideSecretButton).toBeVisible();

    // The revealed value is a non-trivial token. Input.value works in
    // both masked and unmasked modes — its presence here confirms the
    // panel surfaces the actual key, not a placeholder.
    const apiKey = await createApiUserPage.apiKeyInput.inputValue();
    expect(apiKey.length).toBeGreaterThan(20);

    // Hide: reverses the toggle.
    await createApiUserPage.hideSecretButton.click();
    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'password');
    await expect(createApiUserPage.showSecretButton).toBeVisible();

    // Copy doesn't crash and stays enabled. We don't parse the clipboard
    // since that requires permissions not granted on every Playwright
    // context — the affordance check is enough for the UI journey.
    await expect(createApiUserPage.copyButton).toBeEnabled();
    await createApiUserPage.copyButton.click();
    await expect(createApiUserPage.copyButton).toBeVisible();

    await createApiUserPage.doneButton.click();
    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    await assertApiUserRow(await usersPage.findRowByName(name), name, 'GitOps');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  test('activity feed shows the created-API-user entry', async ({ dashboard, request }) => {
    // API users are stamped with a server-generated email; look up the
    // one we just created via API to anchor the activity match.
    const sampleName = `QA API Observer ${stamp}-observer`;
    const id = await findApiUserIdByName(request, sampleName);
    expect(id, `Expected ${sampleName} to exist for activity-feed assertion`).not.toBeNull();
    const users = await listUsers(request, { query: sampleName });
    const target = users.find((u) => u.api_only && u.name === sampleName)!;

    await dashboard.goto();
    await dashboard.expectActivity(activityCopy.user.created({ email: target.email }));
  });
});
