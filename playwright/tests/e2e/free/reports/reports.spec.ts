/**
 * Reports (queries) CRUD lifecycle on the free tier — global scope only.
 * Each lifecycle step runs as a serial sub-test; create + edit verify
 * every field on `/reports/:id` (name, description, query) and
 * reconfirm the row + its interval in the list.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';
import type { ReportFormValues, SaveReportValues } from '@pages';

test.describe('Reports CRUD', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const reportName = `playwright-report-${stamp}`;
  const editedName = `${reportName}-edited`;
  const createSql = 'SELECT 1 AS one;';

  const created: SaveReportValues = {
    name: reportName,
    description: 'Created by Playwright',
    interval: 'Every 30 minutes',
    observersCanRun: true,
  };

  const edited: ReportFormValues = {
    name: editedName,
    description: 'Edited by Playwright',
    interval: 'Every 15 minutes',
    observersCanRun: false,
    platforms: ['Windows', 'Linux'],
    sql: 'SELECT version FROM osquery_info;',
  };

  test('create', async ({ dashboard, reportsList, reportEdit, reportDetails, request }) => {
    await dashboard.goto();
    await dashboard.navbar.goToReports();

    await reportsList.addReport();
    await reportEdit.setSql(createSql);
    await reportEdit.saveNew(created);
    await assertActivity(request, 'created_saved_query', (d) => d.query_name === reportName);

    await reportDetails.expectValues({ name: created.name, description: created.description });
    expect((await reportDetails.showQuery()).trim()).toContain(createSql.trim());

    // Click "Reports" in the navbar to exercise the UX path, then hard
    // navigate to /reports/manage so Fleet re-fetches (the React-router
    // transition from /reports/:id can leave a stale empty-state cache).
    await reportDetails.navbar.goToReports();
    await reportsList.goto();
    await reportsList.search.fill(reportName);
    const row = reportsList.table.rowWith(reportName);
    await expect(row).toBeVisible();
    const intervalCell = await reportsList.table.cellByColumn(row, 'Interval');
    await expect(intervalCell).toHaveText(created.interval);
  });

  test('run live report', async ({ reportsList, reportDetails, reportEdit, reportLive }) => {
    await reportsList.goto();
    await reportsList.openReport(reportName);
    await reportDetails.clickEdit();
    await reportEdit.clickLiveReport();
    await reportLive.waitForReady();
  });

  test('edit', async ({ reportsList, reportEdit, reportDetails, request }) => {
    await reportsList.goto();
    await reportsList.openReport(reportName);
    await reportDetails.clickEdit();
    await expect(reportEdit.nameInput).toHaveValue(reportName);

    await reportEdit.fillAll(edited);
    await reportEdit.saveExisting();
    await assertActivity(request, 'edited_saved_query', (d) => d.query_name === editedName);

    await reportEdit.backToReport();
    await reportDetails.expectValues({ name: edited.name, description: edited.description });
    expect((await reportDetails.showQuery()).trim()).toContain(edited.sql.trim());

    await reportDetails.navbar.goToReports();
    await reportsList.goto();
    await reportsList.search.fill(editedName);
    const row = reportsList.table.rowWith(editedName);
    await expect(row).toBeVisible();
    const intervalCell = await reportsList.table.cellByColumn(row, 'Interval');
    await expect(intervalCell).toHaveText(edited.interval);
  });

  test('delete', async ({ reportsList, request }) => {
    await reportsList.goto();
    await reportsList.deleteReport(editedName);

    await expect(reportsList.table.rowOrEmpty()).toBeVisible();
    await expect(reportsList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_saved_query', (d) => d.query_name === editedName);
  });

  test('activity feed shows create → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      activityCopy.report.created({ name: reportName, scope: 'All fleets' }),
      activityCopy.report.edited({ name: editedName, scope: 'All fleets' }),
      activityCopy.report.deleted({ name: editedName, scope: 'All fleets' }),
    ]);
  });
});
