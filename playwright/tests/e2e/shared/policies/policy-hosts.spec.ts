/**
 * Shared • Policies • which hosts a policy runs on, and the hosts behind a
 * host's answer. Round 1 C3 #3/#19 (a policy for one platform) and C3 #6/#24 (a
 * host's Policies tab → "View all hosts").
 *
 * Both are Fleet's server-side decisions, so osquery-perf simulations answer
 * them as well as a VM, and global policies make the two tiers identical:
 *
 *  - **Platform.** A host lists a policy only when the policy's platforms are
 *    empty or include the host's (`FIND_IN_SET` in Fleet's
 *    `server/datastore/mysql/policies.go`); no answer is needed. A policy saved
 *    with only macOS ticked is listed on a macOS simulation and on neither a
 *    Linux nor a Windows one. An untargeted sibling, listed on all three, is the
 *    present half of each absence. The policy is created through the Save
 *    policy modal's checkboxes and its stored platform read back: the CRUD spec
 *    edits platforms but never reads them.
 *  - **The hosts behind an answer.** A host's Policies tab offers "View all
 *    hosts" once the host has answered a policy, and it lands on the Hosts list
 *    filtered by the policy *and* that answer. Simulations pass every policy
 *    except `SELECT 0;`, so one policy of each gives both answers, and a refetch
 *    makes two simulations answer at once (Fleet sends a host its policies with
 *    the refetch). Other hosts answer on their hourly cycle, so the list is
 *    asserted to hold the refetched pair, never to equal it, and the pair is
 *    asserted absent under the other answer.
 *
 * Both policies of the second test target Linux, so the failing one never runs
 * on the macOS or Windows VMs; neither carries an automation. Simulations come
 * from `findSimulations` (linux 6–7, darwin 6, windows 2) and are never moved.
 */
import { test, expect } from '@fixtures';
import {
  createPolicy,
  deletePolicies,
  findSimulations,
  getGlobalPolicy,
  getHostDisplayName,
  getHostPolicyResponses,
  listHostPolicyIds,
  requestHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';

test.describe('Shared • Policies • policy hosts', () => {
  test('a policy saved for macOS only runs on macOS hosts', async ({
    dashboard,
    policiesList,
    policyEdit,
    hostDetails,
    request,
  }) => {
    const [darwin] = await findSimulations(request, 'darwin', 1, 6);
    const [linux] = await findSimulations(request, 'linux', 1, 6);
    const [windows] = await findSimulations(request, 'windows', 1, 2);
    expect([darwin, linux, windows], 'an online simulation of each platform').not.toContain(undefined);

    const marker = `pw-policy-hosts-${runNonce()}`;
    const macosName = `${marker}-macos`;
    const sibling = await createPolicy(request, { name: `${marker}-any` });
    let macosId: number | undefined;

    try {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select('All fleets');
      await policiesList.addPolicy();
      await policyEdit.setSql('SELECT 1;');
      macosId = await policyEdit.saveNew({
        name: macosName,
        description: 'Playwright: macOS only',
        resolution: '',
        platforms: ['macOS'],
      });

      expect((await getGlobalPolicy(request, macosId)).platform, 'the stored platform').toBe('darwin');

      expect(await listHostPolicyIds(request, darwin)).toEqual(expect.arrayContaining([macosId, sibling.id]));
      for (const [platform, host] of [
        ['linux', linux],
        ['windows', windows],
      ] as const) {
        const listed = await listHostPolicyIds(request, host);
        expect(listed, `the untargeted policy on the ${platform} simulation`).toContain(sibling.id);
        expect(listed, `the macOS policy on the ${platform} simulation`).not.toContain(macosId);
      }

      await hostDetails.goto(darwin);
      await hostDetails.openPoliciesTab();
      await expect(hostDetails.policyRow(macosName)).toBeVisible();

      await hostDetails.goto(linux);
      await hostDetails.openPoliciesTab();
      await expect(hostDetails.policyRow(sibling.name)).toBeVisible();
      await expect(hostDetails.policyRow(macosName)).toHaveCount(0);
    } finally {
      await deletePolicies(request, [sibling.id, ...(macosId ? [macosId] : [])]);
    }
  });

  test("a host's policy links to the hosts that gave the same answer", async ({
    hostDetails,
    hostsList,
    request,
    page,
  }) => {
    // Two refetches and a minute of list reads.
    test.setTimeout(240_000);

    const hosts = await findSimulations(request, 'linux', 2, 6);
    expect(hosts, 'two online Linux simulations').toHaveLength(2);
    const names = await Promise.all(hosts.map((id) => getHostDisplayName(request, id)));

    const marker = `pw-policy-hosts-${runNonce()}`;
    const passing = await createPolicy(request, { name: `${marker}-pass`, query: 'SELECT 1;', platform: 'linux' });
    const failing = await createPolicy(request, { name: `${marker}-fail`, query: 'SELECT 0;', platform: 'linux' });

    try {
      for (const id of hosts) {
        await waitForNoPendingRefetch(request, id);
        await requestHostRefetch(request, id);
      }
      for (const id of hosts) {
        await expect
          .poll(
            async () => {
              const responses = await getHostPolicyResponses(request, id);
              return [responses.get(passing.id), responses.get(failing.id)];
            },
            { message: `host ${id} answered both policies`, timeout: 180_000, intervals: [5_000] },
          )
          .toEqual(['pass', 'fail']);
      }

      for (const [policy, response, label, other] of [
        [passing, 'passing', 'Pass', 'Fail'],
        [failing, 'failing', 'Fail', 'Pass'],
      ] as const) {
        await hostDetails.goto(hosts[0]);
        await hostDetails.openPoliciesTab();
        await hostDetails.viewAllHostsForPolicy(policy.name);

        const url = new URL(page.url());
        expect(url.searchParams.get('policy_id')).toBe(String(policy.id));
        expect(url.searchParams.get('policy_response')).toBe(response);
        await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${policy.name}`);
        await expect(hostsList.policyResponseValue).toHaveText(label);

        // Searched one at a time: every Linux simulation that ran the policy
        // on its own cycle is listed too, so neither is assured of page 1.
        for (const name of names) {
          await hostsList.search.fill(name);
          await expect(hostsList.hostLink(name), `${name} under ${label}`).toBeVisible();
        }

        await hostsList.selectPolicyResponse(other);
        await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${policy.name}`);
        for (const name of names) {
          await hostsList.search.fill(name);
          await hostsList.table.waitForSettled();
          // A table that rendered (rows or its empty state) before the absence counts.
          await expect(hostsList.table.rowOrEmpty()).toBeVisible();
          await expect(hostsList.hostLink(name), `${name} under ${other}`).toHaveCount(0);
        }
      }
    } finally {
      await deletePolicies(request, [passing.id, failing.id]);
    }
  });
});
