/**
 * Premium • Disk encryption • a Linux host's key, escrowed end to end on the lab's real hosts.
 *
 * Turning Linux key escrow on for a fleet asks no host for anything. A host's key is escrowed only when its
 * end user clicks *Create key* on My device; fleetd then asks the user for the disk's passphrase, adds a key
 * of its own and sends it (`ee/server/service/devices.go`, `orbit/pkg/luks/`). Each test does that as an admin
 * does it: Host details › *My device*, *Create key*, and then the host's Controls tab, the key and the
 * activity feed. Each status the API reports, and the host keeps until the test acts again, is also checked
 * where an admin sees it: the host's Controls tab, and the fleet's Controls › OS settings › Disk encryption
 * table, whose counts are exact because the fleet holds this one host, and whose row lists it (fleetdm/fleet#49059
 * was an eligible Linux host the table didn't count). Three hosts, each one the lab built for this
 * (`lab-hosts.json`, role `special`):
 *
 *   | host | how fleetd escrows | the passphrase prompt |
 *   |---|---|---|
 *   | Ubuntu 26.04 with TPM-backed encryption | through snapd, a recovery key under its own name; a second escrow replaces it | none |
 *   | Ubuntu 24.04, its prompt answered by script | a random passphrase in the next free key slot | answered through the accessibility API |
 *   | Omarchy, its prompt answered by script | as Ubuntu 24.04 | as Ubuntu 24.04, on Hyprland |
 *
 * **Why the prompt can be answered.** The two driven hosts carry a second passphrase, in key slot 1, that
 * opens nothing but this disk and sits in a root-only file on the host. A script started before the click
 * (`luksAnswerScript`) waits for fleetd's dialog and fills it from that file, so no passphrase passes through
 * Fleet, this repository or a report. It has to be waiting first: fleetd fetches its next script only once
 * the dialog's round is over. `test-data/linux/disk-encryption/README.md` has the rest.
 *
 * **Fleet checks a passphrase key against the disk; the test makes it.** On every vitals refresh the server
 * compares the slot and salt it stored with the host's and drops the key when they differ
 * (`server/service/osquery_utils/queries.go`, `luks_verify`). So on the driven hosts the test removes the slot
 * the escrow added, and Fleet has to drop the key at the next refresh and ask for a new one. A TPM-backed key
 * has no slot or salt, and nothing checks it again.
 *
 * **Each run starts clean.** The host moves from OS matrix onto a throwaway fleet with Linux escrow on, and
 * back: a host moved to a fleet whose Linux escrow is off loses its stored key and any error
 * (`server/datastore/mysql/disk_encryption.go`, `CleanupDiskEncryptionKeysOnTeamChange`), so each night asks
 * for a key from nothing. On the disk, fleetd's own TPM key stays until the lab rolls the host back (snapd
 * has no call that removes one, and it harms nothing), and each passphrase key costs a slot, of eight: the
 * test removes the one it added, and starts by removing any a dead run left.
 *
 * **What it leaves.** Nothing on Fleet: the fleet goes with the test, and the cleanup returns a host a dead
 * run left on it. A key reaches the page in these tests, so the project keeps no trace, screenshot or video,
 * and the key's format is checked in code, never by a matcher that would print it.
 *
 * The Omarchy row is written and skipped. Below fleetd 1.64.0 the server refuses *Create key* on Omarchy, and the
 * dialog can't open on Hyprland (fleetdm/fleet#55069). On 1.64.0, which premium's lab hosts get from fleetd's edge
 * channel, the dialog opens, the helper answers it and Fleet stores the key (2026-11-19). But the helper never
 * sees fleetd's *Disk encryption* notice after the escrow, within its four minutes, so the row's step that reads
 * the notice fails (TODO.md).
 *
 * Grounded in: `DeviceUserBanners.tsx`, `CreateLinuxKeyModal.tsx`, `User.tsx` (the *My device* button),
 * `DiskEncryptionKeyModal.tsx`, `cards/Controls/statusDisplayConfig.tsx`, `server/service/linux_mdm.go`
 * (a Linux host's status is its key row: none is Action required, a key Verified), `orbit/pkg/luks/`
 * (`luks_linux.go`, `snapd_fde.go`), and the step E experiments of 2026-11-16
 * (`docs/device-lab-step-e-analysis.md`).
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  assertActivityAfter,
  findFleetByName,
  getHostCollectedAt,
  getHostDiskEncryption,
  latestActivityId,
  requireLabHost,
  runAdHocScript,
  setFleetDiskEncryption,
  transferHosts,
  waitForHostRefetch,
} from '@helpers/api';
import {
  LUKS_ANSWER_LOG_SCRIPT,
  luksAnswerScript,
  luksRemoveEscrowSlotsScript,
  parseLuksSlots,
} from '@helpers/disk-encryption';
import { labHostFleet, specialHostOfRun } from '@helpers/lab-hosts';

interface Case {
  title: string;
  /** The host's manifest purpose, or a part of it. */
  purpose: string;
  /** The prompt is fleetd's to show, and the script's to answer; false where snapd escrows with none. */
  prompt: boolean;
  /** The key Fleet shows, by its shape: fleetd's 35-character passphrase, or snapd's 8 × 5 digits. */
  keyFormat: RegExp;
  /** Why the test is skipped, while it is. */
  skip?: string;
}

