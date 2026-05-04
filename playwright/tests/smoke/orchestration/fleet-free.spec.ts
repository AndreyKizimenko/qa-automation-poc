import { test, expect } from '@fixtures';
import { authHeaders } from '@helpers/api';
import { monitorConsoleErrors } from '@helpers/console';

test.describe('Fleet Free', { tag: '@free' }, () => {
  test.describe('Free features work correctly', () => {
    test('dashboard loads on Fleet Free', async ({ dashboard, page }) => {
      await dashboard.goto();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('hosts page is accessible', async ({ hostsList, page }) => {
      await hostsList.goto();
      await expect(page).toHaveURL(/\/hosts\/manage/);
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });

    test('reports page is accessible', async ({ reportsList, page }) => {
      await reportsList.goto();
      await expect(page).toHaveURL(/\/reports/);
      await expect(reportsList.table.rowOrEmpty()).toBeVisible();
    });

    test('policies page is accessible', async ({ policiesList, page }) => {
      await policiesList.goto();
      await expect(page).toHaveURL(/\/policies/);
      await expect(policiesList.table.rowOrEmpty()).toBeVisible();
    });

    test('packs page is accessible on Fleet Free', async ({ page }) => {
      await page.goto('/packs/manage');
      await expect(page).toHaveURL(/\/packs/);
      await expect(page.getByRole('heading', { name: /packs/i })).toBeVisible();
    });

    test('settings page is accessible on Fleet Free', async ({ page }) => {
      await page.goto('/settings/organization/info');
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByRole('heading', { name: /organization/i })).toBeVisible();
    });
  });

  test.describe('Premium features are restricted', () => {
    test('IdP/SCIM settings are not available on Fleet Free', async ({ page }) => {
      await page.goto('/settings/integrations');
      await expect(page.getByText(/SCIM/i)).toBeHidden();
    });
  });

  test.describe('GitOps works on Fleet Free', () => {
    test('can read config via API on Fleet Free', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      await expect(response).toBeOK();
      const config = await response.json();
      expect(config.org_info).toBeDefined();
    });

    test('can list policies via API on Fleet Free', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/policies', { headers: authHeaders() });
      await expect(response).toBeOK();
    });

    test('can list reports via API on Fleet Free', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/queries', { headers: authHeaders() });
      await expect(response).toBeOK();
    });
  });

  test.describe('No errors on free-only workflows', () => {
    // networkidle is used here as a completeness wait for error sampling:
    // we want to observe ALL console activity during page load, not stop at
    // a ready signal. The page object's goto() already asserts readiness.
    test('no console errors on dashboard', async ({ dashboard, page }) => {
      const errors = monitorConsoleErrors(page);
      await dashboard.goto();
      // eslint-disable-next-line playwright/no-networkidle
      await page.waitForLoadState('networkidle');
      expect(errors.getErrors()).toEqual([]);
    });

    test('no console errors on hosts page', async ({ hostsList, page }) => {
      const errors = monitorConsoleErrors(page);
      await hostsList.goto();
      // eslint-disable-next-line playwright/no-networkidle
      await page.waitForLoadState('networkidle');
      expect(errors.getErrors()).toEqual([]);
    });
  });
});
