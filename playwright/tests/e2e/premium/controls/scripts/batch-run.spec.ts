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
 *     the hosts that can't run a shell script (no orbit, scripts disabled, or
 *     not macOS / Linux) are exactly the incompatible ones, and some of the
 *     rest ran and some errored.
 *
 * A batch reads "Completed" only once Fleet's batch cron has marked it finished,
 * a couple of minutes after the last host reported. The spec waits for that
 * through the API rather than watching the progress page.
 *
 * Separately, the progress page as a fleet with no batch history shows it:
 * reached from Controls → Scripts' side nav, each tab's empty state. That's
 * Workstations, where no spec runs a batch, and `cleanup-setup` deletes its
 * scripts, which takes any batch with them. Free has no such fleet: its
 * Unassigned holds `batch-schedule-cancel.spec.ts`'s batches while that runs.
 * Scheduling and cancelling are `shared/controls/scripts/batch-schedule-cancel.spec.ts`.
 */
import * as crypto from 'crypto';
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  deleteScript,
  findBatchId,
  getLabelId,
  listFleetHosts,
  listLabelHostIds,
  requireRealHost,
  uploadScript,
  waitForBatchFinished,
  type ListedHost,
} from '@helpers/api';

/**
 * Whether Fleet counts a host incompatible with a `.sh` batch, by the checks a
 * batch makes before queueing (`BatchExecuteIncompatibleFleetd` / `…Platform`):
 * no orbit, scripts disabled in fleetd, or a platform that isn't Unix-like.
 */
const incompatibleWithShell = (h: ListedHost): boolean =>
  !h.orbitVersion ||
  h.scriptsEnabled === false ||
  ['windows', 'chrome', 'ios', 'ipados', 'android'].includes(h.platform);

const nonce = (): string => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

test.describe('Premium • Controls • Batch script run', () => {
  test.describe.configure({ timeout: 720_000, retries: HOST_RETRIES });

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
      (['darwin', 'linux', 'windows'] as const).map((p) => requireRealHost(request, p)),
    );

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
      for (const host of [mac, linux, windows]) await hostsList.hostCheckbox(host.displayName).check();
      await hostsList.runScriptSelectedButton.click();

      const modal = hostsList.runScriptBatchModal;
      await expect(modal.summary).toContainText('Run a script on 3 hosts');
      await modal.runNow(scriptName, 'macOS and Linux');
      await modal.showScriptActivity();
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
        { status: 'Ran', host: mac, output: 'ran on Darwin' },
        { status: 'Errored', host: linux, output: 'fails on Linux' },
        { status: 'Incompatible', host: windows, output: '' },
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
    // Which hosts the filter matches comes from the label's own host list; what
    // each can run comes from the hosts list.
    const matchingIds = await listLabelHostIds(request, await getLabelId(request, 'macOS'), {
      fleetId: 0,
      status: 'online',
    });
    const matching = (await listFleetHosts(request, 0, { status: 'online' })).filter((h) => matchingIds.has(h.id));
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
      await hostsList.filterTo({ platform: 'macOS', status: 'Online' });
      await hostsList.selectAllOnPage();
      await hostsList.selectAllMatchingButton.click();
      await hostsList.runScriptSelectedButton.click();

      const modal = hostsList.runScriptBatchModal;
      await expect(modal.summary).toContainText(`Run a script on ${matching.length.toLocaleString()} hosts`);
      await modal.runNow(scriptName, 'macOS and Linux');

      const batchId = await findBatchId(request, 0, scriptName);
      const summary = await waitForBatchFinished(request, batchId);
      // The built-in labels hold simulations of every platform here, so the
      // incompatible ones are those without orbit and those a shell script can't
      // run on.
      const incompatible = matching.filter(incompatibleWithShell).length;

      expect(summary.targeted).toBe(matching.length);
      expect(summary.ran + summary.errored + summary.pending + summary.incompatible + summary.canceled).toBe(
        summary.targeted,
      );
      expect(summary.incompatible, 'incompatible should be exactly the hosts that cannot run a .sh').toBe(incompatible);
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

test.describe('Premium • Controls • Batch progress', () => {
  test('a fleet with no batch runs shows each progress tab empty', async ({
    dashboard,
    controls,
    scriptsLibrary,
    scriptsBatchProgress,
  }) => {
    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToScripts();
    await scriptsLibrary.teamDropdown.select('Workstations');
    await scriptsLibrary.goToBatchProgress();

    await expect(scriptsBatchProgress.heading).toBeVisible();
    await expect(scriptsBatchProgress.teamDropdown.currentValue).toHaveText('Workstations');
    await expect(scriptsBatchProgress.startedTab).toHaveAttribute('aria-selected', 'true');
    const empty = [
      { tab: 'Started', info: 'Scripts running on multiple hosts will appear here.' },
      { tab: 'Scheduled', info: 'Scheduled scripts will appear here.' },
      { tab: 'Finished', info: 'Completed or canceled batch scripts will appear here.' },
    ] as const;
    for (const { tab, info } of empty) {
      await scriptsBatchProgress.openTab(tab);
      await expect(scriptsBatchProgress.emptyState(tab)).toBeVisible();
      await expect(scriptsBatchProgress.emptyStateInfo(info)).toBeVisible();
    }
    await scriptsBatchProgress.openTab('Started');
    await expect(scriptsBatchProgress.learnMoreLink).toBeVisible();
  });
});
