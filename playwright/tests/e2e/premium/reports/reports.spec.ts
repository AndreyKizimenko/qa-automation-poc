/**
 * Reports (queries) CRUD lifecycle scoped to a specific fleet on premium.
 *
 * Runs once per scope (All fleets + Workstations). The flow is identical
 * apart from the dropdown selection; the loop keeps the file short without
 * hiding the per-test behaviour.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import type { TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['All fleets', 'Workstations'];

for (const scope of SCOPES) {
  const slug = scope.replace(/\s+/g, '-').toLowerCase();

  test(`Reports — create → edit → run → delete (${scope})`, async ({
    dashboard,
    reportsList,
    reportEdit,
    reportLive,
    request,
  }) => {
    const stamp = Date.now();
    const reportName = `playwright-report-${slug}-${stamp}`;
    const editedName = `${reportName}-edited`;
    const sql = 'SELECT 1 AS one;';
    const editedSql = 'SELECT version FROM osquery_info;';

    await dashboard.goto();
    await dashboard.navbar.goToReports();
    await reportsList.teamDropdown.select(scope);

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
    await reportsList.teamDropdown.select(scope);
    await reportsList.deleteReport(editedName);

    // The list may go empty after delete; rowOrEmpty() handles both states
    // and rowWith() returns 0 either way.
    await expect(reportsList.table.rowOrEmpty()).toBeVisible();
    await expect(reportsList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_saved_query', (d) => d.query_name === editedName);
  });
}
