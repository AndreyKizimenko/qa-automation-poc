/**
 * Premium • Policies • a policy's script automation runs, retries, and — with
 * continuous automations on — runs again on every failing result.
 *
 * One test, on the Ubuntu VM, in three steps:
 *
 *   1. **3 attempts.** A policy that can't pass (`SELECT 1 WHERE 0 > 1;`) runs a
 *      Python script that exits 3. The VM's first result for a new policy counts
 *      as newly failing, so Fleet runs the script, and retries a failed run while
 *      the policy is still failing for the host — 3 attempts in all
 *      (`MaxPolicyAutomationRetries`, attempts numbered from 1;
 *      `shouldRetryPolicyAutomationScript` in `server/service/orbit.go`). The
 *      host's Activity card opens the last attempt's failure.
 *   2. **Continuous off: nothing.** A refetch re-runs the host's policies; the
 *      policy fails again, but it was already failing, so nothing is queued.
 *   3. **Continuous on: 3 more.** Turned on in the row's Manage automations
 *      modal, every failing result fires the automation
 *      (`processScriptsForNewlyFailingPolicies`, `server/service/osquery.go`) and
 *      restarts the attempt count, so the next refetch brings a fresh run of 3.
 *      Without the restart it would be one.
 *
 * QA Wolf's flows — the two 3-attempt ones, the "retries every hour" one and
 * the Python-on-a-Mac one — read hours of accumulated history; the hour is only
 * osquery's policy update interval, and a refetch delivers a result at once.
 * Python runs on the Ubuntu VM because the Macs have no Command Line Tools.
 *
 * **Counting.** A ran_script activity carries the policy's id, and the policy is
 * made for the run, so every match is this run's. A run is settled when no
 * attempt of the script is queued: Fleet queues a retry in the same request
 * that records the failed attempt, so between attempts one is always pending.
 * "Nothing queued" after a refetch is read once the host's `policy_updated_at`
 * has moved, because Fleet queues a policy's automations before it records the
 * results that fired them.
 *
 * **Scope.** A policy on the VMs fleet would also reach the other VMs and any
 * simulation a label-targeting spec has borrowed onto the fleet, and
 * simulations answer policies at random. `platform: linux` and a manual label
 * holding only the Ubuntu VM keep it to the one host that runs scripts.
 * Everything is named `pw-auto-run-*` and removed in an `afterEach` — not a
 * `finally`, which a timed-out test skips: a continuous, never-passing script
 * policy left on the fleet would run its script on every refetch any spec asks
 * of the VM. The VMs sweep in `setup/cleanup.steps.ts` removes what a killed run
 * leaves, and the resting-state step cancels a queued attempt.
 *
 * **The hourly run.** Once continuous is on, the VM's own scheduled policy run
 * could start another 3 attempts — but only after the run under test has
 * settled (a pending attempt holds it off), and the count is read the moment it
 * settles.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { runNonce } from '@helpers/profiles';
import {
  cancelUpcomingActivity,
  createFleetPolicy,
  createManualLabel,
  deleteFleetPolicies,
  deleteLabelById,
  deleteScript,
  getFleetPolicy,
  getHostCollectedAt,
  getScriptResult,
  listHostActivities,
  listUpcomingActivities,
  requireRealHost,
  uploadScript,
  waitForHostRefetch,
  waitForNoPendingRefetch,
} from '@helpers/api';

const FAILING_EXIT_CODE = 3;

test.describe('Premium • Policies • automation runs', () => {
  // Six script runs (about a minute each) and three refetches (one to two
  // minutes each) on a VM whose one queue other specs share: 12.7 min measured
  // beside install-on-host's two installs, so 15 would be no margin.
  test.describe.configure({ timeout: 1_200_000, retries: HOST_RETRIES });

  /** What the test made — removed in the afterEach, which runs even when the test times out. */
  let made: { vmId?: number; policyId?: number; scriptId?: number; scriptName?: string; labelId?: number } = {};

  test.afterEach(async ({ request, vmsFleetId }) => {
    const { vmId, policyId, scriptId, scriptName, labelId } = made;
    made = {};
    // The policy first. With continuous automations on, every refetch any spec
    // asks of the Ubuntu VM would run the failing script three more times for as
    // long as the policy exists — a timed-out test's `finally` never runs, and
    // the VMs sweep only runs at the end of the project.
    if (policyId !== undefined) await deleteFleetPolicies(request, vmsFleetId, [policyId]);
    if (vmId !== undefined) {
      const queuedRuns = (await listUpcomingActivities(request, vmId)).filter((u) => u.scriptName === scriptName);
      for (const run of queuedRuns) await cancelUpcomingActivity(request, vmId, run.uuid);
    }
    if (scriptId !== undefined) await deleteScript(request, scriptId);
    if (labelId !== undefined) await deleteLabelById(request, labelId);
  });

  test('a failing script is tried 3 times, and a refetch runs it again only once continuous automations are on', async ({
    dashboard,
    policiesList,
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const vm = await requireRealHost(request, 'linux');
    expect(vm.fleetId, 'the Ubuntu VM must be on the VMs fleet').toBe(vmsFleetId);

    const n = runNonce();
    const name = `pw-auto-run-${n}`;
    const scriptName = `${name}.py`;
    const output = `pw policy automation ${n}: failing on purpose`;
    let policyId: number | undefined;
    made = { vmId: vm.id, scriptName };

    /** This policy's finished attempts, newest first. */
    const attempts = async () =>
      (await listHostActivities(request, vm.id, 100)).filter(
        (a) => a.type === 'ran_script' && a.details.policy_id === policyId,
      );
    const queued = async () => (await listUpcomingActivities(request, vm.id)).filter((u) => u.scriptName === scriptName);
    /** Waits until no attempt is queued, and returns how many have finished. */
    const settledAttempts = async (expected: number, timeout: number) => {
      let finished = -1;
      await expect
        .poll(
          async () => {
            if ((await queued()).length > 0) return -1;
            finished = (await attempts()).length;
            return finished;
          },
          { message: `${expected} finished attempts of ${scriptName}, none queued`, timeout, intervals: [10_000] },
        )
        .toBeGreaterThanOrEqual(expected);
      return finished;
    };
    /**
     * Refetches the VM and waits until policy results newer than now have
     * landed. Fleet reads the policy's settings when a result arrives, so any
     * result after the baseline answers the later steps, and they may merge into
     * a refetch another spec has outstanding. The first one may not: a collection
     * already in flight was sent before the policy existed, and would land
     * without it.
     */
    const refetchPolicies = async ({ includeNewPolicy = false } = {}) => {
      if (includeNewPolicy) await waitForNoPendingRefetch(request, vm.id);
      const since = await getHostCollectedAt(request, vm.id, 'policy_updated_at');
      await waitForHostRefetch(request, vm.id, { since, field: 'policy_updated_at', refetch: true });
    };
    const expectFailedRuns = async (runs: Awaited<ReturnType<typeof attempts>>) => {
      for (const run of runs) {
        expect(run.actorEmail, 'a policy automation runs as Fleet, not as a user').toBe('');
        const result = await getScriptResult(request, String(run.details.script_execution_id));
        expect(result.exitCode).toBe(FAILING_EXIT_CODE);
      }
    };

    made.labelId = await createManualLabel(request, name, [vm.id]);
    const scriptId = await uploadScript(
      request,
      vmsFleetId,
      scriptName,
      `#!/usr/bin/env python3\nimport sys\nprint("${output}")\nsys.exit(${FAILING_EXIT_CODE})\n`,
    );
    made.scriptId = scriptId;
    const policy = await createFleetPolicy(request, vmsFleetId, {
      name,
      query: 'SELECT 1 WHERE 0 > 1;',
      platform: 'linux',
      labels_include_any: [name],
      script_id: scriptId,
    });
    made.policyId = policyId = policy.id;
    expect(policy.runScript?.id).toBe(scriptId);
    expect(policy.continuousAutomationsEnabled).toBe(false);

    await test.step('the first failing result runs the script, and Fleet retries it to 3 attempts', async () => {
      await refetchPolicies({ includeNewPolicy: true });
      expect(await settledAttempts(3, 360_000)).toBe(3);
      await expectFailedRuns(await attempts());

      // The host's Activity card opens the latest attempt's failure.
      await hostDetails.goto(vm.id);
      await hostDetails.showPastActivities();
      await hostDetails
        .activityItem(new RegExp(`Fleet ${activityCopy.script.ranOnThisHost({ name: scriptName }).source}`))
        .first()
        .click();
      const details = hostDetails.scriptDetailsModal;
      await details.expectOpen();
      await expect(details.statusMessage).toHaveText(`Exit code: ${FAILING_EXIT_CODE} (Script failed.)`);
      // Orbit appends its own line naming the exit status to what the script printed.
      await expect(details.output).toHaveText(`${output} script execution error: exit status ${FAILING_EXIT_CODE}`);
      await details.close();
    });

    await test.step('with continuous automations off, a refetch of the still-failing policy queues nothing', async () => {
      await refetchPolicies();
      expect(await queued(), 'nothing queued for a policy that was already failing').toHaveLength(0);
      expect(await attempts()).toHaveLength(3);
    });

    await test.step('with continuous automations on, the next refetch runs a fresh 3 attempts', async () => {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.selectByLabel('VMs');
      await policiesList.openPolicyAutomations(name);
      await expect(policiesList.policyAutomations.checkbox('run_script')).toHaveAttribute('aria-checked', 'true');
      await expect(policiesList.policyAutomations.selectedValue('run_script')).toHaveText(scriptName);
      await policiesList.policyAutomations.setContinuous(true);
      await policiesList.savePolicyAutomations();
      await policiesList.toast.expectSuccess('Successfully updated policy automations.');
      expect((await getFleetPolicy(request, vmsFleetId, policy.id)).continuousAutomationsEnabled).toBe(true);

      await refetchPolicies();
      expect(await settledAttempts(6, 360_000)).toBe(6);
      await expectFailedRuns((await attempts()).slice(0, 3));
    });
  });
});
