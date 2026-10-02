/**
 * Reports (queries) CRUD lifecycle on the free tier — global scope only.
 * Each lifecycle step runs as a serial sub-test; create + edit verify
 * every field on `/reports/:id` (name, description, query, automations)
 * and reconfirm the row + its interval in the list.
 *
 * Then two standalone describes, the free twins of premium's: a report with
 * a syntax error is saved and reopened, and a new report's Save report modal
 * opens on Fleet's defaults.
 */
import { test, expect } from '@fixtures';
import { assertActivity, deleteReport, getReport, resultLogPlugin } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { activityCopy } from '@helpers/activity-copy';
import type { ReportFormValues, SaveReportValues } from '@pages';

test.describe('Reports CRUD', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const reportName = `playwright-report-${stamp}`;
  const editedName = `${reportName}-edited`;
  const createSql = 'SELECT 1 AS one;';
  let reportId: number;

  const created: SaveReportValues = {
    name: reportName,
    description: 'Created by Playwright',
    interval: 'Every 30 minutes',
    observersCanRun: true,
    automations: true,
  };

  const edited: ReportFormValues = {
    name: editedName,
    description: 'Edited by Playwright',
    interval: 'Every 15 minutes',
    observersCanRun: false,
    platforms: ['Windows', 'Linux'],
    sql: 'SELECT version FROM osquery_info;',
    automations: false,
  };

  test('create', async ({ dashboard, reportsList, reportEdit, reportDetails, request }) => {
    await dashboard.goto();
    await dashboard.navbar.goToReports();

    await reportsList.addReport();
    await reportEdit.setSql(createSql);
    reportId = await reportEdit.saveNew(created);
    await assertActivity(request, 'created_saved_query', (d) => d.query_name === reportName);

    await reportDetails.expectValues({ name: created.name, description: created.description });
    // Automations send the report's results to the log destination on its interval.
    expect((await getReport(request, reportId)).automationsEnabled).toBe(true);
    await expect(reportDetails.automationsStatus).toHaveText(/Automations:\s*On$/);
    await expect(reportDetails.logDestination).toContainText(await resultLogPlugin(request), { ignoreCase: true });
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

    await expect(reportEdit.automationsCopy).toContainText(
      `Historical results will not be sent to your log destination: ${await resultLogPlugin(request)}`,
      { ignoreCase: true },
    );
    await reportEdit.saveExisting();
    await assertActivity(request, 'edited_saved_query', (d) => d.query_name === editedName);

    // saveExisting() lands on the report details page, so assert there directly.
    await reportDetails.expectValues({ name: edited.name, description: edited.description });
    expect((await getReport(request, reportId)).automationsEnabled).toBe(false);
    await expect(reportDetails.automationsStatus).toHaveText(/Automations:\s*Off$/);
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

// Fleet lets you save a report whose SQL has a syntax error (so teams can
// intentionally capture false-positives); the editor surfaces the error
// inline without disabling Save, and the server refuses only an empty query.
test.describe('Reports — SQL validation', () => {
  let createdId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (createdId !== undefined) await deleteReport(request, createdId);
    createdId = undefined;
  });

  test('a report with a syntax error saves, and reopens with its SQL and the error', async ({ reportEdit }) => {
    const badSql = 'SELECT * FRM osquery_info;';

    await reportEdit.gotoNew();
    await reportEdit.setSql(badSql);
    await expect(reportEdit.sqlSyntaxError).toBeVisible();
    await expect(reportEdit.saveButton).toBeEnabled();

    // The parser finds no tables in broken SQL, so the Save report modal ticks
    // no platform and keeps Save disabled until one is ticked. "Never" keeps
    // the report off every host's schedule — on free, the real VMs too.
    createdId = await reportEdit.saveNew({
      name: `pw-report-bad-sql-${runNonce()}`,
      description: '',
      interval: 'Never',
      observersCanRun: false,
      platforms: ['macOS'],
    });

    // A fresh load shows Fleet's default query until the report arrives.
    await reportEdit.gotoEdit(createdId);
    await expect.poll(() => reportEdit.sqlText()).toBe(badSql);
    await expect(reportEdit.sqlSyntaxError).toBeVisible();
  });
});

// A brand-new report's Save report modal opens on Fleet's defaults: every
// platform, hourly, observers can't run it, automations off. Nothing is saved.
test.describe('Reports — new-report defaults', () => {
  test('starts from the default osquery_info query, and the Save report modal from its defaults', async ({
    reportEdit,
  }) => {
    await reportEdit.gotoNew();
    expect(await reportEdit.sqlText()).toContain('SELECT * FROM osquery_info');
    await expect(reportEdit.saveButton).toBeEnabled();

    await reportEdit.saveButton.click();
    await expect(reportEdit.saveNewModal).toBeVisible();
    expect(await reportEdit.checkedPlatforms()).toEqual(['macOS', 'Windows', 'Linux', 'ChromeOS']);
    await expect(reportEdit.saveNewIntervalValueLabel).toHaveText('Every hour');
    await expect(reportEdit.saveNewObserversCheckbox).not.toBeChecked();
    await expect(reportEdit.saveNewAutomationsSwitch).toHaveAttribute('aria-checked', 'false');
    await reportEdit.saveNewCancelButton.click();
    await expect(reportEdit.saveNewModal).toBeHidden();
  });
});
