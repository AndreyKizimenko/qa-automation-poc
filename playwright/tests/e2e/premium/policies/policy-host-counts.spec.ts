/**
 * Premium • Policies • a policy's Pass and Fail counts open the hosts behind
 * them. Round 1 C3 #26.
 *
 * The list's "N hosts" counts come from an hourly job, so a policy made in the
 * test reads `---` for up to an hour. This reads the VMs fleet's durable
 * "Claude is installed (macOS)" instead (`gitops/premium-fleetqa/fleets/vms.yml`),
 * which always has counts, and only reads it: it carries an install automation.
 * Free has no policy that survives cleanup, so its half is the host tab's link
 * (`shared/policies/policy-hosts.spec.ts`).
 *
 * The count is a snapshot and the list is live, so the hosts the link opens are
 * compared with a live API read, by name, never with the number. Simulations
 * the label-targeting specs borrow onto the VMs fleet can answer mid-test, so
 * each comparison re-reads both sides until they agree.
 */
import { test, expect } from '@fixtures';
import { listFleetPolicies, listPolicyHosts } from '@helpers/api';

const POLICY = 'Claude is installed (macOS)';

test('the Pass count opens exactly the hosts passing the policy, and Fail those failing it', async ({
  dashboard,
  policiesList,
  hostsList,
  vmsFleetId,
  request,
  page,
}) => {
  const policy = (await listFleetPolicies(request, vmsFleetId)).find((p) => p.name === POLICY);
  expect(policy, `"${POLICY}" is missing from the VMs fleet; re-apply gitops/premium-fleetqa/fleets/vms.yml`).toBeDefined();

  await dashboard.goto();
  await dashboard.navbar.goToPolicies();
  await policiesList.teamDropdown.selectByLabel('VMs');
  await policiesList.openHostCount(POLICY, 'Pass');

  const url = new URL(page.url());
  expect(url.searchParams.get('policy_id')).toBe(String(policy!.id));
  expect(url.searchParams.get('policy_response')).toBe('passing');
  expect(url.searchParams.get('fleet_id')).toBe(String(vmsFleetId));
  await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${POLICY}`);
  await expect(hostsList.policyResponseValue).toHaveText('Pass');

  for (const [response, label] of [
    ['passing', 'Pass'],
    ['failing', 'Fail'],
  ] as const) {
    if (label === 'Fail') await hostsList.selectPolicyResponse('Fail');
    await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    await expect(async () => {
      const expected = (await listPolicyHosts(request, policy!.id, response, vmsFleetId))
        .map((h) => h.displayName)
        .sort();
      if (response === 'passing') {
        expect(expected.length, 'the Mac VM keeps Claude installed, so it passes').toBeGreaterThan(0);
      }
      expect((await hostsList.hostNames()).sort(), `the hosts listed under ${label}`).toEqual(expected);
    }).toPass({ timeout: 30_000 });
  }
});
