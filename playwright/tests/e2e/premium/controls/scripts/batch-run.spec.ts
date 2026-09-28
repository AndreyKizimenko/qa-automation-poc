/**
 * Premium • Controls • Running a script on many hosts at once.
 *
 * Hosts list → select hosts → Run script → pick a script → Run now, then follow
 * the batch through Controls → Scripts → Batch progress to its details page:
 * the script, how many hosts it targeted, and which hosts landed in which status.
 *
 * Premium only: batch runs are scoped to one fleet, and free has none.
 *
 * Two shapes, because they prove different things:
 *
 *   - **Three real VMs, one of each platform**, with a script that succeeds on
 *     macOS and fails on Linux. A `.sh` can't run on Windows, so each VM lands
 *     in a different tab — Ran, Errored, Incompatible — and each tab is asserted
 *     to list exactly that host. This is the behaviour: the right host in the
 *     right status, with its own output.
 *   - **Every online macOS simulation in Unassigned** (~100) through "Select all
 *     matching hosts" — the batch at a scale no hand-picked selection reaches.
 *     osquery-perf answers a script with a random exit code, so which host lands
 *     where is noise; what holds is arithmetic. The batch targets exactly the
 *     hosts the filter matched, every one of them lands in exactly one status,
 *     the simulations without orbit — which can't run scripts — are exactly the
 *     incompatible ones, and some of the rest ran and some errored.
 *
 * A batch reads "Completed" only once Fleet's batch cron has marked it finished,
 * a couple of minutes after the last host reported. The spec waits for that
 * through the API rather than watching the progress page.
 */
import * as crypto from 'crypto';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  apiUrl,
  authHeaders,
  deleteScript,
  findOnlineHost,
  uploadScript,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';

interface BatchSummary {
  status: string;
  targeted: number;
  ran: number;
  errored: number;
  pending: number;
  incompatible: number;
  canceled: number;
}

async function getBatchSummary(request: APIRequestContext, id: string): Promise<BatchSummary> {
  const res = await request.get(apiUrl(`scripts/batch/${id}`), { headers: authHeaders() });
  await expect(res, `Failed to read batch ${id}`).toBeOK();
  const b = await res.json();
  return {
    status: b.status,
    targeted: b.targeted_host_count,
    ran: b.ran_host_count,
    errored: b.errored_host_count,
    pending: b.pending_host_count,
    incompatible: b.incompatible_host_count,
    canceled: b.canceled_host_count,
  };
}

/** The newest batch on a fleet for `scriptName` — the one this test just started. */
async function findBatchId(request: APIRequestContext, fleetId: number, scriptName: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(async () => {
      const res = await request.get(apiUrl('scripts/batch'), {
        headers: authHeaders(),
        params: { fleet_id: String(fleetId), per_page: '20' },
      });
      await expect(res).toBeOK();
      const batches = ((await res.json()).batch_executions ?? []) as Array<{
        batch_execution_id: string;
        script_name: string;
      }>;
      id = batches.find((b) => b.script_name === scriptName)?.batch_execution_id;
      return id;
    }, { message: `no batch for ${scriptName} on fleet ${fleetId}` })
    .toBeTruthy();
  return id!;
}

async function waitForBatchFinished(request: APIRequestContext, id: string): Promise<BatchSummary> {
  let summary: BatchSummary | undefined;
  await expect
    .poll(async () => (summary = await getBatchSummary(request, id)).status, {
      message: `batch ${id} never finished`,
      timeout: 480_000,
      intervals: [10_000],
    })
    .toBe('finished');
  return summary!;
}

const nonce = (): string => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

