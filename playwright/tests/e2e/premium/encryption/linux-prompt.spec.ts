/**
 * Premium • Disk encryption • Create key on each Linux desktop the lab encrypts, with nobody at the host.
 *
 * What *Create key* does differs by desktop and by fleetd, and that is where Linux escrow has broken
 * (fleetdm/fleet#52717, #54821, #55701, #58776). Each host here is asked once and left unanswered, which
 * changes nothing on its disk:
 *
 *   | host | what fleetd 1.63.0 does | what Fleet shows |
 *   |---|---|---|
 *   | Ubuntu 24.04 (the control), Zorin OS 18 | zenity's passphrase prompt, closed after a minute | Action required, before and after |
 *   | Kubuntu 24.04 | kdialog's, the same way | Action required |
 *   | Fedora 45, which ships no dialog tool | nothing it can show | Failed: "No supported dialog tool found" (fleetdm/fleet#58776) |
 *   | Omarchy, on fleetd below 1.64.0 | not asked: the server refuses the click | Failed, and My device says it couldn't |
 *
 * The prompt's evidence is fleetd's own log on the host (`fleetdEscrowLogScript`): fleetd 1.63.0 tells Fleet
 * nothing about a prompt nobody answers. A Failed host goes back to OS matrix, which clears the failure, the
 * one thing that does (fleetdm/fleet#54821: neither a click nor a timeout clears it). Each status is checked
 * on the host's Controls tab and in the fleet's Controls › OS settings › Disk encryption table, whose counts
 * are exact on a fleet of one host, and whose row lists it.
 *
 * **These are OS matrix hosts the per-OS smokes run on**, so the project never runs beside the smokes, and
 * each host is off OS matrix only for the length of its test. No host is given a package, a file or a key
 * slot: `prem-fedora45-luks` and `prem-omarchy-01` reproduce fleetdm/fleet#58776 by lacking a dialog tool,
 * and `prem-ubu2404-luks` is the unmodified control. The prompt left on an Ubuntu, Zorin or Kubuntu screen
 * closes itself.
 *
 * **On fleetd 1.63.0, clicking again queues another prompt.** Fleet's guard ("Fleet is already asking this
 * device…") rests on fleetd reporting the prompt open, which 1.63.0 doesn't, so on 2026-11-16 eleven clicks in
 * five minutes opened three prompts in a row on the control host. The test clicks once.
 *
 * Grounded in: `ee/server/service/devices.go` (`TriggerLinuxDiskEncryptionEscrow`, the refusals),
 * `orbit/pkg/luks/luks_linux.go` (the dialog tools, the timeout), `server/service/linux_mdm.go` (the
 * statuses), `DeviceUserPage.tsx` (the refused click's toast), `server/datastore/mysql/disk_encryption.go`
 * (the move back), and experiments 1 and 2 of `docs/device-lab-step-e-analysis.md`.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  compareVersions,
  findFleetByName,
  getHostAgentReport,
  getHostDiskEncryption,
  requireLabHost,
  runAdHocScript,
  setFleetDiskEncryption,
  transferHosts,
} from '@helpers/api';
import { fleetdEscrowLogScript } from '@helpers/disk-encryption';
import { labHostFleet, matrixHostOfRun, specialHostOfRun, type LabHost } from '@helpers/lab-hosts';
import { toastCopy } from '@helpers/toast-copy';

/** What fleetd does with the request, by the host and the fleetd it runs. */
type Outcome =
  | { kind: 'prompt'; program: 'zenity' | 'kdialog' }
  | { kind: 'failed'; detail: string }
  | { kind: 'refused'; detail: string };

interface Case {
  title: string;
  host: () => LabHost;
  outcome: (fleetdVersion: string) => Outcome;
}

/** fleetd's message when no dialog tool is installed (`orbit/pkg/luks/luks_linux.go`). */
const NO_DIALOG_TOOL = 'No supported dialog tool found';
/** The server's refusal of an Omarchy host on a fleetd too old for it (`ee/server/service/devices.go`). */
const FLEETD_TOO_OLD = 'Your version of fleetd does not support creating disk encryption keys on Linux';
/** The first fleetd that can open the passphrase dialog on Omarchy, and that the server lets Omarchy ask. */
const OMARCHY_FLEETD = '1.64.0';

const CASES: Case[] = [
  {
    title: 'Ubuntu 24.04, zenity',
    host: () => specialHostOfRun('LUKS key escrow control'),
    outcome: () => ({ kind: 'prompt', program: 'zenity' }),
  },
  { title: 'Zorin OS 18, zenity', host: () => matrixHostOfRun('zorin-18.1'), outcome: () => ({ kind: 'prompt', program: 'zenity' }) },
  { title: 'Kubuntu 24.04, kdialog', host: () => matrixHostOfRun('kubuntu-24.04'), outcome: () => ({ kind: 'prompt', program: 'kdialog' }) },
  {
    title: 'Fedora 45, no dialog tool',
    host: () => matrixHostOfRun('fedora-45'),
    // TODO(fleetdm/fleet#58776): what a stock Fedora should do instead is the fix's to say.
    outcome: () => ({ kind: 'failed', detail: NO_DIALOG_TOOL }),
  },
  {
    title: 'Omarchy, no dialog tool',
    host: () => matrixHostOfRun('omarchy-4.5'),
    outcome: (fleetd) =>
      compareVersions(fleetd, OMARCHY_FLEETD) < 0
        ? { kind: 'refused', detail: FLEETD_TOO_OLD }
        : { kind: 'failed', detail: NO_DIALOG_TOOL },
  },
];

