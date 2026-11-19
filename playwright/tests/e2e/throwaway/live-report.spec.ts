/**
 * Throwaway • Reports • the seeded report run live against every host, all of them answering.
 *
 * A live run is the round trip with the most moving parts: the browser's campaign is created on one
 * Fleet server, each host picks it up on its own distributed check-in, and the results reach the
 * browser through Redis. On the Helm job Fleet runs two pods behind one NodePort, so a host's answer
 * and the browser's results stream often land on different pods, and only Redis (the chart's Valkey)
 * carries one to the other.
 *
 * All hosts is safe here, as it isn't on the shared instances: every host on the throwaway instance is
 * a simulation of the run's own, online, and osquery-perf runs with `-live_query_no_results_prob 0`, so
 * each answers. It answers with exactly one canned row whatever the SQL (`runLiveMockQuery` in Fleet's
 * `cmd/osquery-perf/agent.go`), so the test asserts who answered, not what: every host targeted,
 * every one responded, and one result per host. The results are counted, not read: the table pages
 * them 20 at a time in the browser, and a run enrolls 30 hosts by default.
 *
 * A live run has no timeout of its own, so the wait on "Report finished" is bounded.
 */
import { test, expect } from '@fixtures';
import { THROWAWAY_SEED, throwawayHostCount, throwawayReportId } from '@helpers/throwaway';

test('Throwaway • Reports • a live run of the seeded report reaches every host', async ({
  reportDetails,
  reportLive,
  request,
}) => {
  // Every host answers on its next distributed check-in (osquery-perf's 10 s); the bound leaves room
  // for a slow runner without letting a stuck campaign run out the job.
  test.setTimeout(180_000);
  const count = throwawayHostCount();
  const reportId = await throwawayReportId(request, THROWAWAY_SEED.report.name);

  await test.step('target All hosts', async () => {
    await reportDetails.goto(reportId);
    await reportDetails.clickLiveReport();
    await reportLive.waitForReady();
    await reportLive.toggleTarget('All hosts', true);
    await expect(reportLive.targetsTotalCount).toHaveText(
      new RegExp(`^${count}\\s*hosts? targeted\\s*\\(100%\\s*online\\)`),
    );
  });

  await test.step('run it until every host has answered with its row', async () => {
    await reportLive.run();
    await expect(reportLive.finishedHeading).toBeVisible({ timeout: 120_000 });
    await expect(reportLive.runSummary).toContainText(`${count} hosts targeted`);
    await expect(reportLive.runSummary).toContainText('100% responded');
    await expect(reportLive.resultsCount).toHaveText(new RegExp(`^${count} results?$`));
  });
});
