import { test, expect } from '@fixtures';
import { measureNav, measureSearch } from '@helpers/perf';

test.describe('Reports load times', () => {
  // ── All fleets ──────────────────────────────────────────────────────────────
  test('All fleets', { tag: '@loadtest' }, async ({ reportsList, page }, testInfo) => {
    await measureNav(page, testInfo, 'All fleets', async () => {
      await reportsList.goto();
    });
  });

  test('All fleets - platform filter', { tag: '@loadtest' }, async ({ reportsList, page }, testInfo) => {
    await measureNav(page, testInfo, 'All fleets - platform filter', async () => {
      await reportsList.goto({ platform: 'darwin' });
    });
  });

  test('All fleets - search', { tag: '@loadtest' }, async ({ reportsList, page }, testInfo) => {
    await reportsList.goto();
    const reportName = await reportsList.firstReportName();

    await measureSearch(
      page, testInfo, 'All fleets - search',
      reportsList.search, reportName,
      async () => { await expect(reportsList.table.rowWith(reportName).first()).toBeVisible(); },
    );
  });

  // ── Loadtest team ───────────────────────────────────────────────────────────
  test('Team page', { tag: '@loadtest' }, async ({ reportsList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Team page', async () => {
      await reportsList.goto({ fleetId: loadtestFleetId });
      await expect(reportsList.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Team - platform filter', { tag: '@loadtest' }, async ({ reportsList, loadtestFleetId, page }, testInfo) => {
    await reportsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Team - platform filter', async () => {
      await reportsList.applyPlatformFilter('darwin');
    });
  });

  test('Team - search', { tag: '@loadtest' }, async ({ reportsList, loadtestFleetId, page }, testInfo) => {
    await reportsList.goto({ fleetId: loadtestFleetId });

    const reportName = await reportsList.firstReportName();

    await measureNav(page, testInfo, 'Team - search', async () => {
      await reportsList.search.fill(reportName);
      await expect(reportsList.table.rowWith(reportName).first()).toBeVisible();
    });
  });
});
