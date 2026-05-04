/**
 * Reports CRUD lifecycle (UI-only) on the smoke fleet.
 *
 * One end-to-end flow per test run: create a new report, navigate back
 * into edit mode, change the name + SQL, exercise the "Save changes?"
 * confirmation modal, verify the live-report page renders, then delete
 * the report from the list and confirm it's gone.
 *
 * Each run uses a timestamped name so retries against a non-fresh fleet
 * don't collide on a leftover report.
 */
import { test, expect } from '@fixtures';

test('Reports — create → edit → run → delete', async ({
  dashboard,
  reportsList,
  reportEdit,
  reportLive,
  softwareFleet,
}) => {
  const stamp = Date.now();
  const reportName = `playwright-report-${stamp}`;
  const editedName = `${reportName}-edited`;
  const sql = 'SELECT 1 AS one;';
  const editedSql = 'SELECT version FROM osquery_info;';

  await dashboard.goto({ fleetId: softwareFleet.id });
  await dashboard.navbar.goToReports();

  await reportsList.addReport();
  await reportEdit.setSql(sql);
  const reportId = await reportEdit.saveNew(reportName);

  await reportEdit.gotoEdit(reportId, { fleetId: softwareFleet.id });
  await expect(reportEdit.nameInput).toHaveValue(reportName);
  await reportEdit.nameInput.fill(editedName);
  await reportEdit.setSql(editedSql);
  await reportEdit.saveExisting();

  await reportEdit.gotoEdit(reportId, { fleetId: softwareFleet.id });
  await expect(reportEdit.nameInput).toHaveValue(editedName);
  expect(await reportEdit.sqlText()).toContain('osquery_info');

  await reportEdit.clickLiveReport();
  await reportLive.waitForReady();

  await reportsList.goto({ fleetId: softwareFleet.id });
  await reportsList.deleteReport(editedName);

  await reportsList.search.fill(editedName);
  await expect(reportsList.table.rowOrEmpty()).toBeVisible();
  await expect(reportsList.table.rowWith(editedName)).toHaveCount(0);
});