test.describe('Premium • Disk encryption • Create key on each Linux desktop, unanswered', () => {
  // The host's queue, fleetd's check-in, a minute's prompt and the notice after it.
  test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES });

  for (const c of CASES) {
    test(`${c.title}: Fleet asks, and the host is as it was`, async ({
      hostDetails,
      diskEncryption,
      request,
      throwawayFleet,
      cleanup,
    }) => {
      const entry = c.host();
      const host = await requireLabHost(request, entry);
      const home = await findFleetByName(request, labHostFleet(entry)!);
      if (!home) throw new Error(`no fleet named ${labHostFleet(entry)} to return ${host.displayName} to`);
      const outcome = c.outcome((await getHostAgentReport(request, host.id)).orbitVersion);

      const fleet = await throwawayFleet('disk-encryption');
      await setFleetDiskEncryption(request, fleet.id, { linuxEscrowEnabled: true });
      cleanup.add(`return ${host.displayName} to ${home.name}`, (r) => transferHosts(r, home.id, [host.id]));
      await transferHosts(request, fleet.id, [host.id]);

      await test.step('on a fleet that escrows Linux keys, the host is Action required, its disk encrypted', async () => {
        await hostDetails.goto(host.id);
        await expect(hostDetails.vitalsDiskEncryption).toHaveText('On');
        await hostDetails.openControlsTab();
        await expect(hostDetails.controlRow('Disk encryption')).toContainText('Action required');
      });

      await test.step('Controls › Disk encryption: the fleet counts the host under Action required, and lists it', () =>
        diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: 'action_required', hostName: host.displayName }),
      );

      const clicked = new Date(Date.now() - 5_000);

      await test.step('My device: Create key', async () => {
        await hostDetails.goto(host.id);
        const device = await hostDetails.openMyDevice();
        await expect(device.createKeyBanner).toBeVisible();
        await device.createKeyButton.click();
        if (outcome.kind === 'refused') {
          await device.toast.expectError(toastCopy.diskEncryption.createKeyRefused);
          await expect(device.createKeyModal).toBeHidden();
        } else {
          await expect(device.createKeyInstructions).toBeVisible();
          await device.closeCreateKeyModal();
        }
      });

      if (outcome.kind === 'prompt') {
        await test.step(`fleetd opens the passphrase prompt with ${outcome.program}`, async () => {
          await expect
            .poll(async () => (await runAdHocScript(request, host.id, fleetdEscrowLogScript(clicked))).output, {
              timeout: 240_000,
              intervals: [10_000],
            })
            .toMatch(new RegExp(`escrow requested[\\s\\S]*program=${outcome.program}`));
        });

        await test.step('unanswered, it records nothing: the host is still Action required, with no key', async () => {
          // fleetd 1.63.0 launches its dialog program a second time when the prompt's minute is up (seen on
          // 2026-11-16): the end of the request, which Fleet hears nothing of.
          await expect
            .poll(
              async () =>
                (await runAdHocScript(request, host.id, fleetdEscrowLogScript(clicked))).output.split(`program=${outcome.program}`).length - 1,
              { message: `the ${outcome.program} prompt never ended`, timeout: 300_000, intervals: [15_000] },
            )
            .toBeGreaterThanOrEqual(2);
          expect(await getHostDiskEncryption(request, host.id)).toMatchObject({ keyAvailable: false, status: 'action_required' });
          await hostDetails.goto(host.id);
          await hostDetails.openControlsTab();
          await expect(hostDetails.controlRow('Disk encryption')).toContainText('Action required');
          await diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: 'action_required', hostName: host.displayName });
        });
      } else {
        await test.step('Host details: Failed, and why; the fleet counts the host under Failed, and lists it', async () => {
          await expect
            .poll(async () => (await getHostDiskEncryption(request, host.id)).status, { timeout: 240_000, intervals: [5_000] })
            .toBe('failed');
          await hostDetails.goto(host.id);
          await hostDetails.openControlsTab();
          const row = hostDetails.controlRow('Disk encryption');
          await expect(row).toContainText('Failed');
          await expect(row).toContainText(outcome.detail);
          await diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: 'failed', hostName: host.displayName });
        });
      }

      await test.step('back on its own fleet, the host has no key and no status, and the fleet counts nothing', async () => {
        await transferHosts(request, home.id, [host.id]);
        expect(await getHostDiskEncryption(request, host.id)).toMatchObject({ keyAvailable: false, status: null });
        await hostDetails.goto(host.id);
        // A Linux host with no control has no Controls tab at all (`shouldShowControlsTab`): Details, there, says
        // the tab list has rendered.
        await expect(hostDetails.detailsTab).toBeVisible();
        await expect(hostDetails.controlsTab).toBeHidden();
        await diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: null, hostName: host.displayName });
      });
    });
  }
});
