/**
 * Shared • Controls • a batch script run scheduled, cancelled, and cut short by
 * an edit: Schedule for later, Cancel, the hosts and counts after a cancel,
 * previewing a batch's script, and an edit cancelling the runs not yet reported.
 *
 * Both tiers: batch scripts carry no license check, and every batch here targets
 * osquery-perf simulations on Unassigned picked by id from this spec's claimed
 * slices (`findSimulations` linux 10–19 and darwin 10–39, see
 * `helpers/api/hosts.ts`), never through "Select all matching", so on free,
 * where the real VMs sit in Unassigned, no batch can reach one (the pickers
 * exclude real hosts). A batch fails outright if any host has left the script's
 * fleet, which is why the hosts come from slices no other spec moves.
 *
 *  - **Scheduled, then cancelled** (linux 10–12; nothing runs). A batch scheduled for
 *    tomorrow lists every targeted host under Pending (incompatibility is only
 *    decided at start), and cancelling it finishes it at once with all of them
 *    under Canceled ("the hosts that were Pending are now Canceled"),
 *    without racing a host to its result. Its script is previewed while
 *    scheduled and again once finished, the same button and modal Fleet shows
 *    in every state. Scheduled through the API: the schedule form is the next
 *    test's.
 *  - **Scheduled from the Hosts list, then started** (the first orbit host in
 *    linux 13–19). The form's UTC date and time are stored as typed, and Fleet's
 *    2-minute `scheduled_batch_activities` worker starts the batch: a time 1–2
 *    minutes ahead starts within about 4. The start is awaited through the API at
 *    a 2-second interval, then the Started tab is read at once. The host reports
 *    within about 35 s, and the 5-minute completion check would move the batch
 *    to Finished only after that, so the read lands while it's still Started.
 *  - **Edited mid-run** (the orbit hosts in darwin 10–39, about 15 per tier).
 *    They must have nothing queued ahead of this batch, which rules out every
 *    host in the built-in macOS label: `batch-run.spec.ts`'s scale test runs a
 *    batch on all of that label's online hosts on Unassigned, and on these
 *    instances the label holds the *Ubuntu* simulations (osquery-perf's answer
 *    to its query), so the Linux slice is out and any member is filtered off.
 *    The batch starts through the API with the Library already open, and
 *    the script is edited at once. Each simulation polls every 30 s and "runs"
 *    0–4 s, so the hosts that haven't reported when the edit lands (nearly all
 *    of them, a couple of seconds in) are cancelled: at least one is, none is
 *    left Pending, those are among the targeted hosts, and the counts add up. The batch's eventual
 *    "Completed" is the 5-minute completion check, which `batch-run.spec.ts`
 *    already waits for. A run still queued behind another activity when its
 *    script is edited stays Pending forever (fleetdm/fleet#54732), which is why
 *    nothing may be queued ahead. An edit cancels only runs that are queued or
 *    sent with no result yet: a *scheduled* batch that hasn't started is left
 *    alone, and runs the new content when it fires.
 *
 * Each test removes its script in an `afterEach`, which deletes its batches
 * with it (a foreign-key cascade): a scheduled batch left by a timed-out test
 * would otherwise still fire at its time.
 *
 * `--repeat-each` this spec on one worker (`--workers=1`). Two copies of a test
 * at once share its hosts, so one copy's batch queues behind the other's, and
 * the edit test then trips over #54732 instead of testing anything.
 */
import * as crypto from 'crypto';
import { test, expect } from '@fixtures';
import {
  deleteScript,
  findBatchId,
  findScriptableSimulations,
  findSimulations,
  getBatchSummary,
  getLabelId,
  listBatchHostIds,
  listLabelHostIds,
  listFleetHosts,
  runScriptBatch,
  uploadScript,
} from '@helpers/api';

const nonce = (): string => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
/** Ascending, numerically for ids and by code point for names. */
const sorted = <T extends number | string>(xs: T[]): T[] => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

