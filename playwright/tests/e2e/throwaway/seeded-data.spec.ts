/**
 * Throwaway • Seeded data • what the workflow seeded, shown where a person looks for it.
 *
 * The workflow seeds `test-data/shared/throwaway/seed.json` through the API before this project runs:
 * on the Helm job on the brand-new server, on the Update flow's job on the release before the upgrade,
 * where showing it afterwards is the Update flow's whole point. `fleet-data.mjs compare` checks the
 * same data field by field through the API; these check the pages that show it.
 *
 *   - The report is scheduled every minute with its results stored, and osquery-perf answers a scheduled
 *     report with one row, so its page holds one stored result per host. The server's total is read,
 *     not the rows: the table pages them 50 at a time.
 *   - Each policy's hosts are every host (`SELECT 1;` passes and `SELECT 0;` fails on every
 *     osquery-perf host). The Pass / Fail counts on the policies list wait for an hourly job, so the
 *     hosts list behind each count is reached by URL; Fleet answers it live. The Hosts list rewrites its
 *     URL once it loads, and without the filter it would list every host too, so the filter's pill is
 *     checked before the count.
 *   - The label is dynamic with `SELECT 1;`, which every osquery-perf host answers, so every host is
 *     a member.
 *   - The organization name is the one set up with the server.
 *
 * Read-only: nothing is created, and the instance goes away with the runner.
 */
import { test, expect } from '@fixtures';
import { findGlobalPolicyByName } from '@helpers/api';
import { THROWAWAY_SEED, throwawayHostCount, throwawayReportId } from '@helpers/throwaway';

const hostsText = (hosts: number) => new RegExp(`^${hosts} hosts?\\b`);

test.describe('Throwaway • Seeded data', () => {
  test("the report's page holds a stored result from every host", async ({ reportDetails, request }) => {
    const hosts = throwawayHostCount();
    const reportId = await throwawayReportId(request, THROWAWAY_SEED.report.name);

    await reportDetails.goto(reportId);
    await expect(reportDetails.resultsCount).toHaveText(new RegExp(`^${hosts} results?$`));
  });

  for (const policy of THROWAWAY_SEED.policies) {
    test(`every host is ${policy.response} ${policy.name}`, async ({ policiesList, hostsList, page, request }) => {
      const hosts = throwawayHostCount();

      await policiesList.goto();
      await policiesList.narrowTo(policy.name);

      const { id } = await findGlobalPolicyByName(request, policy.name);
      await hostsList.goto({ policy: { id, response: policy.response } });
      await hostsList.table.waitForSettled();
      await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${policy.name}`);
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get('policy_id') === String(id) &&
          url.searchParams.get('policy_response') === policy.response,
      );
      await expect(hostsList.resultsCount).toHaveText(hostsText(hosts));
    });
  }

  test('the label holds every host', async ({ labelsPage, hostsList }) => {
    const hosts = throwawayHostCount();

    await labelsPage.goto();
    await expect(labelsPage.rowFor(THROWAWAY_SEED.label.name)).toBeVisible();

    await hostsList.goto();
    await hostsList.labelFilter.selectLabel(THROWAWAY_SEED.label.name);
    await hostsList.table.waitForSettled();
    await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${THROWAWAY_SEED.label.name}`);
    await expect(hostsList.resultsCount).toHaveText(hostsText(hosts));
  });

  test('the organization name is the one set up with the server', async ({ organizationInfo }) => {
    await organizationInfo.goto();
    await expect(organizationInfo.orgNameInput).toHaveValue(THROWAWAY_SEED.orgName);
  });
});
