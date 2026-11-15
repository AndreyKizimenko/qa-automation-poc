/**
 * Shared • Hosts • A script that outlives the agent's timeout (exclusive project).
 *
 * Host details → Actions → Run script, on a real Linux VM: Fleet kills a script
 * that runs past the agent's `script_execution_timeout`, and the run's details
 * say so. The other outcomes of a run (an effect read back, a non-zero exit,
 * each interpreter) are `shared/hosts/host-run-script.spec.ts`'s.
 *
 * **Why it writes agent options.** Fleet's default script timeout is 300 s, and
 * a host runs its scripts one at a time: a script that sat out the default would
 * hold that VM's queue for five minutes. The test lowers
 * `script_execution_timeout` to 60 s and restores the snapshot afterwards. The
 * value reaches the host in the same orbit config poll that delivers the
 * pending script, so the new limit is in force for the run.
 *
 * **Why it runs in the exclusive project.** Agent options belong to a fleet, not
 * to a host: the lowered timeout reaches every VM on the VMs fleet (on free the
 * options are global, so every host there), and it also caps their software
 * uninstalls. In the main project that is another worker's VM, mid-test. The
 * `premium-exclusive` / `free-exclusive` projects run this on one worker after
 * the main project has finished, when nothing else is using a VM. A run killed
 * while the timeout is lowered is healed by the cleanup's resting-state step,
 * which resets it to Fleet's default.
 *
 * **Real VMs only.** An osquery-perf simulation never executes a script.
 *
 * Tier-agnostic: the script is uploaded to whichever fleet the host is in —
 * Unassigned on free, the VMs fleet on premium — read off the host at run time.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { getAgentOptions, getHostScriptLastExecution, requireRealHost, setAgentOptions } from '@helpers/api';
import { runNonce } from '@helpers/profiles';

const TIMEOUT_SECONDS = 60;

// One retry, like every test that waits on a real VM: two attempts at the budget
// below fit the exclusive step's 15 minutes on free, and three would not.
test.describe.configure({ retries: HOST_RETRIES });

test('a script that outlives the agent timeout is stopped, and the details say why', { tag: '@vm-linux' }, async ({
  hostDetails,
  request,
  seed,
  cleanup,
}) => {
  // Upload → the host's next check-in → the lowered timeout, plus the reads after it.
  test.setTimeout(300_000);

  const host = await requireRealHost(request, 'linux');
  // What the script prints before it sleeps: only this run's output carries it.
  const marker = runNonce();
  const script = await seed.script('run-script-timeout', {
    fleetId: host.fleetId,
    content: `#!/bin/bash\necho "started ${marker}"\nsleep ${TIMEOUT_SECONDS * 3}\necho "finished ${marker}"\n`,
  });

  // The snapshot this test restores. A value equal to its own override can only
  // have been left by a run of this test that died before its restore, so it is
  // dropped rather than restored, which would strand the lowered timeout.
  const { script_execution_timeout: current, ...rest } = await getAgentOptions(request, host.fleetId);
  const agentOptions = current === TIMEOUT_SECONDS ? rest : { ...rest, script_execution_timeout: current };
  cleanup.add('restore the script timeout', (r) => setAgentOptions(r, agentOptions, host.fleetId));

  await test.step('lower the timeout and run the script from the host', async () => {
    await setAgentOptions(request, { ...agentOptions, script_execution_timeout: TIMEOUT_SECONDS }, host.fleetId);

    await hostDetails.goto(host.id);
    await hostDetails.openRunScript();
    // Never run on this host: the script's name is new on every run.
    await expect(hostDetails.runScriptModal.status(script.name)).toHaveText('---');
    await hostDetails.runScriptModal.run(script.name, host.displayName);

    await expect
      .poll(async () => (await getHostScriptLastExecution(request, host.id, script.name))?.status, {
        message: `${script.name} was never stopped on ${host.displayName}`,
        timeout: 240_000,
        intervals: [3_000],
      })
      .toBe('error');
  });

  await test.step('the run reads as a timeout, with what the script printed before it was killed', async () => {
    // The modal refetches its list only after its own actions, so it is
    // reopened to read the settled status.
    await hostDetails.runScriptModal.close();
    await hostDetails.openRunScript();
    await expect(hostDetails.runScriptModal.status(script.name)).toHaveText('Error');

    const details = hostDetails.scriptDetailsModal;
    await hostDetails.runScriptModal.showRunDetails(script.name);
    await details.expectOpen();
    // `RunScriptDetailsModal` reads the duration from the server's message,
    // which names the timeout the host ran under: the lowered one.
    await expect(details.statusMessage).toHaveText(
      `Error: Timeout. Fleet stopped the script after ${TIMEOUT_SECONDS} seconds to protect host performance.`,
    );
    // Killed mid-run: what it printed before the sleep was kept, what came
    // after never ran, and orbit records the kill.
    await expect(details.output).toHaveText(`started ${marker} script execution error: signal: killed`);
  });
});
