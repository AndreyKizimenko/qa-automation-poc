/**
 * fleetctl run-script — a script run on a real host from the command line, on each platform.
 *
 * `fleetctl run-script --script-path <file> --host <hostname>` sends the file's contents as an ad-hoc script
 * (no library entry), waits for the host's answer and prints it: `Exit code: 0 (Script ran successfully.)` or
 * `Exit code: N (Script failed.)`, then the script's output between two rules (`renderScriptResult` in
 * `cmd/fleetctl/fleetctl/scripts.go`). fleetctl itself exits 0 either way: only a request it can't make (an
 * offline, unknown or forbidden host) is a non-zero exit, so the printed exit code is what tells a failed script
 * from a passing one.
 *
 * Each platform's pool VM runs two scripts, one after the other: one that prints a marker and exits 0, one that
 * prints another and exits 3 (`sh` on macOS and Linux, PowerShell on Windows). Each run is then found in Fleet's
 * record of the host: a `ran_script` activity with no script name, which is what an ad-hoc run logs, whose
 * execution holds the marker and the exit code. It is matched by its marker rather than by being newest, since
 * other workers run scripts on the same VMs. Its rendering in the host's Activity card is
 * `shared/hosts/host-run-script.spec.ts`'s.
 *
 * Real VMs only: an osquery-perf simulation answers every script with random output and a random exit code. The
 * scripts only `echo` (premium's firewall refuses realistic script bodies) and leave nothing on the host. Shared:
 * free runs scripts the same way, on the VMs it keeps in Unassigned.
 *
 * Takes the release checklist's "run a script on all host types from the CLI" (`docs/release-smokes-plan.md`).
 */
import * as fs from 'fs';
import { apiTest as test, expect, HOST_RETRIES } from '@fixtures';
import {
  getHostMdmIdentity,
  getScriptResult,
  latestActivityId,
  listHostActivities,
  requireRealHost,
  vmTag,
} from '@helpers/api';
import { fleetctl, output } from '@helpers/fleetctl';
import { ownName } from '@helpers/own-name';

const SCRIPT_KINDS = {
  sh: { extension: '.sh', body: (marker: string, exitCode: number) => `#!/bin/sh\necho "${marker}"\nexit ${exitCode}\n` },
  ps1: { extension: '.ps1', body: (marker: string, exitCode: number) => `Write-Output "${marker}"\nexit ${exitCode}\n` },
} as const;

const PLATFORMS = [
  { platform: 'darwin', kind: SCRIPT_KINDS.sh },
  { platform: 'linux', kind: SCRIPT_KINDS.sh },
  { platform: 'windows', kind: SCRIPT_KINDS.ps1 },
] as const;

/** What fleetctl prints for an exit code (`renderScriptResult`). */
const RESULT_LINE: Record<number, string> = {
  0: 'Exit code: 0 (Script ran successfully.)',
  3: 'Exit code: 3 (Script failed.)',
};

test.describe('Shared • fleetctl run-script on a real host', () => {
  // Each run waits for the VM's queue as well as the script: an install another worker queued goes first.
  test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES });

  for (const { platform, kind } of PLATFORMS) {
    // eslint-disable-next-line playwright/valid-test-tags -- the tag is the platform's VM, from vmTag()
    test(`on the ${platform} VM, a passing and a failing script each print their exit code and output`, { tag: vmTag(platform) }, async ({
      request,
    }, testInfo) => {
      const host = await requireRealHost(request, platform);
      const { hostname } = await getHostMdmIdentity(request, host.id);
      expect(hostname, `${host.displayName} reports no hostname for --host`).not.toBe('');

      for (const exitCode of [0, 3]) {
        await test.step(`a script that exits ${exitCode}`, async () => {
          const marker = `${ownName('cli-run-script')}-exits-${exitCode}`;
          const scriptPath = testInfo.outputPath(`exits-${exitCode}${kind.extension}`);
          fs.writeFileSync(scriptPath, kind.body(marker, exitCode));
          const since = await latestActivityId(request);

          const res = await fleetctl(['run-script', '--script-path', scriptPath, '--host', hostname]);
          expect(res.code, output(res)).toBe(0);
          expect(res.stdout, output(res)).toContain(RESULT_LINE[exitCode]);
          expect(res.stdout, output(res)).toContain(marker);

          // Fleet's record of the run: this host's newest ad-hoc runs since the baseline, one of them this
          // script's, by its marker.
          let executionId: string | undefined;
          await expect
            .poll(
              async () => {
                const runs = (await listHostActivities(request, host.id)).filter(
                  (a) => a.id > since && a.type === 'ran_script' && !a.details.script_name,
                );
                for (const run of runs) {
                  const id = typeof run.details.script_execution_id === 'string' ? run.details.script_execution_id : '';
                  if (id && (await getScriptResult(request, id)).output.includes(marker)) {
                    executionId = id;
                    break;
                  }
                }
                return executionId;
              },
              { message: `no ad-hoc run on ${host.displayName} with ${marker}`, timeout: 60_000, intervals: [3_000] },
            )
            .toBeDefined();
          expect((await getScriptResult(request, executionId!)).exitCode).toBe(exitCode);
        });
      }
    });
  }
});
