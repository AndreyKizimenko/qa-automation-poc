import { test, expect } from '@fixtures';

test.describe('Users page navigation and layout', { tag: '@free' }, () => {
  test('user menu → Users renders the list and page chrome', async ({ dashboard, usersPage, page }) => {
    await dashboard.goto();
    await dashboard.navbar.openUserMenu();
    await dashboard.navbar.usersItem.click();
    await expect(page).toHaveURL(/\/settings\/users\b/);

    await expect(usersPage.addUserButton).toBeVisible();
    await expect(usersPage.search).toBeVisible();
    await expect(usersPage.table.firstRow).toBeVisible();
  });

  test('first-page rows expose name, role, status, and Actions', async ({ usersPage }) => {
    await usersPage.goto();

    const rows = usersPage.table.table.locator('tbody').getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await usersPage.table.cellByColumn(row, 'Name');
      const role = await usersPage.table.cellByColumn(row, 'Role');
      const status = await usersPage.table.cellByColumn(row, 'Status');

      await expect(name).not.toBeEmpty();
      await expect(role).not.toBeEmpty();
      await expect(status).not.toBeEmpty();
      await expect(row.locator('.actions-dropdown__wrapper')).toBeVisible();
    }
  });

  test('Add user dropdown exposes Regular user and API-only user options', async ({ usersPage, page }) => {
    await usersPage.goto();
    await usersPage.addUserButton.click();

    await expect(usersPage.dropdownOption('Regular user')).toBeVisible();
    await expect(usersPage.dropdownOption('API-only user')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('current admin cannot delete themselves', async ({ usersPage }) => {
    await usersPage.goto();

    const adminEmail = process.env.FLEET_ADMIN_EMAIL ?? '';
    expect(adminEmail, 'FLEET_ADMIN_EMAIL must be set').not.toBe('');

    // Search-filter to the admin so the row is in view regardless of how
    // many other users (test or otherwise) live on the instance.
    await usersPage.search.fill(adminEmail);
    const adminRow = usersPage.rowByEmail(adminEmail);
    await expect(adminRow).toBeVisible();

    await adminRow.locator('.actions-dropdown__wrapper').click();

    const deleteOption = usersPage.dropdownOption('Delete');
    await expect(deleteOption).toBeVisible();
    await expect(deleteOption).toHaveAttribute('aria-disabled', 'true');
  });
});
