/**
 * Reports (queries) CRUD lifecycle scoped to a specific fleet on premium.
 * Each scope runs as a serial describe with one sub-test per lifecycle
 * step (create → run → edit → delete) plus a final activity-feed
 * assertion.
 *
 * Coverage per scope (in order):
 *  - create : add report → set SQL → modal save with name/description/
 *             interval/observers → verify on /reports/:id + Show query
 *             SQL → verify row in list with correct interval
 *  - run    : list → open report → details → click Edit → click Live
 *             report → wait for ready
 *  - edit   : list → open report → details → click Edit → change every
 *             editable field + SQL → confirm modal → Back to report →
 *             verify on details + Show query SQL → verify renamed row
 *             in list with the new interval
 *  - delete : bulk delete by name + activity assertion
 *  - feed   : dashboard activity feed shows create/edit/delete entries
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
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

    // Intervals chosen so both the dropdown label and the table label
    // match 1:1 ("Every 30 minutes" → "Every 30 minutes"). Avoid "Every
    // hour" which renders as "Every 1 hour" in the table.
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

    test('create', async ({ dashboard, reportsList, reportEdit, reportDetails, request, workstationsFleetId }) => {
      await dashboard.goto();
      await dashboard.navbar.goToReports();
      await reportsList.teamDropdown.select(scope);

      await reportsList.addReport();
      await reportEdit.setSql(createSql);
      await reportEdit.saveNew(created);
      await assertActivity(request, 'created_saved_query', (d) => d.query_name === reportName);

      // saveNew lands us on /reports/:id — verify name + description +
      // SQL match what went through the modal.
      await reportDetails.expectValues({ name: created.name, description: created.description });
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
      // User flow: list → click report → details → click Edit → click Live report.
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
      await reportEdit.saveExisting();
      await assertActivity(request, 'edited_saved_query', (d) => d.query_name === editedName);

      // Back to report → verify on details + Show query SQL.
      await reportEdit.backToReport();
      await reportDetails.expectValues({ name: edited.name, description: edited.description });
      expect((await reportDetails.showQuery()).trim()).toContain(edited.sql.trim());

      // Navbar → list → search for the new name → confirm row + interval.
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
      const suffix = scope === 'All fleets' ? 'globally' : `on the ${scope} fleet`;
      await dashboard.expectActivities([
        new RegExp(`created a report ${reportName} ${suffix}\\.`),
        new RegExp(`edited the report ${editedName} ${suffix}\\.`),
        new RegExp(`deleted the report ${editedName} ${suffix}\\.`),
      ]);
    });
  });
}
