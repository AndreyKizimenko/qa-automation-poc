/**
 * Premium • Hosts • Drilling a report card into this host's stored results.
 * C2 #24 — the last of the hosts-details flows.
 *
 * A report card only offers **Show details** once the report has a stored result
 * for that host (`HostReportCard.tsx` gates it on `last_fetched`), which needs a
 * scheduled run the host actually performed. That's why this couldn't be written
 * against the osquery-perf fleet: simulations never execute a scheduled query.
 *
 * ## Precondition — a durable seeded report
 *
 * The spec depends on `pw-host-report-results` existing on the **VMs** fleet with
 * an interval, so the real macOS VM keeps a fresh stored result for it. That
 * report is deliberately **instance furniture**, not something the test creates:
 *
 *   - It has to live somewhere `cleanup.steps.ts` won't wipe. Global reports are
 *     wiped at the start of every run, which destroyed an earlier attempt at this
 *     mid-flight; the VMs fleet is untouched by cleanup.
 *   - Self-provisioning would mean waiting for a real scheduled run — measured at
 *     ~3.5 minutes from creation — on every execution.
 *
 * If it goes missing, recreate it (and let one interval elapse):
 *
 *   POST /api/v1/fleet/queries
 *   { "name": "pw-host-report-results", "query": "SELECT 'bar' AS foo;",
 *     "team_id": <VMs fleet id>, "interval": 300, "platform": "darwin",
 *     "logging": "snapshot" }
 */
import { test, expect } from '@fixtures';
import { findReportByName, getHostReportLastFetched } from '@helpers/api';

const REPORT_NAME = 'pw-host-report-results';

test.describe('Premium • Hosts • host report results', () => {
  test('a report with stored results drills into this host and out to all hosts', async ({
    hostDetails,
    hostQueryReport,
    reportDetails,
    liveMacosHost,
    vmsFleetId,
    request,
    page,
  }) => {
    // Scoped to the VMs fleet — a fleet-owned report doesn't appear in the
    // global report list.
    const report = await findReportByName(request, REPORT_NAME, vmsFleetId);
    expect(
      report,
      `seeded report "${REPORT_NAME}" is missing — see this spec's header for how to recreate it`,
    ).not.toBeNull();

    const lastFetched = await getHostReportLastFetched(request, liveMacosHost.id, REPORT_NAME);
    expect(
      lastFetched,
      `"${REPORT_NAME}" has no stored result for the VM yet — allow one interval after seeding it`,
    ).not.toBeNull();

    await hostDetails.goto(liveMacosHost.id);
    await hostDetails.openReportsTab();
    await hostDetails.searchReports(REPORT_NAME);
    await expect(hostDetails.reportCard(REPORT_NAME)).toBeVisible();

    await hostDetails.runReportCardAction(REPORT_NAME, 'Show details');

    // The per-host results page titles itself with the host, not the report.
    await hostQueryReport.waitForReady();
    await expect(page).toHaveURL(new RegExp(`/hosts/${liveMacosHost.id}/reports/${report!.id}`));
    await expect(hostQueryReport.hostHeading).toHaveText(liveMacosHost.displayName);

    // The stored row is what the query selected, proving these are real results
    // rather than an empty shell.
    await expect(hostQueryReport.table.firstRow).toContainText('bar');

    await hostQueryReport.viewAllHosts();

    // Out to the report's own results, across every host that has run it.
    await expect(page).toHaveURL(new RegExp(`/reports/${report!.id}`));
    await expect(reportDetails.nameHeading).toContainText(REPORT_NAME);
  });
});
