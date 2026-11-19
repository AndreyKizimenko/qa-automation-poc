/**
 * Premium • Hosts • My device's Policies tab: the host's own policy answers, as its end user sees them.
 *
 * Premium's My device page has a Policies tab (`DeviceUserPage.tsx`): the policies that reach the host, each
 * with its answer ("Pass", "Fail"), and a count of the failing ones on the tab. Clicking a policy opens its
 * details under its name. What the end user sees is what the admin sees: the tab's count is Host details'
 * Policies tab's, and each answer is the one Host details shows. Free's page has no such tab (the per-OS
 * smokes check the tabs of each tier).
 *
 * **The policies.** Two per run on the VMs fleet, both Linux only, with no automation: one every host passes
 * and one every host fails. They reach the other Linux pool VMs too, which answer them and nothing more, so
 * the test reads its own host's answers only, and never a count over the fleet: another spec's policy can be
 * failing on the same host, so the tab's count is held to "at least one", not to one. `seed.policy` deletes
 * both after the test.
 *
 * **On the worker's Linux pool VM.** A policy's answer moves only when the host collects (a refetch, or the
 * hourly run), so the test asks for refetches until its host has answered both.
 *
 * Grounded in: `DeviceUserPage.tsx` (the tab and its count), `cards/Policies/HostPolicies.tsx` (the table) and
 * `components/policies/helpers.ts` (the status words).
 */
import type { Locator } from '@playwright/test';
import { test, expect, HOST_RETRIES } from '@fixtures';
import { getHostPolicyResponses, requestHostRefetch, requireRealHost, waitForNoPendingRefetch } from '@helpers/api';

test.describe('Premium • Hosts • My device policies', () => {
  // A refetch or two on a VM, 70–120 s each.
  test.describe.configure({ timeout: 420_000, retries: HOST_RETRIES });

  test('the Policies tab shows the host passing one policy and failing another, and opens a policy', { tag: '@vm-linux' }, async ({
    hostDetails,
    seed,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const passing = await seed.policy('my-device-pass', { fleetId: host.fleetId, platform: 'linux', query: 'SELECT 1 FROM osquery_info;' });
    const failing = await seed.policy('my-device-fail', {
      fleetId: host.fleetId,
      platform: 'linux',
      query: 'SELECT 1 FROM osquery_info WHERE 1 = 0;',
    });

    await test.step('the host answers both', async () => {
      // A refetch already under way was asked for before the policies existed.
      await waitForNoPendingRefetch(request, host.id);
      await expect
        .poll(
          async () => {
            const responses = await getHostPolicyResponses(request, host.id);
            const answered = [responses.get(passing.id), responses.get(failing.id)];
            if (answered.includes('') || answered.includes(undefined)) await requestHostRefetch(request, host.id);
            return answered;
          },
          { message: `${host.displayName} never answered its policies`, timeout: 300_000, intervals: [15_000] },
        )
        .toEqual(['pass', 'fail']);
    });

    await hostDetails.goto(host.id);
    const device = await hostDetails.openMyDevice();
    await device.expectLoaded();

    await test.step('Policies: its count of failing policies, and a row for each answer', async () => {
      await expect(device.tab('Policies')).toHaveAccessibleName(/^Policies\s*[1-9]\d*$/);
      await device.openTab('Policies');
      await expect(device.policyRow(passing.name)).toContainText('Pass');
      await expect(device.policyRow(failing.name)).toContainText('Fail');
    });

    await test.step("what the end user sees is what Host details shows: the count, and each answer", async () => {
      // Read in pairs until they agree: another spec's policy can be answered between two reads.
      await expect(async () => {
        await hostDetails.goto(host.id);
        await device.gotoDetails();
        const tabText = async (tab: Locator) => (await tab.innerText()).replace(/\s+/g, ' ').trim();
        expect(await tabText(device.tab('Policies')), "My device's Policies tab against Host details'").toBe(
          await tabText(hostDetails.policiesTab),
        );
      }).toPass({ timeout: 60_000, intervals: [5_000] });
      await hostDetails.openPoliciesTab();
      await expect(hostDetails.policyRow(passing.name)).toContainText('Pass');
      await expect(hostDetails.policyRow(failing.name)).toContainText('Fail');
    });

    await test.step('a policy opens its details, under its name', async () => {
      await device.openTab('Policies');
      const details = await device.openPolicy(failing.name);
      await device.closePolicy(details);
    });
  });
});
