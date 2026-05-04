import { test, expect } from '@fixtures';

test.describe('Update flow', () => {
  test('dashboard loads after upgrade', async ({ dashboard, page }) => {
    await dashboard.goto();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('hosts page is accessible and lists hosts', async ({ hostsList, page }) => {
    await hostsList.goto();
    await expect(page).toHaveURL(/\/hosts\/manage/);
    await expect(hostsList.table.rowOrEmpty()).toBeVisible();
  });

  test('controls page is accessible', async ({ controls, page }) => {
    await controls.goto();
    await expect(page).toHaveURL(/\/controls/);
    await expect(controls.osUpdatesTab).toBeVisible();
  });

  test('reports page is accessible', async ({ reportsList, page }) => {
    await reportsList.goto();
    await expect(page).toHaveURL(/\/reports|\/queries/);
    await expect(reportsList.table.rowOrEmpty()).toBeVisible();
  });

  test('policies page is accessible', async ({ policiesList, page }) => {
    await policiesList.goto();
    await expect(page).toHaveURL(/\/policies/);
    await expect(policiesList.table.rowOrEmpty()).toBeVisible();
  });

  test('settings page is accessible', async ({ page }) => {
    await page.goto('/settings/organization/info');
    await expect(page).toHaveURL(/\/settings/);
    // Settings subpages use h2 headings ("Organization info" is h2, the h1 is just "Settings")
    await expect(page.getByRole('heading', { name: /organization/i })).toBeVisible();
  });

  test('previously created hosts still exist after upgrade', async ({ hostsList }) => {
    await hostsList.goto();
    await expect(hostsList.table.firstRow).toBeVisible({ timeout: 10_000 });
  });

  test('previously created reports still exist after upgrade', async ({ reportsList }) => {
    await reportsList.goto();
    await expect(reportsList.table.firstRow).toBeVisible({ timeout: 10_000 });
  });
});
