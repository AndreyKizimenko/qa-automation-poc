import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Policies load times', () => {
  // ── All fleets ──────────────────────────────────────────────────────────────
  test('All fleets', async ({ policiesList, page }, testInfo) => {
    await measureNav(page, testInfo, 'All fleets', async () => {
      await policiesList.goto();
    });
  });

  test('All fleets - Other automation filter', async ({ policiesList, page }, testInfo) => {
    await measureNav(page, testInfo, 'All fleets - Other filter', async () => {
      await policiesList.goto({ automationType: 'other' });
    });
  });

  // ── Loadtest team ───────────────────────────────────────────────────────────
  test('Team page', async ({ policiesList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Team page', async () => {
      await policiesList.goto({ fleetId: loadtestFleetId });
      await expect(policiesList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Team - Software automation filter', async ({ policiesList, loadtestFleetId, page }, testInfo) => {
    await policiesList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Team - Software filter', async () => {
      await policiesList.applyAutomationFilter('software');
    });
  });
});