test.describe('Shared • Controls • Batch script schedule and cancel', () => {
  /** Scripts the running test uploaded; the `afterEach` deletes them, and their batches with them. */
  let created: number[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of created) await deleteScript(request, id);
    created = [];
  });

  test('a batch scheduled for tomorrow lists its hosts as Pending, and cancelling it moves every one to Canceled', async ({
    dashboard,
    controls,
    scriptsLibrary,
    scriptsBatchProgress,
    scriptBatchDetails,
    request,
  }) => {
    const ids = await findSimulations(request, 'linux', 3, 10);
    const hosts = (await listFleetHosts(request, 0, { status: 'online' })).filter((h) => ids.includes(h.id));
    expect(hosts, 'the claimed simulations should be online on Unassigned').toHaveLength(3);
    const names = sorted(hosts.map((h) => h.displayName));

    const scriptName = `pw-batch-cancel-${nonce()}.sh`;
    const content = '#!/bin/sh\necho "cancelled before its time, so this never runs"\n';
    const scriptId = await uploadScript(request, 0, scriptName, content);
    created.push(scriptId);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const batchId = await runScriptBatch(request, scriptId, ids, { notBefore: tomorrow });

    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToScripts();
    await scriptsLibrary.teamDropdown.select('Unassigned');
    await scriptsLibrary.goToBatchProgress();
    await expect(scriptsBatchProgress.heading).toBeVisible();
    await scriptsBatchProgress.openTab('Scheduled');
    await expect(scriptsBatchProgress.batch(scriptName)).toContainText('Will start');
    await scriptsBatchProgress.batch(scriptName).click();

    await expect(scriptBatchDetails.heading).toHaveText(scriptName);
    await expect(scriptBatchDetails.summary).toHaveText('3 hosts targeted (0% responded)');
    await scriptBatchDetails.openTab('Pending');
    await expect(scriptBatchDetails.tab('Pending')).toHaveAccessibleName('Pending 3');
    await expect(scriptBatchDetails.tabHostCount).toHaveText('3 hosts');
    expect(sorted(await scriptBatchDetails.hostNames())).toEqual(names);

    const scheduledPreview = await scriptBatchDetails.showScript();
    await scheduledPreview.expectContent(content);
    await scheduledPreview.close();

    await scriptBatchDetails.openCancel();
    await expect(scriptBatchDetails.cancelModal).toContainText(
      `This will cancel any pending script runs for ${scriptName}.`,
    );
    await scriptBatchDetails.confirmCancel();
    expect(await getBatchSummary(request, batchId)).toMatchObject({
      status: 'finished',
      batchCanceled: true,
      targeted: 3,
      ran: 0,
      errored: 0,
      pending: 0,
      incompatible: 0,
      canceled: 3,
    });
    expect(sorted(await listBatchHostIds(request, batchId, 'canceled'))).toEqual(sorted(ids));

    // The cancel returns to Batch progress; the batch now reads Canceled under Finished.
    await scriptsBatchProgress.teamDropdown.select('Unassigned');
    await scriptsBatchProgress.openTab('Finished');
    await expect(scriptsBatchProgress.batch(scriptName)).toContainText('Canceled');
    await scriptsBatchProgress.batch(scriptName).click();

    await expect(scriptBatchDetails.heading).toHaveText(scriptName);
    await expect(scriptBatchDetails.cancelButton).toBeHidden();
    await scriptBatchDetails.openTab('Canceled');
    await expect(scriptBatchDetails.tab('Canceled')).toHaveAccessibleName('Canceled 3');
    await expect(scriptBatchDetails.tabHostCount).toHaveText('3 hosts');
    expect(sorted(await scriptBatchDetails.hostNames())).toEqual(names);
    await scriptBatchDetails.openTab('Pending');
    await expect(scriptBatchDetails.tab('Pending')).toHaveAccessibleName('Pending');
    await expect(scriptBatchDetails.emptyTab).toBeVisible();

    const finishedPreview = await scriptBatchDetails.showScript();
    await finishedPreview.expectContent(content);
    await finishedPreview.close();
  });

  test('a script scheduled from the Hosts list is stored for the UTC time typed, and starts then', async ({
    dashboard,
    hostsList,
    scriptsBatchProgress,
    request,
    page,
  }) => {
    // Up to 2 minutes to the scheduled time, up to 2 more for the worker to start it.
    test.setTimeout(420_000);

    const [host] = await findScriptableSimulations(request, 'linux', 7, 13);
    expect(host, 'no orbit simulation online on Unassigned in linux 13–19').toBeTruthy();

    const scriptName = `pw-batch-sched-${nonce()}.sh`;
    created.push(await uploadScript(request, 0, scriptName, '#!/bin/sh\necho scheduled\n'));

    // The next whole minute but one: 1–2 minutes ahead, so still in the future when Run is clicked.
    const at = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 120_000);
    const [date, time] = [at.toISOString().slice(0, 10), at.toISOString().slice(11, 16)];

    await dashboard.goto();
    await dashboard.navbar.goToHosts();
    await hostsList.teamDropdown.select('Unassigned');
    await hostsList.searchFor(host.displayName);
    await hostsList.hostCheckbox(host.displayName).check();
    await hostsList.runScriptSelectedButton.click();

    const modal = hostsList.runScriptBatchModal;
    await expect(modal.summary).toContainText('Run a script on 1 host');
    await modal.pickScript(scriptName, 'macOS and Linux');
    await modal.chooseSchedule();
    await modal.submitSchedule(date, time);
    await modal.showSchedule();

    await expect(scriptsBatchProgress.scheduledTab).toHaveAttribute('aria-selected', 'true');
    await expect(scriptsBatchProgress.batch(scriptName)).toContainText('Will start');
    const batchId = await findBatchId(request, 0, scriptName);
    const scheduled = await getBatchSummary(request, batchId);
    expect(scheduled.status).toBe('scheduled');
    expect(Date.parse(scheduled.notBefore ?? ''), `stored not_before ${scheduled.notBefore}`).toBe(at.getTime());

    await expect
      .poll(async () => (await getBatchSummary(request, batchId)).status, {
        message: `batch ${batchId} never started`,
        timeout: 330_000,
        intervals: [2_000],
      })
      .toBe('started');
    await page.reload();
    await scriptsBatchProgress.openTab('Started');
    await expect(scriptsBatchProgress.batch(scriptName)).toContainText('/ 1 hosts');
  });

  test('editing a script mid-run cancels the runs not yet reported', async ({
    dashboard,
    controls,
    scriptsLibrary,
    scriptsBatchProgress,
    scriptBatchDetails,
    request,
    page,
  }) => {
    // Off the macOS label's hosts, which batch-run's scale test may have a run
    // queued on: a run still queued behind another activity when its script is
    // edited stays Pending forever. TODO(fleetdm/fleet#54732): once fixed, any
    // claimed hosts will do.
    const inScaleBatch = await listLabelHostIds(request, await getLabelId(request, 'macOS'), {
      fleetId: 0,
      status: 'online',
    });
    const hosts = (await findScriptableSimulations(request, 'darwin', 30, 10)).filter((h) => !inScaleBatch.has(h.id));
    expect(hosts.length, 'too few orbit simulations in darwin 10–39 outside the macOS label').toBeGreaterThanOrEqual(5);
    const ids = hosts.map((h) => h.id);

    const scriptName = `pw-batch-edit-${nonce()}.sh`;
    const scriptId = await uploadScript(request, 0, scriptName, '#!/bin/sh\necho before\n');
    created.push(scriptId);

    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToScripts();
    await scriptsLibrary.teamDropdown.select('Unassigned');
    await expect(scriptsLibrary.itemByName(scriptName)).toBeVisible();

    // The edit has to land while the hosts are still between polls, so the batch
    // starts only once the Library is open, and the edit follows at once.
    const batchId = await runScriptBatch(request, scriptId, ids);
    await scriptsLibrary.stageEdit(scriptName, '#!/bin/sh\necho after\n');
    await expect(scriptsLibrary.warningModal).toContainText(
      `The changes you are making will cancel any pending script runs for ${scriptName}.`,
    );
    await expect(scriptsLibrary.warningModal).toContainText(
      "If this script is currently running on a host, it will complete, but results won't appear in Fleet.",
    );
    await scriptsLibrary.confirmEdit();

    const summary = await getBatchSummary(request, batchId);
    expect(summary.targeted).toBe(ids.length);
    expect(summary.canceled, 'the edit cancelled no run').toBeGreaterThan(0);
    // Every run without a result is cancelled, not only some: the hosts had
    // nothing queued ahead, so each run was already activated (see #54732).
    expect(summary.pending, 'a run the edit should have cancelled is still pending').toBe(0);
    expect(summary.ran + summary.errored + summary.pending + summary.incompatible + summary.canceled).toBe(
      summary.targeted,
    );

    await scriptsLibrary.goToBatchProgress();
    await expect(scriptsBatchProgress.startedTab).toHaveAttribute('aria-selected', 'true');
    await scriptsBatchProgress.batch(scriptName).click();
    await expect(scriptBatchDetails.heading).toHaveText(scriptName);

    // A host that was running the script when the edit landed still reports a
    // few seconds later, and Fleet then counts it under Ran or Errored instead
    // of Canceled (yet lists it under neither), so the cancelled set can shrink
    // after the read above. The Canceled tab is held to the API's cancelled
    // hosts as they stand when the tab is read: its count and its hosts, all
    // among the targeted ones. TODO(fleetdm/fleet#54734): once fixed, compare
    // the tab with the cancelled hosts read right after the edit.
    let reads = 0;
    await expect(async () => {
      if (reads++ > 0) {
        await page.reload();
        await expect(scriptBatchDetails.heading).toHaveText(scriptName);
      }
      await scriptBatchDetails.openTab('Canceled');
      const canceledIds = await listBatchHostIds(request, batchId, 'canceled');
      expect(canceledIds.length, 'no host is listed as cancelled').toBeGreaterThan(0);
      expect(ids, 'a cancelled host the batch never targeted').toEqual(expect.arrayContaining(canceledIds));
      await expect(scriptBatchDetails.tab('Canceled')).toHaveAccessibleName(`Canceled ${canceledIds.length}`, {
        timeout: 3_000,
      });
      const canceledNames = new Set(hosts.filter((h) => canceledIds.includes(h.id)).map((h) => h.displayName));
      expect(new Set(await scriptBatchDetails.hostNames())).toEqual(canceledNames);
    }).toPass({ timeout: 30_000 });
  });
});
