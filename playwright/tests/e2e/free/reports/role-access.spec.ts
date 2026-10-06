/**
 * Free • Reports • what each role is shown — the free half of
 * `premium/reports/role-access.spec.ts` (round 1 C4 #F3), for the two non-admin
 * roles free has. Free has no fleets, so there's no picker, no inherited row and
 * no Fleet field in Save as new.
 *
 *   - global maintainer: "Add report", a row checkbox, Edit report and Live
 *     report; Save as new asks only for a name.
 *   - global observer: no header button, no checkbox; on a report without
 *     "Observers can run" neither Edit report nor Live report, and `/reports/new`
 *     is the 403 page. On one with it, Live report — and the run goes through:
 *     the UI sends the report's id, since Fleet refuses ad-hoc SQL from an
 *     observer.
 *
 * Grounded in `ManageQueriesPage`, `QueryDetailsPage` and the router's
 * `AuthAnyMaintainerAdminObserverPlusRoutes`. The run targets one online
 * simulation by name: on free the real VMs share Unassigned with them, so never
 * All hosts or a platform. Reports are this spec's own, deleted in an
 * `afterEach`.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { createReport, deleteReportsMatching, findOnlineHost } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { AccessDenied, ReportDetailsPage, ReportEditPage, ReportLivePage, ReportsListPage } from '@pages';

let markers: string[] = [];

test.afterEach(async ({ request }) => {
  for (const marker of markers) await deleteReportsMatching(request, marker);
  markers = [];
});

test.describe('Free • Reports • role access', () => {
  test('global-maintainer is shown the report controls its role grants', async ({ browser, request }) => {
    const name = `pw-role-rep-gm-${runNonce()}`;
    markers.push(name);
    await createReport(request, { name, interval: 3600 });

    await withStaticUser(browser, 'global-maintainer', async (page) => {
      const list = new ReportsListPage(page);
      const details = new ReportDetailsPage(page);
      const edit = new ReportEditPage(page);
      await list.goto();

      const row = await list.narrowTo(name);
      await expect(row.getByRole('checkbox')).toHaveCount(1);
      await expect(list.addReportButton).toBeVisible();
      await expect(list.manageAutomationsButton).toHaveCount(0);

      await list.openReport(name);
      await expect(details.nameHeading).toContainText(name);
      await expect(details.liveReportButton).toBeVisible();
      await details.clickEdit();
      await expect(edit.nameInput).toHaveValue(name);
      await edit.openSaveAsNew();
      await expect(edit.saveAsNewNameInput).toBeVisible();
      await expect(edit.saveAsNewFleetDropdown.trigger).toHaveCount(0);
      await edit.saveAsNewCancelButton.click();
      await expect(edit.saveAsNewModal).toBeHidden();
    });
  });

  test('global-observer is shown the report controls its role grants', async ({ browser, request }) => {
    const name = `pw-role-rep-go-${runNonce()}`;
    markers.push(name);
    await createReport(request, { name, interval: 3600 });

    await withStaticUser(browser, 'global-observer', async (page) => {
      const list = new ReportsListPage(page);
      const details = new ReportDetailsPage(page);
      await list.goto();

      const row = await list.narrowTo(name);
      await expect(row.getByRole('checkbox')).toHaveCount(0);
      await expect(list.addReportButton).toHaveCount(0);
      await expect(list.liveReportButton).toHaveCount(0);
      await expect(list.manageAutomationsButton).toHaveCount(0);

      await list.openReport(name);
      await expect(details.nameHeading).toContainText(name);
      await expect(details.showQueryButton).toBeVisible();
      await expect(details.editButton).toHaveCount(0);
      await expect(details.liveReportButton).toHaveCount(0);

      await new AccessDenied(page).expectAt('/reports/new');
    });
  });

  test('global-observer runs a report observers can run, live, on one host', async ({ browser, request }) => {
    // Fleet's rest period bounds the run, not the host.
    test.setTimeout(180_000);
    const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
    expect(host, 'no online Linux simulation to target').not.toBeNull();
    const name = `pw-role-rep-run-${runNonce()}`;
    markers.push(name);
    await createReport(request, { name, query: "SELECT 'pw' AS role;", observerCanRun: true });

    await withStaticUser(browser, 'global-observer', async (page) => {
      const list = new ReportsListPage(page);
      const details = new ReportDetailsPage(page);
      const live = new ReportLivePage(page);
      await list.goto();
      await list.narrowTo(name);
      await list.openReport(name);
      await expect(details.editButton).toHaveCount(0);
      await details.clickLiveReport();
      await live.waitForReady();
      await live.targetHost(host!.displayName);
      await live.run();
      await expect(live.finishedHeading).toBeVisible({ timeout: 90_000 });
      await expect(live.runSummary).toContainText('1 host targeted');
      await expect(live.runSummary).toContainText('100% responded');
    });
  });
});
