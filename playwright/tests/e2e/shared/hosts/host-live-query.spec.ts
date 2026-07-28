/**
 * Shared • Hosts • Run a live report against a single host.
 *
 * Host Actions → Live report → "Select a report" modal → pick a saved report →
 * the report's edit screen carrying the host as the target → Live report → Run →
 * "Report finished" with the host having responded.
 *
 * The spec seeds its own uniquely-named report via the API and deletes it, so it
 * stays isolated from siblings running in parallel. Identical on both tiers, so
 * it runs shared. C2 #1/#3/#8/#11/#13/#20.
 *
 * Runs against the real macOS VM (`liveMacosHost`): a real host runs the query's
 * actual SQL, so the run's results can be asserted on directly. The osquery-perf
 * simulations cannot back this — they ignore the SQL, answer with a fixed row,
 * and return no rows at all for a fraction of runs.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching } from '@helpers/api';

const rand = () => Math.random().toString(36).slice(2, 8);

test('Host details — runs a saved report live against the host', async ({
  hostDetails,
  reportEdit,
  reportLive,
  liveMacosHost,
  request,
  page,
}) => {
  const marker = `pw-hostlq-${Date.now()}-${rand()}`;
  // A constant-selecting query so the expected result is fixed regardless of
  // what the host actually has installed.
  await createReport(request, { name: marker, query: "SELECT 'bar' AS foo;" });

  try {
    await hostDetails.goto(liveMacosHost.id);
    await hostDetails.openLiveReport();

    // The modal offers authoring a new report alongside running a saved one.
    await expect(hostDetails.selectReportModal.createReportLink).toBeVisible();

    await hostDetails.selectReportModal.filter(marker);
    await expect(hostDetails.selectReportModal.report(marker)).toBeVisible();
    await hostDetails.selectReportModal.selectReport(marker);

    // The report's edit screen carries the host through as the live-run target.
    await expect(page).toHaveURL(new RegExp(`host_id=${liveMacosHost.id}\\b`));
    await reportEdit.clickLiveReport();

    await reportLive.waitForReady();
    await expect(reportLive.targetRows).toHaveCount(1);
    await expect(reportLive.targetRows.first()).toContainText(liveMacosHost.displayName);

    await reportLive.run();

    // The host answers on its distributed interval; Fleet closes the campaign at
    // FLEET_LIVE_QUERY_REST_PERIOD (25s by default) even if it never does.
    await expect(reportLive.finishedHeading).toBeVisible({ timeout: 90_000 });
    await expect(reportLive.runSummary).toContainText('1 host targeted');
    await expect(reportLive.runSummary).toContainText('100% responded');

    // The host ran the SQL: one row, attributed to it, carrying the value the
    // query selected.
    await expect(reportLive.resultsRows).toHaveCount(1);
    await expect(reportLive.resultsRows.first()).toContainText(liveMacosHost.displayName);
    await expect(reportLive.resultsRows.first()).toContainText('bar');
  } finally {
    await deleteReportsMatching(request, marker);
  }
});
