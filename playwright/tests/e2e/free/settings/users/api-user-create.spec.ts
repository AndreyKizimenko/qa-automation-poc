import { test, expect } from '@fixtures';
import type { APIRequestContext, Locator } from '@playwright/test';
import { deleteUser, listUsers } from '@helpers/api';
import type { ApiGlobalRole } from '@pages';

const FREE_API_ROLES: readonly ApiGlobalRole[] = ['Observer', 'Maintainer', 'Admin'];

async function findApiUserIdByName(
  request: APIRequestContext,
  name: string,
): Promise<number | null> {
  const users = await listUsers(request, { query: name });
  const match = users.find((u) => u.api_only && u.name === name);
  return match ? match.id : null;
}

/**
 * API user rows render both the user's name and an "API" pill badge in the
 * Name cell. Anchoring on the pill class gives a stronger check than
 * `row.toContainText('API')`, which would also match an `API` substring of
 * the name itself.
 */
async function assertApiUserRow(row: Locator, name: string, role: string): Promise<void> {
  await expect(row).toBeVisible();
  await expect(row.locator('.data-table__tooltip-truncated-text').first()).toHaveText(name);
  await expect(row.locator('.pill-badge')).toHaveText('API');
  // Anchored on `.role__cell` with exact text. Free has no Observer+ so
  // the collision can't fire here, but the helper stays consistent with
  // premium.
  await expect(row.locator('.role__cell')).toHaveText(role);
}

test.describe('Create API-only user (free)', { tag: '@free' }, () => {
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

  for (const role of FREE_API_ROLES) {
    test(`creates API user with role ${role}`, async ({
      createApiUserPage,
      usersPage,
      page,
      request,
    }) => {
      const slug = role.toLowerCase();
      const name = `QA API ${role} ${stamp}-${slug}`;

      await createApiUserPage.goto();
      await createApiUserPage.name.fill(name);
      // Free has no Permissions radio and no API access radio — role
      // dropdown is rendered by default.
      await createApiUserPage.selectGlobalRole(role);

      await createApiUserPage.submitAndDone();

      await expect(page).toHaveURL(/\/settings\/users\b/);
      await usersPage.toast.expectSuccess(`${name} has been created!`);
      await assertApiUserRow(usersPage.rowByName(name), name, role);

      const id = await findApiUserIdByName(request, name);
      if (id !== null) createdUserIds.push(id);
    });
  }

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
    // Default role on free is Observer (the gitops branch doesn't apply
    // on the free tier).
    await createApiUserPage.submitButton.click();

    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(createApiUserPage.apiKeyInput).toBeVisible();
    await expect(createApiUserPage.apiKeyBanner).toContainText(/note of this API key/i);

    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'password');
    await expect(createApiUserPage.showSecretButton).toBeVisible();

    await createApiUserPage.showSecretButton.click();
    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'text');
    await expect(createApiUserPage.hideSecretButton).toBeVisible();

    const apiKey = await createApiUserPage.apiKeyInput.inputValue();
    expect(apiKey.length).toBeGreaterThan(20);

    await createApiUserPage.hideSecretButton.click();
    await expect(createApiUserPage.apiKeyInput).toHaveAttribute('type', 'password');
    await expect(createApiUserPage.showSecretButton).toBeVisible();

    await expect(createApiUserPage.copyButton).toBeEnabled();
    await createApiUserPage.copyButton.click();
    await expect(createApiUserPage.copyButton).toBeVisible();

    await createApiUserPage.doneButton.click();
    await expect(page).toHaveURL(/\/settings\/users\b/);
    await usersPage.toast.expectSuccess(`${name} has been created!`);
    await assertApiUserRow(usersPage.rowByName(name), name, 'Observer');

    const id = await findApiUserIdByName(request, name);
    if (id !== null) createdUserIds.push(id);
  });

  test('activity feed shows the created-API-user entry', async ({ dashboard, request }) => {
    const sampleName = `QA API Observer ${stamp}-observer`;
    const users = await listUsers(request, { query: sampleName });
    const target = users.find((u) => u.api_only && u.name === sampleName);
    expect(target, `Expected ${sampleName} to exist for activity-feed assertion`).toBeTruthy();

    const emailRe = target!.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await dashboard.goto();
    await dashboard.expectActivity(new RegExp(`created a user\\s+${emailRe}\\.`));
  });
});
