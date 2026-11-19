/**
 * Throwaway • Hosts • the run's simulated hosts on the Hosts list and on each platform's Host details.
 *
 * The throwaway instance holds nothing but the hosts its workflow enrolled: `THROWAWAY_HOSTS`
 * osquery-perf simulations over the seed's templates (macOS, Windows, Ubuntu, RHEL; `seed.json`), all
 * online before this project starts (`fleet-data.mjs wait`). So unlike on the shared instances, a count
 * is an exact assertion here, and "every host" is a set the test knows. On the Update flow's run the
 * hosts enrolled on the release before the upgrade, and these tests show they are listed and answering
 * on the build after it.
 *
 * Host details per platform: each platform's detail queries are a different set, so a page that breaks
 * for one platform's data shows here. The seeded policies are `SELECT 1;` and `SELECT 0;`, which
 * osquery-perf answers pass and fail on every host (`runPolicy` in Fleet's `cmd/osquery-perf/agent.go`),
 * so the Policies tab's answers are known.
 *
 * Read-only: nothing is created, and the instance goes away with the runner.
 */
import { test, expect } from '@fixtures';
import { THROWAWAY_SEED, throwawayHostCount, throwawayHostOf } from '@helpers/throwaway';

test.describe('Throwaway • Hosts', () => {
  test('lists every enrolled host, all of them online', async ({ hostsList }) => {
    const hosts = throwawayHostCount();

    await hostsList.goto();
    await expect(hostsList.resultsCount).toHaveText(new RegExp(`^${hosts} hosts?\\b`));

    await hostsList.filterByStatus('Online hosts');
    await expect(hostsList.resultsCount).toHaveText(new RegExp(`^${hosts} hosts?\\b`));
  });

  for (const { platform } of THROWAWAY_SEED.simulations) {
    test(`Host details of the ${platform} host show its vitals and policy answers`, async ({
      hostDetails,
      request,
    }) => {
      const host = await throwawayHostOf(request, platform);

      await hostDetails.goto(host.id);
      await expect(hostDetails.hostHeading).toContainText(host.displayName);

      await hostDetails.openPoliciesTab();
      for (const policy of THROWAWAY_SEED.policies) {
        await expect(hostDetails.policyRow(policy.name)).toContainText(
          policy.response === 'passing' ? 'Pass' : 'Fail',
        );
      }
    });
  }
});
