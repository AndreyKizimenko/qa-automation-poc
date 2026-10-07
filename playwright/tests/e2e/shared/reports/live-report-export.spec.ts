/**
 * Shared • Reports • A report run live against the three real VMs, its results
 * exported to CSV.
 *
 * Reports → the report → Live report → target the macOS, Windows and Linux VMs by
 * host search → Run → "Report finished" → each VM's row carries the value its own
 * osquery returned → "Export results" downloads a CSV holding exactly those rows.
 *
 * **Why the real VMs.** The query reads `os_version.platform`, so each VM answers
 * with its own platform, which the test checks against what Fleet has recorded for
 * that host. The osquery-perf simulations answer every live query with the same
 * canned row whatever the SQL, so a run against them proves nothing about the
 * results it shows or exports.
 *
 * **Why not "All hosts".** The flow this replaces ran on All hosts, which on both
 * tiers is ~300 simulations beside the three VMs. A simulation that drops offline
 * mid-run keeps it from finishing, and their canned rows don't carry the query's
 * columns. The three VMs give a run that finishes, and a CSV whose every row is
 * known.
 *
 * **Why host search, not a chip.** The built-in Platforms labels hold whatever
 * osquery-perf answers, and the VMs fleet's chip can include simulations other
 * specs borrow onto it. The picker must read "3 hosts targeted (100% online)"
 * before Run, so an offline VM fails here with its own message rather than as a
 * missing row.
 *
 * The export's file name is "<report name> - Results (MM-dd-yy hh-mm-ss).csv" in
 * the browser's local time, and its first column is `host_display_name`: the
 * results table's Host column is the same field, renamed.
 *
 * The report is global, never scheduled, and deleted in an `afterEach`, which still
 * runs when the test times out; cleanup wipes global reports anyway. A live run ends
 * only once every online targeted host has answered, so the wait for it is bounded.
 *
 * Tier-agnostic: free and premium render the same picker, results and export.
 * Round 1 C4 #F2 and C4 #P8.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching, getHostPlatform, requireRealHost } from '@helpers/api';
import { readCsvDownload } from '@helpers/csv';
import { runNonce } from '@helpers/profiles';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Reports • run live on the real VMs', () => {
  let reportName = '';

  test.afterEach(async ({ request }) => {
    if (reportName) await deleteReportsMatching(request, reportName);
    reportName = '';
  });

  test("returns each VM's own answer and exports exactly those rows to CSV", async ({
    dashboard,
    reportsList,
    reportDetails,
    reportLive,
    request,
    page,
  }) => {
    // Three hosts answer on their distributed interval; the bound covers a VM
    // that checks in late, and the cleanup still has time to run after it.
    test.setTimeout(240_000);

    const vms = await Promise.all([
      requireRealHost(request, 'darwin'),
      requireRealHost(request, 'windows'),
      requireRealHost(request, 'linux'),
    ]);
    // What each VM's osquery will answer, as Fleet already recorded it.
    const expected = new Map(
      await Promise.all(vms.map(async (vm) => [vm.displayName, await getHostPlatform(request, vm.id)] as const)),
    );

    reportName = `pw-live-report-${runNonce()}`;
    const report = await createReport(request, { name: reportName, query: 'SELECT platform FROM os_version;' });

    await test.step('open the report and target the three VMs', async () => {
      await dashboard.goto();
      await dashboard.navbar.goToReports();
      await reportsList.teamDropdown.select('All fleets');
      await reportsList.narrowTo(reportName);
      await reportsList.openReport(reportName);
      await reportDetails.clickLiveReport();
      await expect(page).toHaveURL(new RegExp(`/reports/${report.id}/live`));

      await reportLive.waitForReady();
      for (const vm of vms) await reportLive.targetHost(vm.displayName);
      await expect(reportLive.targetRows).toHaveCount(3);
      await expect(reportLive.targetsTotalCount).toHaveText(/^3\s*hosts targeted\s*\(100%\s*online\)/);
    });

    await test.step("run it until every VM has answered with its own platform", async () => {
      await reportLive.run();
      await expect(reportLive.finishedHeading).toBeVisible({ timeout: 150_000 });
      await expect(reportLive.runSummary).toContainText('3 hosts targeted');
      await expect(reportLive.runSummary).toContainText('100% responded');
      await expect(reportLive.resultsCount).toHaveText('3 results');

      const hosts = await reportLive.resultsColumnValues('Host');
      const platforms = await reportLive.resultsColumnValues('platform');
      expect(new Map(hosts.map((h, i) => [h, platforms[i]]))).toEqual(expected);
    });

    await test.step('Export results writes exactly those rows', async () => {
      const download = await reportLive.exportResults();
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`^${escapeRegExp(reportName)} - Results \\(\\d{2}-\\d{2}-\\d{2} \\d{2}-\\d{2}-\\d{2}\\)\\.csv$`),
      );
      const { header, records } = await readCsvDownload(download);
      expect(header).toEqual(['host_display_name', 'platform']);
      expect(new Map(records.map((r) => [r.host_display_name, r.platform]))).toEqual(expected);
    });
  });
});
