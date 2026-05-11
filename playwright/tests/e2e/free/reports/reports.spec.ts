/**
 * Reports (queries) CRUD lifecycle on the free tier.
 *
 * Free has no team dropdown — reports always live in the global scope. The
 * flow mirrors the premium variant but skips the scope selection step.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';

test.describe('Reports', { tag: '@free' }, () => {
  test('create → edit → run → delete', async ({
    dashboard,
    reportsList,
    reportEdit,
    reportLive,
    request,
  }) => {
    const stamp = Date.now();
    const reportName = `playwright-report-${stamp}`;
    const editedName = `${reportName}-edited`;
    const sql = 'SELECT 1 AS one;';
    const editedSql = 'SELECT version FROM osquery_info;';

    await dashboard.goto();
    await dashboard.navbar.goToReports();

    await reportsList.addReport();
    await reportEdit.setSql(sql);
    const reportId = await reportEdit.saveNew(reportName);
    await assertActivity(request, 'created_saved_query', (d) => d.query_name === reportName);

    await reportEdit.gotoEdit(reportId);
    await expect(reportEdit.nameInput).toHaveValue(reportName);
    await reportEdit.nameInput.fill(editedName);
    await reportEdit.setSql(editedSql);
    await reportEdit.saveExisting();
    await assertActivity(request, 'edited_saved_query', (d) => d.query_name === editedName);

    await reportEdit.gotoEdit(reportId);
    await expect(reportEdit.nameInput).toHaveValue(editedName);
    expect(await reportEdit.sqlText()).toContain('osquery_info');

    await reportEdit.clickLiveReport();
    await reportLive.waitForReady();

    await reportsList.goto();
    await reportsList.deleteReport(editedName);

    await expect(reportsList.table.rowOrEmpty()).toBeVisible();
    await expect(reportsList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_saved_query', (d) => d.query_name === editedName);
  });
});
