/**
 * Shared • Hosts • Running a script on a real host.
 *
 * Host details → Actions → Run script, end to end on the real VMs, asserting
 * what came back rather than that something was sent:
 *
 *   - **Effect** — the script changes something on the device, and a scheduled
 *     report run by that same device reads the change back. One flow covers
 *     script execution, the Run script modal, the host's Activity card, the
 *     dashboard feed and the host's stored report results.
 *   - **Failure** — a non-zero exit reads "Error" in the modal and "Script
 *     failed." with the recorded output in the details.
 *   - **Timeout** — Fleet kills a script that outlives the agent's
 *     `script_execution_timeout` and says so in the details.
 *   - **Interpreters** — zsh, bash, Python and PowerShell, one row each.
 *
 * Tier-agnostic: running a script is the same flow on free and premium. Scripts
 * are uploaded to whichever fleet the host is in — Unassigned on free, the VMs
 * fleet on premium — read off the host at run time.
 *
 * **Real VMs only.** osquery-perf simulations never execute a script, so a run
 * against one proves nothing. Each case resolves its host by platform through
 * `findOnlineHost(..., { kind: 'real' })`.
 *
 * ## Why the effect is a file hash read back by a report
 *
 * The script writes a per-run nonce to a per-run path in `/tmp`, and a seeded
 * 60-second report selects that file's SHA-256 from osquery's `hash` table. The
 * report's stored row has to equal the hash of *this run's* nonce, so a file
 * left behind by an earlier run can't satisfy it. The file is a few bytes in a
 * temp directory, overwritten on every run, and removed afterwards by an ad-hoc
 * script — the VM is left as it was.
 *
 * A 60-second interval lands the first stored row on the VM in about a minute
 * (measured at 66 s). The report is team-scoped to the host's fleet on premium
 * so only the VMs run it; on free it is global and the cleanup project would
 * sweep it if this test died before its `finally`.
 *
 * ## Why the timeout case writes agent options
 *
 * Fleet's default script timeout is 300 s, and a host runs its scripts one at a
 * time — a script that sat out the default would hold every other spec's script
 * on that VM for five minutes. The case lowers `script_execution_timeout` to 60 s
 * on the host's fleet (global agent options on free), and restores the snapshot
 * in a `finally`. The value reaches the host in the same orbit config poll that
 * delivers the pending script, so the new limit is in force for the run. While
 * lowered it also caps software uninstalls on those hosts, which all finish well
 * inside 60 s.
 */
import * as crypto from 'crypto';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  createReport,
  deleteReport,
  deleteScript,
  findOnlineHost,
  getAgentOptions,
  getHostFleetId,
  getHostReportRows,
  getHostScriptLastExecution,
  queueAdHocScript,
  setAgentOptions,
  uploadScript,
  type ScriptExecutionStatus,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';
import type { HostDetailsPage } from '@pages';

type Platform = 'darwin' | 'windows' | 'linux';

interface RealHost {
  id: number;
  displayName: string;
  /** The host's fleet id, or 0 for Unassigned — every host on free. */
  fleetId: number;
}

async function realHost(request: APIRequestContext, platform: Platform): Promise<RealHost> {
  const host = await findOnlineHost(request, platform, { kind: 'real' });
  if (!host) {
    throw new Error(
      `no online real ${platform} VM on ${process.env.FLEET_URL} — scripts only run on a real ` +
        `device. Check the ${platform} VM is powered on and enrolled.`,
    );
  }
  return { id: host.id, displayName: host.displayName, fleetId: (await getHostFleetId(request, host.id)) ?? 0 };
}

/** Short and unique per run, so script and report names never collide with a leftover. */
const nonce = (): string => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

/**
 * Waits for the host to finish the script and report back. The host picks a
 * script up on its next check-in and a shared VM may be working through another
 * spec's queue first, so the budget is generous.
 */
async function waitForScriptToFinish(
  request: APIRequestContext,
  host: RealHost,
  scriptName: string,
  expected: ScriptExecutionStatus,
  timeout = 180_000,
): Promise<void> {
  await expect
    .poll(async () => (await getHostScriptLastExecution(request, host.id, scriptName))?.status, {
      message: `${scriptName} never finished on ${host.displayName}`,
      timeout,
      intervals: [3_000],
    })
    .toBe(expected);
}

/**
 * Runs a library script from the host's Run script modal and waits for the
 * result. The modal only refetches its list after its own actions, so it is
 * reopened once the run has finished to read the settled status.
 */
async function runFromModal(
  hostDetails: HostDetailsPage,
  request: APIRequestContext,
  host: RealHost,
  scriptName: string,
  expected: ScriptExecutionStatus,
  timeout?: number,
): Promise<void> {
  await hostDetails.goto(host.id);
  await hostDetails.openRunScript();
  // Never run on this host: the script name is new on every run.
  await expect(hostDetails.runScriptModal.status(scriptName)).toHaveText('---');

  await hostDetails.runScriptModal.run(scriptName, host.displayName);
  await waitForScriptToFinish(request, host, scriptName, expected, timeout);

  await hostDetails.runScriptModal.close();
  await hostDetails.openRunScript();
}