test.describe('Premium • Controls • Batch script run', () => {
  test.describe.configure({ timeout: 720_000 });

  test('a batch on one VM of each platform puts each host in the status its platform earns', async ({
    dashboard,
    hostsList,
    scriptsBatchProgress,
    scriptBatchDetails,
    vmsFleetId,
    request,
    page,
  }) => {
    const [mac, linux, windows] = await Promise.all(
      (['darwin', 'linux', 'windows'] as const).map((p) => findOnlineHost(request, p, { kind: 'real' })),
    );
    expect([mac, linux, windows].every(Boolean), 'expected an online real VM of each platform').toBe(true);

    const scriptName = `pw-batch-run-${nonce()}.sh`;
    const scriptId = await uploadScript(
      request,
      vmsFleetId,
      scriptName,
      '#!/bin/sh\nif [ "$(uname)" = Linux ]; then echo "fails on Linux"; exit 1; fi\necho "ran on $(uname)"\n',
    );

    try {
      await dashboard.goto();
      await dashboard.navbar.goToHosts();
      await hostsList.teamDropdown.selectByLabel('VMs');
      for (const host of [mac!, linux!, windows!]) await hostsList.hostCheckbox(host.displayName).check();
      await hostsList.runScriptSelectedButton.click();

      const modal = hostsList.runScriptBatchModal;
      await expect(modal.summary).toContainText('Run a script on 3 hosts');
      await modal.runNow(scriptName, 'macOS and Linux');
      await page.getByRole('link', { name: 'Show script activity' }).click();
      await expect(scriptsBatchProgress.startedTab).toHaveAttribute('aria-selected', 'true');
      await expect(scriptsBatchProgress.batch(scriptName)).toContainText('/ 3 hosts');

      const batchId = await findBatchId(request, vmsFleetId, scriptName);
      const summary = await waitForBatchFinished(request, batchId);
      expect(summary).toMatchObject({ targeted: 3, ran: 1, errored: 1, incompatible: 1, pending: 0, canceled: 0 });

      await page.reload();
      await scriptsBatchProgress.openFinishedTab();
      await expect(scriptsBatchProgress.batch(scriptName)).toContainText('Completed');
      await scriptsBatchProgress.batch(scriptName).click();

      await expect(scriptBatchDetails.heading).toHaveText(scriptName);
      // Incompatible hosts never respond, so two of three is the whole answer.
      await expect(scriptBatchDetails.summary).toHaveText('3 hosts targeted (67% responded)');

      const expected = [
        { status: 'Ran', host: mac!, output: 'ran on Darwin' },
        { status: 'Errored', host: linux!, output: 'fails on Linux' },
        { status: 'Incompatible', host: windows!, output: '' },
      ] as const;
      for (const { status, host, output } of expected) {
        await expect(scriptBatchDetails.tab(status)).toHaveAccessibleName(`${status} 1`);
        await scriptBatchDetails.openTab(status);
        expect(await scriptBatchDetails.hostNames()).toEqual([host.displayName]);
        if (output) await expect(scriptBatchDetails.hostRows.first()).toContainText(output);
      }
      for (const status of ['Pending', 'Canceled'] as const) {
        await scriptBatchDetails.openTab(status);
        await expect(scriptBatchDetails.emptyTab).toBeVisible();
      }

      await dashboard.goto();
      await dashboard.expectActivity(activityCopy.script.ranBatch({ name: scriptName, hostCount: 3 }));
    } finally {
      await deleteScript(request, scriptId);
    }
  });

  test('a batch on every matching simulation targets exactly them, and accounts for each', async ({
    dashboard,
    hostsList,
    scriptBatchDetails,
    request,
  }) => {
    // Unassigned holds the osquery-perf pool; the macOS label and online status
    // are two of the four filters a batch accepts (with fleet and search).
    const labelsRes = await request.get(apiUrl('labels'), { headers: authHeaders() });
    const macosLabel = ((await labelsRes.json()).labels as Array<{ id: number; name: string }>).find(
      (l) => l.name === 'macOS',
    );
    expect(macosLabel, 'the built-in macOS label is missing').toBeDefined();

    // Which hosts the filter matches comes from the label's own host list; whether
    // each runs orbit comes from the hosts list, the only one that fills in
    // `orbit_version`.
    const matchingRes = await request.get(apiUrl(`labels/${macosLabel!.id}/hosts`), {
      headers: authHeaders(),
      params: { fleet_id: '0', status: 'online', per_page: '1000' },
    });
    await expect(matchingRes).toBeOK();
    const matchingIds = new Set(((await matchingRes.json()).hosts ?? []).map((h: { id: number }) => h.id));
    const unassignedRes = await request.get(apiUrl('hosts'), {
      headers: authHeaders(),
      params: { fleet_id: '0', status: 'online', per_page: '1000' },
    });
    await expect(unassignedRes).toBeOK();
    const matching = ((await unassignedRes.json()).hosts as Array<{ id: number; orbit_version: string | null }>).filter(
      (h) => matchingIds.has(h.id),
    );
    expect(matching, 'the label and hosts lists disagree on the matching hosts').toHaveLength(matchingIds.size);
    // The point is scale, and "Select all matching hosts" is only offered when
    // the matches run past one page of the list. A thin pool means the load
    // fleet is due its daily refresh (tools/perf-hosts/).
    expect(matching.length, 'too few online macOS simulations in Unassigned').toBeGreaterThan(50);

    const scriptName = `pw-batch-scale-${nonce()}.sh`;
    const scriptId = await uploadScript(request, 0, scriptName, '#!/bin/sh\necho scale\n');

    try {
      await dashboard.goto();
      await dashboard.navbar.goToHosts();
      await hostsList.teamDropdown.selectByLabel('Unassigned');
      await hostsList.labelFilter.selectPlatform('macOS');
      await hostsList.statusFilter.selectByName('Online');
      await hostsList.selectAllOnPage();
      await hostsList.selectAllMatchingButton.click();
      await hostsList.runScriptSelectedButton.click();

      const modal = hostsList.runScriptBatchModal;
      await expect(modal.summary).toContainText(`Run a script on ${matching.length.toLocaleString()} hosts`);
      await modal.runNow(scriptName, 'macOS and Linux');

      const batchId = await findBatchId(request, 0, scriptName);
      const summary = await waitForBatchFinished(request, batchId);
      const withoutOrbit = matching.filter((h) => !h.orbit_version).length;

      expect(summary.targeted).toBe(matching.length);
      expect(summary.ran + summary.errored + summary.pending + summary.incompatible + summary.canceled).toBe(
        summary.targeted,
      );
      expect(summary.incompatible, 'incompatible should be exactly the simulations without orbit').toBe(withoutOrbit);
      expect(summary.ran, 'no simulation reported a successful run').toBeGreaterThan(0);
      expect(summary.errored, 'no simulation reported a failed run').toBeGreaterThan(0);

      await scriptBatchDetails.goto(batchId);
      await expect(scriptBatchDetails.heading).toHaveText(scriptName);
      await expect(scriptBatchDetails.summary).toContainText(`${summary.targeted} hosts targeted`);
      await expect(scriptBatchDetails.tab('Ran')).toHaveAccessibleName(`Ran ${summary.ran}`);
      await expect(scriptBatchDetails.tab('Errored')).toHaveAccessibleName(`Errored ${summary.errored}`);
      await expect(scriptBatchDetails.tab('Incompatible')).toHaveAccessibleName(`Incompatible ${summary.incompatible}`);
    } finally {
      await deleteScript(request, scriptId);
    }
  });
});
