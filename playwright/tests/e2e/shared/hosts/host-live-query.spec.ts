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
 * Note on the results assertion: a host that answers a live query may return
 * rows, no rows, or an error — all three count as "responded". The hosts on the
 * QA instances are osquery-perf simulations that deliberately return no rows for
 * a fraction of live queries (`--live_query_no_results_prob`, default 0.2) and
 * ignore the SQL, answering any query with a fixed row. So the run's completion
 * and responded count are asserted, and the results area is accepted in either
 * terminal state; asserting a specific row or value here would be flaky by
 * construction.
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
  await createReport(request, { name: marker, query: 'SELECT 1 AS probe;' });

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

    await expect(reportLive.resultsRows.first().or(reportLive.noResultsState)).toBeVisible();
  } finally {
    await deleteReportsMatching(request, marker);
  }
});