const PASSPHRASE_KEY = /^[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-[A-Za-z0-9]{8}-[A-Za-z0-9]{8}$/;
const RECOVERY_KEY = /^\d{5}(-\d{5}){7}$/;

const CASES: Case[] = [
  { title: 'Ubuntu with TPM-backed encryption', purpose: 'TPM-backed', prompt: false, keyFormat: RECOVERY_KEY },
  { title: 'Ubuntu, its prompt answered by script', purpose: 'Test-driven LUKS escrow on Ubuntu', prompt: true, keyFormat: PASSPHRASE_KEY },
  {
    title: 'Omarchy, its prompt answered by script',
    purpose: 'Test-driven LUKS escrow on Omarchy',
    prompt: true,
    keyFormat: PASSPHRASE_KEY,
    // TODO.md: on fleetd 1.64.0 the escrow succeeds on Hyprland, but the helper never sees fleetd's notice after it.
    skip: "Omarchy: fleetd's notice after the escrow is never seen (TODO.md)",
  },
];

/** Removes every key slot above 1, the ones fleetd's escrows added, and returns the slots left. */
async function removeEscrowSlots(request: APIRequestContext, hostId: number): Promise<number[]> {
  const { exitCode, output } = await runAdHocScript(request, hostId, luksRemoveEscrowSlotsScript());
  if (exitCode !== 0) throw new Error(`[removeEscrowSlots] host ${hostId}: ${output.trim()}`);
  return parseLuksSlots(output);
}

/** Asks the host for its vitals and waits for them to land. */
async function refetchVitals(request: APIRequestContext, hostId: number): Promise<void> {
  const since = await getHostCollectedAt(request, hostId, 'detail_updated_at');
  await waitForHostRefetch(request, hostId, { since, refetch: true });
}

test.describe('Premium • Disk encryption • Linux key escrow on a real host', () => {
  // A host's queue, fleetd's check-in, a passphrase key's work on a slow VM (two minutes), and two refetches.
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  for (const c of CASES) {
    test(`${c.title}: Create key escrows a key Fleet shows`, async ({
      hostDetails,
      diskEncryption,
      request,
      throwawayFleet,
      cleanup,
    }) => {
      test.skip(c.skip !== undefined, c.skip);
      const entry = specialHostOfRun(c.purpose);
      const host = await requireLabHost(request, entry);
      const home = await findFleetByName(request, labHostFleet(entry)!);
      if (!home) throw new Error(`no fleet named ${labHostFleet(entry)} to return ${host.displayName} to`);

      if (c.prompt) {
        await test.step('the disk holds only its two passphrases', async () => {
          expect(await removeEscrowSlots(request, host.id)).toEqual([0, 1]);
        });
      }

      const fleet = await throwawayFleet('disk-encryption');
      await setFleetDiskEncryption(request, fleet.id, { linuxEscrowEnabled: true });
      cleanup.add(`return ${host.displayName} to ${home.name}`, (r) => transferHosts(r, home.id, [host.id]));
      if (c.prompt) {
        cleanup.add(`remove the key slot the escrow added on ${host.displayName}`, (r) => removeEscrowSlots(r, host.id));
      }
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

      if (c.prompt) {
        await test.step('a script waits for the passphrase prompt', async () => {
          const { exitCode, output } = await runAdHocScript(request, host.id, luksAnswerScript('answer'));
          expect(exitCode, output).toBe(0);
        });
      }

      const beforeEscrow = await latestActivityId(request);

      const device = await test.step('My device: Create key', async () => {
        await hostDetails.goto(host.id);
        const page = await hostDetails.openMyDevice();
        await expect(page.createKeyBanner).toBeVisible();
        await page.createKey();
        await expect(page.createKeyInstructions).toBeVisible();
        await page.closeCreateKeyModal();
        return page;
      });

      await test.step('Fleet escrows the key, with nobody at the host', async () => {
        await expect
          .poll(async () => (await getHostDiskEncryption(request, host.id)).keyAvailable, {
            message: `${host.displayName} never escrowed a key`,
            timeout: 360_000,
            intervals: [5_000],
          })
          .toBe(true);
        await assertActivityAfter(request, 'escrowed_disk_encryption_key', beforeEscrow, (d) => d.host_id === host.id, {
          actor: null,
        });
      });

      if (c.prompt) {
        await test.step("the script answered the prompt, and fleetd's notice said the key was escrowed", async () => {
          await expect
            .poll(async () => (await runAdHocScript(request, host.id, LUKS_ANSWER_LOG_SCRIPT)).output, { timeout: 300_000 })
            .toContain('closed the notice');
          const { output } = await runAdHocScript(request, host.id, LUKS_ANSWER_LOG_SCRIPT);
          expect(output).toContain('pressed OK');
          // The notice's labels, as the helper logs them: its title, then its text.
          expect(output).toMatch(/notice: .*Disk encryption key escrowed to Fleet/);
        });
      }

      await test.step('Host details: Verified, and the key', async () => {
        await hostDetails.goto(host.id);
        await hostDetails.openControlsTab();
        await expect(hostDetails.controlRow('Disk encryption')).toContainText('Verified');
        const beforeView = await latestActivityId(request);
        await hostDetails.showDiskEncryptionKey();
        // Checked here, not by a matcher: a failed `toMatch` prints the value it was given.
        const looksRight = c.keyFormat.test(await hostDetails.diskEncryptionKeyField.inputValue());
        expect(looksRight, `the key Fleet shows has the shape of ${c.prompt ? "fleetd's passphrase" : "snapd's recovery key"}`).toBe(true);
        await assertActivityAfter(request, 'read_host_disk_encryption_key', beforeView, (d) => d.host_id === host.id);
      });

      await test.step('Controls › Disk encryption: the fleet counts the host under Verified, and lists it', () =>
        diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: 'verified', hostName: host.displayName }),
      );

      await test.step('My device no longer asks for a key', async () => {
        await device.page.reload();
        await expect(device.heading).toBeVisible();
        await expect(device.createKeyBanner).toBeHidden();
      });

      if (c.prompt) {
        await test.step('the key survives a vitals refresh', async () => {
          await refetchVitals(request, host.id);
          expect((await getHostDiskEncryption(request, host.id)).keyAvailable).toBe(true);
        });

        await test.step("with the key's slot gone from the disk, Fleet drops the key at the next refresh", async () => {
          expect(await removeEscrowSlots(request, host.id)).toEqual([0, 1]);
          await refetchVitals(request, host.id);
          await expect
            .poll(async () => getHostDiskEncryption(request, host.id), { timeout: 120_000 })
            .toMatchObject({ keyAvailable: false, status: 'action_required' });
          await hostDetails.goto(host.id);
          await hostDetails.openControlsTab();
          await expect(hostDetails.controlRow('Disk encryption')).toContainText('Action required');
          await diskEncryption.expectOneHost({ fleetId: fleet.id, platform: 'linux', status: 'action_required', hostName: host.displayName });
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
