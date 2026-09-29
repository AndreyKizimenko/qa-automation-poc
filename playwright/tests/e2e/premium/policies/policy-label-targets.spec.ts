/**
 * Premium • Policies — a label-targeted fleet policy runs on exactly the hosts
 * its labels pick.
 *
 * QA Wolf's `policies-include-all`: a VMs-fleet policy targeted "Include all"
 * of two labels showed on the host with both and not on a host with one. Here
 * three policies side by side, created through the Save policy modal's target
 * (the tabbed selector, which on a policy has Any / All on **both** tabs — a
 * profile's Exclude has none), asserted as set membership over hosts the test
 * controls: the macOS VM and two macOS simulations borrowed onto the fleet. a = VM + s1, b = VM + s2, c = s2:
 *
 * | policy | target | runs on |
 * |---|---|---|
 * | `…-all` | Include **all** of a, b | VM |
 * | `…-any` | Include **any** of a, b · Exclude **any** of c | VM, s1 |
 * | `…-xall` | Exclude **all** of a, b | s1, s2 — only the VM has both |
 *
 * Which policies run on a host is Fleet's server-side decision (the host's
 * policy list), which a simulation answers as well as a VM; the VM's Policies
 * tab is where a person sees it. A policy doesn't need MDM, so the simulations
 * come from the pool that isn't enrolled, leaving the scarce enrolled ones to
 * the profile specs.
 */
import { test, expect } from '@fixtures';
import {
  createManualLabel,
  deleteFleetPolicies,
  deleteLabelById,
  findSimulations,
  listHostPolicyIds,
  requireRealHost,
  transferHosts,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import type { PolicyTarget } from '@pages';

/** Which slice of the simulations this spec borrows (see `findSimulations`). */
const SIM_OFFSET = 2;

test.describe('Premium • Policies — label targeting', () => {
  test.describe.configure({ timeout: 600_000 });

  test('include all, include any + exclude any, and exclude all run on exactly the hosts their labels pick', async ({
    dashboard,
    policiesList,
    policyEdit,
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const sims = await findSimulations(request, 'darwin', 2, SIM_OFFSET);
    expect(sims, 'needs two online macOS simulations on Unassigned').toHaveLength(2);
    const [s1, s2] = sims;
    const ours = [vm.id, s1, s2];

    const n = runNonce();
    const label = { a: `pw-pl-${n}-a`, b: `pw-pl-${n}-b`, c: `pw-pl-${n}-c` };
    const cases: Array<{ name: string; target: PolicyTarget; runsOn: number[] }> = [
      { name: `pw-pl-${n}-all`, target: { include: { mode: 'all', labels: [label.a, label.b] } }, runsOn: [vm.id] },
      {
        name: `pw-pl-${n}-any`,
        target: { include: { mode: 'any', labels: [label.a, label.b] }, exclude: { mode: 'any', labels: [label.c] } },
        runsOn: [vm.id, s1],
      },
      { name: `pw-pl-${n}-xall`, target: { exclude: { mode: 'all', labels: [label.a, label.b] } }, runsOn: [s1, s2] },
    ];
    const policyIds: number[] = [];
    const labelIds: number[] = [];

    try {
      await transferHosts(request, vmsFleetId, sims);
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));
      labelIds.push(await createManualLabel(request, label.c, [s2]));

      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.selectByLabel('VMs');
      for (const c of cases) {
        await policiesList.goto({ fleetId: vmsFleetId });
        await policiesList.teamDropdown.selectByLabel('VMs');
        await policiesList.addPolicy();
        await policyEdit.setSql('SELECT 1;');
        policyIds.push(
          await policyEdit.saveNew({ name: c.name, description: 'Playwright label-targeted policy', resolution: '' }, c.target),
        );
      }

      // Server-side: each policy runs on exactly the hosts its labels pick.
      const runsOn = async () => {
        const perHost = await Promise.all(ours.map(async (h) => [h, await listHostPolicyIds(request, h)] as const));
        return cases.map((c, i) => perHost.filter(([, ids]) => ids.includes(policyIds[i])).map(([h]) => h).sort((x, y) => x - y));
      };
      await expect
        .poll(runsOn, { message: 'each policy should run on exactly its hosts', timeout: 60_000, intervals: [5_000] })
        .toEqual(cases.map((c) => [...c.runsOn].sort((x, y) => x - y)));

      // The VM's Policies tab lists the two that include it, and not the one that excludes it.
      await hostDetails.goto(vm.id);
      await hostDetails.openPoliciesTab();
      await expect(hostDetails.policyRow(cases[0].name)).toBeVisible();
      await expect(hostDetails.policyRow(cases[1].name)).toBeVisible();
      await expect(hostDetails.policyRow(cases[2].name)).toHaveCount(0);
    } finally {
      await deleteFleetPolicies(request, vmsFleetId, policyIds);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });
});
