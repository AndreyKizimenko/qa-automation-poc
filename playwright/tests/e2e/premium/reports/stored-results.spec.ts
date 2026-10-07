/**
 * Premium • Reports • stored results, on a long-standing report and a new one.
 *
 * What the org-wide *Store report results* setting protects: Fleet keeps each
 * host's latest answer to a report that stores data, and shows it on the report.
 * The setting itself isn't toggled here. Turning it off has no confirmation, and
 * a run that crosses Fleet's hourly cleanup with it off deletes every stored
 * result on the instance, so the suite tests what it guards instead (Andrey,
 * 2026-10-02):
 *
 *   - **A long-standing report keeps collecting.** `pw-host-report-results` is
 *     declared by gitops on the VMs fleet (`gitops/premium-fleetqa/fleets/vms.yml`:
 *     macOS, every 300 s, Store data on) and nothing in the suite deletes it, so
 *     it has been answering across nightly redeploys and upgrades. A row is not
 *     enough, since a stale one would survive collection silently stopping, so
 *     its stored result for the macOS VM must be under an hour old. Not two
 *     intervals: the report's answer never changes, and Fleet rewrites a host's
 *     stored rows only when they change. An unchanged result moves
 *     `last_fetched` only once that is 50 minutes old (fleetdm/fleet#54897), so
 *     a VM that is collecting reads up to ~56 minutes old. That unchanged-result
 *     path is what this test covers; the new report below covers the write of a
 *     changed one. (`host-report-details.spec.ts` reads the same row but not
 *     its age.)
 *   - **A new report can still store results.** Created through the UI on the
 *     VMs fleet with Store data on, it collects the macOS VM's row, read through
 *     the API and on the report page. The UI's shortest schedule is 5 minutes, so
 *     once created the report is set to 60 s through the API, which lands the
 *     first row in about a minute.
 *
 * The real macOS VM answers; a simulation's canned row would prove nothing. Its
 * scheduled reports don't use the VM's script and install queue, so this adds
 * no wait to the specs that do. The new report is named `pw-stored-results-*`,
 * deleted in an afterEach (it would keep running every 60 s), and swept from
 * the VMs fleet by `cleanup.steps.ts` after a killed run.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  deleteReport,
  findReportByName,
  getHostReportLastFetched,
  getHostReportRows,
  getReport,
  requireRealHost,
  setReportInterval,
} from '@helpers/api';
import { VMS_FLEET } from '@helpers/api/static-users';
import { runNonce } from '@helpers/profiles';

const DURABLE_REPORT = 'pw-host-report-results';

// How old a stored result's `last_fetched` gets before Fleet refreshes it for a
// result that hasn't changed (`queryResultsLastFetchedRefreshAge` in Fleet's
// server/service/query_report_writes.go).
const LAST_FETCHED_REFRESH_AGE_S = 50 * 60;

test.describe('Premium • Reports • stored results', () => {
  test.describe.configure({ retries: HOST_RETRIES });

  // The new report runs on the Mac every 60 s until it's deleted, so its
  // deletion lives here: a timed-out test skips its own `finally`, not this.
  let createdId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (createdId !== undefined) await deleteReport(request, createdId);
    createdId = undefined;
  });

  test("the long-standing gitops report holds a fresh result from the macOS VM", async ({
    dashboard,
    reportsList,
    reportDetails,
    vmsFleetId,
    request,
  }) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const ref = await findReportByName(request, DURABLE_REPORT, vmsFleetId);
    expect(ref, `${DURABLE_REPORT} is declared on the VMs fleet (gitops/premium-fleetqa/fleets/vms.yml)`).not.toBeNull();
    const report = await getReport(request, ref!.id);
    expect(report.discardData, `${DURABLE_REPORT} stores its results`).toBe(false);

    // The report's answer never changes, so Fleet moves `last_fetched` only at
    // the first run after it turns 50 minutes old, and a 1-minute cron writes
    // it. On top of the refresh age, two intervals plus a couple of minutes
    // leaves room for a run that's just due, its delivery and the cron.
    const lastFetched = await getHostReportLastFetched(request, vm.id, DURABLE_REPORT);
    expect(lastFetched, `the macOS VM has stored a result for ${DURABLE_REPORT}`).not.toBeNull();
    const ageSeconds = Math.round((Date.now() - Date.parse(lastFetched!)) / 1000);
    expect(
      ageSeconds,
      `its latest result is ${ageSeconds}s old (interval ${report.interval}s; ` +
        `Fleet refreshes an unchanged result at ${LAST_FETCHED_REFRESH_AGE_S}s)`,
    ).toBeLessThan(LAST_FETCHED_REFRESH_AGE_S + 2 * report.interval + 120);

    await dashboard.goto();
    await dashboard.navbar.goToReports();
    await reportsList.teamDropdown.selectByLabel(VMS_FLEET);
    await reportsList.searchByName(DURABLE_REPORT);
    await reportsList.openReport(DURABLE_REPORT);
    await expect(reportDetails.resultRows.filter({ hasText: vm.displayName })).toContainText('bar');
  });

  test('a report created with Store data on collects a result from the macOS VM', async ({
    dashboard,
    reportsList,
    reportEdit,
    reportDetails,
    vmsFleetId,
    request,
  }) => {
    test.setTimeout(420_000);
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const name = `pw-stored-results-${runNonce()}`;

    await dashboard.goto();
    await dashboard.navbar.goToReports();
    await reportsList.teamDropdown.selectByLabel(VMS_FLEET);
    await reportsList.addReport();
    await reportEdit.setSql(`SELECT '${name}' AS stored;`);
    const reportId = await reportEdit.saveNew({
      name,
      description: 'Playwright stored-results check',
      interval: 'Every 5 minutes',
      observersCanRun: false,
      platforms: ['macOS'],
      storeData: true,
    });
    createdId = reportId;
    expect((await getReport(request, reportId)).discardData).toBe(false);

    await setReportInterval(request, reportId, 60);
    await expect
      .poll(() => getHostReportRows(request, vm.id, reportId), {
        message: `the macOS VM never stored a row for ${name}`,
        timeout: 300_000,
        intervals: [10_000],
      })
      .toEqual([{ stored: name }]);

    await reportDetails.goto(reportId, { fleetId: vmsFleetId });
    await expect(reportDetails.resultRows.filter({ hasText: vm.displayName })).toContainText(name);
  });
});