test.describe('Shared • Hosts • Run script', () => {
  test('a script changes the host, and a report run by that host reads the change back', async ({
    hostDetails,
    dashboard,
    request,
  }) => {
    // Upload → run → one scheduled report interval, plus a busy VM's queue.
    test.setTimeout(420_000);

    const host = await realHost(request, 'darwin');
    const id = nonce();
    // Named per run, so concurrent copies of this test on one VM (as
    // --repeat-each makes) never read each other's file.
    const marker = `/tmp/fleet-playwright-run-script-${id}`;
    const scriptName = `pw-run-script-effect-${id}.sh`;
    const expectedHash = crypto.createHash('sha256').update(id).digest('hex');

    // Seeded first so the report's schedule is already counting down by the
    // time the script has run.
    const report = await createReport(request, {
      name: `pw-run-script-effect-${id}`,
      query: `SELECT sha256 FROM hash WHERE path = '${marker}';`,
      platform: 'darwin',
      interval: 60,
      ...(host.fleetId ? { teamId: host.fleetId } : {}),
    });
    const scriptId = await uploadScript(
      request,
      host.fleetId,
      scriptName,
      `#!/bin/sh\nprintf '%s' '${id}' > ${marker}\necho "wrote ${id}"\n`,
    );

    try {
      await runFromModal(hostDetails, request, host, scriptName, 'ran');
      const modal = hostDetails.runScriptModal;
      const details = hostDetails.scriptDetailsModal;

      await expect(modal.status(scriptName)).toHaveText('Ran');
      await modal.showRunDetails(scriptName);
      await details.expectOpen();
      await expect(details.statusMessage).toHaveText('Exit code: 0 (Script ran successfully.)');
      await expect(details.output).toHaveText(`wrote ${id}`);
      await details.close();

      // Closing the details leaves the row on the run's real status rather than
      // reverting it to "Pending".
      await expect(modal.status(scriptName)).toHaveText('Ran');
      await modal.close();

      // The host's own Activity card, on a fresh load.
      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      await hostDetails.activityItem(activityCopy.script.ranOnThisHost({ name: scriptName })).click();
      await details.expectOpen();
      await expect(details.output).toHaveText(`wrote ${id}`);
      await details.close();

      // The dashboard feed names the host instead.
      await dashboard.goto();
      await dashboard.expectActivity(
        activityCopy.script.ran({ name: scriptName, host: host.displayName }),
      );

      // The device's own answer: its scheduled run of the report stored the
      // hash of the file this run's script wrote.
      await expect
        .poll(async () => (await getHostReportRows(request, host.id, report.id))[0]?.sha256, {
          message: `${report.name} never stored this run's marker hash for ${host.displayName}`,
          timeout: 240_000,
          intervals: [5_000],
        })
        .toBe(expectedHash);

      await hostDetails.goto(host.id);
      await hostDetails.openReportsTab();
      await hostDetails.searchReports(report.name);
      await expect(hostDetails.reportCard(report.name)).toBeVisible();
      expect(await hostDetails.reportCardFirstResult(report.name)).toEqual({ sha256: expectedHash });
    } finally {
      await deleteScript(request, scriptId);
      await deleteReport(request, report.id);
      await queueAdHocScript(request, host.id, `#!/bin/sh\nrm -f ${marker}\n`);
    }
  });

  test('a script that exits non-zero reads as an error, with the output it recorded', async ({
    hostDetails,
    request,
  }) => {
    test.setTimeout(300_000);

    const host = await realHost(request, 'linux');
    const id = nonce();
    const scriptName = `pw-run-script-fails-${id}.sh`;
    const scriptId = await uploadScript(
      request,
      host.fleetId,
      scriptName,
      `#!/bin/bash\necho "failing on purpose ${id}"\nexit 3\n`,
    );

    try {
      await runFromModal(hostDetails, request, host, scriptName, 'error');
      const modal = hostDetails.runScriptModal;
      const details = hostDetails.scriptDetailsModal;

      await expect(modal.status(scriptName)).toHaveText('Error');
      await modal.showRunDetails(scriptName);
      await details.expectOpen();
      await expect(details.statusMessage).toHaveText('Exit code: 3 (Script failed.)');
      // Orbit appends its own line naming the exit status to whatever the script printed.
      await expect(details.output).toHaveText(
        `failing on purpose ${id} script execution error: exit status 3`,
      );
      await details.close();
      await modal.close();

      // A failed run is still a run: the Activity card lists it and opens the
      // same failure.
      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      await hostDetails.activityItem(activityCopy.script.ranOnThisHost({ name: scriptName })).click();
      await details.expectOpen();
      await expect(details.statusMessage).toHaveText('Exit code: 3 (Script failed.)');
      await details.close();
    } finally {
      await deleteScript(request, scriptId);
    }
  });

  test('a script that outlives the agent timeout is stopped, and the details say why', async ({
    hostDetails,
    request,
  }) => {
    test.setTimeout(360_000);
    const timeoutSeconds = 60;

    const host = await realHost(request, 'linux');
    const id = nonce();
    const scriptName = `pw-run-script-timeout-${id}.sh`;
    // The snapshot this test restores. A value equal to its own override can only
    // have been left by another run of this test — one that died before its
    // `finally`, or a concurrent copy under --repeat-each — so it is dropped
    // rather than restored, which would strand the lowered timeout.
    const { script_execution_timeout: current, ...rest } = await getAgentOptions(request, host.fleetId);
    const agentOptions = current === timeoutSeconds ? rest : { ...rest, script_execution_timeout: current };
    const scriptId = await uploadScript(
      request,
      host.fleetId,
      scriptName,
      `#!/bin/bash\necho "started ${id}"\nsleep ${timeoutSeconds * 3}\necho "finished ${id}"\n`,
    );

    try {
      await setAgentOptions(
        request,
        { ...agentOptions, script_execution_timeout: timeoutSeconds },
        host.fleetId,
      );

      await runFromModal(hostDetails, request, host, scriptName, 'error', 240_000);
      const details = hostDetails.scriptDetailsModal;

      await expect(hostDetails.runScriptModal.status(scriptName)).toHaveText('Error');
      await hostDetails.runScriptModal.showRunDetails(scriptName);
      await details.expectOpen();
      // `RunScriptDetailsModal` fills in "after N seconds" only when it finds that
      // phrase in the script's *output* — never from the configured timeout — so
      // for a script that doesn't print it the line carries no duration. This
      // script's output is kept free of "seconds" so the copy stays fixed.
      // TODO(fleetdm/fleet#54262): once the modal reads the server's message,
      // this line reads "…after 60 seconds…" — assert `timeoutSeconds` in it.
      await expect(details.statusMessage).toHaveText(
        'Error: Timeout. Fleet stopped the script to protect host performance.',
      );
      // Killed mid-run: what it printed before the sleep was kept, what came
      // after never ran, and orbit records the kill.
      await expect(details.output).toHaveText(
        `started ${id} script execution error: signal: killed`,
      );
    } finally {
      await setAgentOptions(request, agentOptions, host.fleetId);
      await deleteScript(request, scriptId);
    }
  });

  /**
   * One row per interpreter Fleet runs. Each script prints the interpreter's own
   * version, so the output proves which one ran rather than only that something
   * exited 0.
   *
   * Python runs on Linux: the macOS VMs have no Xcode Command Line Tools, so
   * their `/usr/bin/python3` is Apple's install-prompt stub and exits non-zero.
   */
  const interpreters: Array<{
    label: string;
    platform: Platform;
    extension: '.sh' | '.py' | '.ps1';
    content: string;
    output: RegExp;
  }> = [
    {
      label: 'zsh',
      platform: 'darwin',
      extension: '.sh',
      content: '#!/bin/zsh\necho "zsh $ZSH_VERSION"\n',
      output: /^zsh \d+\.\d+/,
    },
    {
      label: 'bash',
      platform: 'linux',
      extension: '.sh',
      content: '#!/bin/bash\necho "bash $BASH_VERSION"\n',
      output: /^bash \d+\.\d+/,
    },
    {
      label: 'Python',
      platform: 'linux',
      extension: '.py',
      content:
        '#!/usr/bin/env python3\nimport sys\nprint(f"python {sys.version_info.major}.{sys.version_info.minor}")\n',
      output: /^python 3\.\d+/,
    },
    {
      label: 'PowerShell',
      platform: 'windows',
      extension: '.ps1',
      content: 'Write-Output "powershell $($PSVersionTable.PSVersion)"\n',
      output: /^powershell \d+\.\d+/,
    },
  ];

  for (const interpreter of interpreters) {
    test(`a ${interpreter.label} script runs under ${interpreter.label}`, async ({
      hostDetails,
      request,
    }) => {
      test.setTimeout(300_000);

      const host = await realHost(request, interpreter.platform);
      const scriptName = `pw-run-script-${interpreter.label.toLowerCase()}-${nonce()}${interpreter.extension}`;
      const scriptId = await uploadScript(request, host.fleetId, scriptName, interpreter.content);

      try {
        await runFromModal(hostDetails, request, host, scriptName, 'ran');
        const details = hostDetails.scriptDetailsModal;

        await expect(hostDetails.runScriptModal.status(scriptName)).toHaveText('Ran');
        await hostDetails.runScriptModal.showRunDetails(scriptName);
        await details.expectOpen();
        await expect(details.statusMessage).toHaveText('Exit code: 0 (Script ran successfully.)');
        await expect(details.output).toHaveText(interpreter.output);
      } finally {
        await deleteScript(request, scriptId);
      }
    });
  }
});
