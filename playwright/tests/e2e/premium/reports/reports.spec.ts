/**
 * Reports (queries) CRUD lifecycle scoped to a specific fleet on premium.
 * Each scope runs as a serial describe with one sub-test per lifecycle
 * step (create → run → edit → delete) plus a final activity-feed
 * assertion.
 */
import { test, expect } from '@fixtures';
import { assertActivity, createReport, deleteReport, getReport, resultLogPlugin } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { VMS_FLEET } from '@helpers/api/static-users';
import { activityCopy } from '@helpers/activity-copy';
import { fleetIdFor } from '@helpers/team-scope';
import type { ReportFormValues, SaveReportValues, TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['All fleets', 'Workstations'];

for (const scope of SCOPES) {
  const slug = scope.replace(/\s+/g, '-').toLowerCase();

  test.describe(`Reports CRUD (${scope})`, () => {
    test.describe.configure({ mode: 'serial' });

    const stamp = Date.now();
    const reportName = `playwright-report-${slug}-${stamp}`;
    const editedName = `${reportName}-edited`;
    const createSql = 'SELECT 1 AS one;';
    let reportId: number;

    // Intervals chosen so both the dropdown label and the table label
    // match 1:1 ("Every 30 minutes" → "Every 30 minutes"). Avoid "Every
    // hour" which renders as "Every 1 hour" in the table.
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

    test('create', async ({ dashboard, reportsList, reportEdit, reportDetails, request, workstationsFleetId }) => {
      await dashboard.goto();
      await dashboard.navbar.goToReports();
      await reportsList.teamDropdown.select(scope);

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

      // Click "Reports" in the navbar to exercise that UX path, then hard
      // navigate to /reports/manage with the scope's fleet_id. Fleet's
      // React-router transition from /reports/:id back to /reports/manage
      // doesn't re-fetch the list when the URL fleet_id doesn't change,
      // so for "All fleets" the just-created report can be absent from a
      // stale view. A hard goto forces a fresh fetch.
      await reportDetails.navbar.goToReports();
      await reportsList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await reportsList.teamDropdown.select(scope);
      await reportsList.search.fill(reportName);
      const row = reportsList.table.rowWith(reportName);
      await expect(row).toBeVisible();
      const intervalCell = await reportsList.table.cellByColumn(row, 'Interval');
      await expect(intervalCell).toHaveText(created.interval);
    });

    test('run live report', async ({ reportsList, reportDetails, reportEdit, reportLive, workstationsFleetId }) => {
      await reportsList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await reportsList.teamDropdown.select(scope);
      await reportsList.openReport(reportName);
      await reportDetails.clickEdit();
      await reportEdit.clickLiveReport();
      await reportLive.waitForReady();
    });

    test('edit', async ({ reportsList, reportEdit, reportDetails, request, workstationsFleetId }) => {
      await reportsList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await reportsList.teamDropdown.select(scope);
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
      await reportsList.teamDropdown.select(scope);
      await reportsList.search.fill(editedName);
      const row = reportsList.table.rowWith(editedName);
      await expect(row).toBeVisible();
      const intervalCell = await reportsList.table.cellByColumn(row, 'Interval');
      await expect(intervalCell).toHaveText(edited.interval);
    });

    test('delete', async ({ reportsList, request, workstationsFleetId }) => {
      await reportsList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await reportsList.teamDropdown.select(scope);
      await reportsList.deleteReport(editedName);

      await expect(reportsList.table.rowOrEmpty()).toBeVisible();
      await expect(reportsList.table.rowWith(editedName)).toHaveCount(0);
      await assertActivity(request, 'deleted_saved_query', (d) => d.query_name === editedName);
    });

    test('activity feed shows create → edit → delete', async ({ dashboard }) => {
      await dashboard.goto();
      await dashboard.expectActivities([
        activityCopy.report.created({ name: reportName, scope }),
        activityCopy.report.edited({ name: editedName, scope }),
        activityCopy.report.deleted({ name: editedName, scope }),
      ]);
    });
  });
}

// Fleet lets you save a report whose SQL has a syntax error (so teams can
// intentionally capture false-positives); the editor surfaces the error
// inline without disabling Save, and the server refuses only an empty query.
// Its own report, outside the scoped CRUD lifecycle above.
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
    // the report off every host's schedule.
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

// Premium's live-report picker offers fleets alongside platforms and labels.
// Selecting one is what turns the run on: "Run" is disabled until something is
// targeted, and the targeted-host summary appears only once it is. Nothing is
// run here — the report is created and deleted over the API in the same test,
// so the only thing left behind is the UI state of a page that isn't persisted.
test.describe('Reports — live report targets', () => {
  test('selecting a fleet targets its hosts and enables Run', async ({
    reportsList,
    reportDetails,
    reportEdit,
    reportLive,
    request,
    vmsFleetId,
  }) => {
    // The fleet that owns the real QA VMs: it is the one fleet guaranteed to
    // hold hosts, so "N hosts targeted" has something to count. The worker
    // fixture resolves it by name through the API, so a rename fails here with
    // that message instead of surfacing later as a chip-not-found timeout.
    expect(vmsFleetId, 'the VMs fleet must exist for the target picker to count hosts').toBeGreaterThan(0);
    const fleet = VMS_FLEET;
    const report = await createReport(request, {
      name: `playwright-live-targets-${Date.now()}`,
      query: 'SELECT 1 AS one;',
    });

    try {
      await reportsList.goto();
      await reportsList.teamDropdown.select('All fleets');
      await reportsList.searchByName(report.name);
      await reportsList.openReport(report.name);
      await reportDetails.clickEdit();
      await reportEdit.clickLiveReport();
      await reportLive.waitForReady();

      await expect(reportLive.runButton).toBeDisabled();
      await expect(reportLive.targetsTotalCount).toBeEmpty();

      await reportLive.toggleTarget(fleet, true);
      // The summary joins its parts with non-breaking spaces, so the match has
      // to be whitespace-class rather than a literal space.
      await expect(reportLive.targetsTotalCount).toContainText(/\d+\s*hosts?\s*targeted/);
      await expect(reportLive.runButton).toBeEnabled();

      // Deselecting returns the picker to its empty state, which is what
      // proves the count came from this fleet and not from a default.
      await reportLive.toggleTarget(fleet, false);
      await expect(reportLive.targetsTotalCount).toBeEmpty();
      await expect(reportLive.runButton).toBeDisabled();
    } finally {
      await deleteReport(request, report.id);
    }
  });
});

// A brand-new report starts from Fleet's DEFAULT_QUERY (SELECT * FROM
// osquery_info) with Save enabled — the ready-to-save default state — and its
// Save report modal opens on Fleet's defaults: every platform, hourly,
// observers can't run it, automations off. Nothing is saved.
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
