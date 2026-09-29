/**
 * Premium • Reports — a label-targeted fleet report runs on exactly the hosts
 * its labels pick, and only they store results.
 *
 * QA Wolf's `report-include-all`: a VMs-fleet report targeted "Include all" of
 * two labels, then "1 result" (a substring that "11 results" also matches) and
 * a link to the one host in both. Here two reports side by side, created
 * through the Save report modal's target — the dropdown variant; reports offer
 * Include any and Include all, no Exclude — over hosts the test controls: the
 * macOS VM and two macOS simulations borrowed onto the fleet (not MDM-enrolled:
 * a report doesn't need it).
 * a = VM + s1, b = VM + s2:
 *
 * | report | target | listed for |
 * |---|---|---|
 * | `…-all` | Include **all** of a, b | VM |
 * | `…-any` | Include **any** of a, b | VM, s1, s2 |
 *
 * Which reports a host is scheduled to run is Fleet's server-side decision
 * (`ListHostReports` applies the scope) and a simulation answers it as well as
 * a VM; the hosts' Reports tabs show it. What the VM *does* is the other half:
 * it runs `…-all` on schedule and stores its row — and a simulation outside the
 * scope never stores one. The UI's shortest schedule is 5 minutes, so once
 * created the report is set to 60 s through the API, which lands a real VM's
 * first row in about a minute.
 */
import { test, expect } from '@fixtures';
import {
  createManualLabel,
  deleteLabelById,
  deleteReport,
  findSimulations,
  getHostReportRows,
  listHostReportIds,
  requireRealHost,
  setReportInterval,
  transferHosts,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';

/** Which slice of the simulations this spec borrows (see `findSimulations`). */
const SIM_OFFSET = 4;

test.describe('Premium • Reports — label targeting', () => {
  test.describe.configure({ timeout: 600_000 });

  test('include all and include any schedule a report on exactly the hosts their labels pick', async ({
    dashboard,
    reportsList,
    reportEdit,
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
    const label = { a: `pw-rl-${n}-a`, b: `pw-rl-${n}-b` };
    const cases = [
      { name: `pw-rl-${n}-all`, option: 'Include all' as const, listedFor: [vm.id] },
      { name: `pw-rl-${n}-any`, option: 'Include any' as const, listedFor: [vm.id, s1, s2] },
    ];
    const reportIds: number[] = [];
    const labelIds: number[] = [];

    try {
      await transferHosts(request, vmsFleetId, sims);
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));

      await dashboard.goto();
      await dashboard.navbar.goToReports();
      for (const c of cases) {
        await reportsList.goto({ fleetId: vmsFleetId });
        await reportsList.teamDropdown.selectByLabel('VMs');
        await reportsList.addReport();
        await reportEdit.setSql(`SELECT '${c.name}' AS report;`);
        reportIds.push(
          await reportEdit.saveNew(
            { name: c.name, description: 'Playwright label-targeted report', interval: 'Every 5 minutes', observersCanRun: false },
            { option: c.option, labels: [label.a, label.b] },
          ),
        );
      }

      // Server-side: each report is listed for exactly the hosts its labels pick.
      const listedFor = async () => {
        const perHost = await Promise.all(ours.map(async (h) => [h, await listHostReportIds(request, h)] as const));
        return reportIds.map((id) => perHost.filter(([, ids]) => ids.includes(id)).map(([h]) => h).sort((x, y) => x - y));
      };
      await expect
        .poll(listedFor, { message: 'each report should be listed for exactly its hosts', timeout: 60_000, intervals: [5_000] })
        .toEqual(cases.map((c) => [...c.listedFor].sort((x, y) => x - y)));

      // The Reports tabs say the same — searched to this run's reports, since the
      // tab is shared and pages: the VM lists both, s1 only the Include-any one.
      const runPrefix = `pw-rl-${n}-`;
      await hostDetails.goto(vm.id);
      await hostDetails.openReportsTab();
      await hostDetails.searchReports(runPrefix);
      await expect.poll(async () => (await hostDetails.reportCardNames()).sort()).toEqual(cases.map((c) => c.name).sort());
      await hostDetails.goto(s1);
      await hostDetails.openReportsTab();
      await hostDetails.searchReports(runPrefix);
      await expect.poll(() => hostDetails.reportCardNames()).toEqual([cases[1].name]);

      // Host-side: the VM runs the Include-all report and stores its row; the
      // simulations, outside it, store none.
      const [allId] = reportIds;
      await setReportInterval(request, allId, 60);
      await expect
        .poll(() => getHostReportRows(request, vm.id, allId), {
          message: `the VM never stored a row for ${cases[0].name}`,
          timeout: 300_000,
          intervals: [10_000],
        })
        .toEqual([{ report: cases[0].name }]);
      for (const sim of sims) expect(await getHostReportRows(request, sim, allId)).toEqual([]);
    } finally {
      for (const id of reportIds) await deleteReport(request, id);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });
});
