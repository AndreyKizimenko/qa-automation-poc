/**
 * Premium • Disk encryption • BitLocker on a real Windows 11 host, from the state Windows leaves it in.
 *
 * Windows 11 encrypts a new machine by itself and leaves it encrypted with protection off and no key
 * protectors: a key Fleet doesn't hold, on a disk any boot opens. Fleet's Windows bugs have clustered on
 * disks Fleet didn't encrypt (fleetdm/fleet#49401, #51998), and this is the commonest. `prem-win11-bde`
 * (`lab-hosts.json`, a `special` host, in Fleet's MDM, no smoke on it) rests in that state, and the test asks
 * Fleet to enforce BitLocker on it:
 *
 *   1. **From the stock state.** fleetd adds a recovery password and a TPM protector and escrows the key;
 *      once the host's vitals say protection is off, the server asks for it back on, and fleetd turns it on
 *      (`orbit/pkg/update/notifications.go`, `server/service/orbit.go`). The host reads Verified, and an
 *      admin sees the key.
 *   2. **From a disk decrypted by script, on the same fleet.** fleetd encrypts it, with XTS-AES 256 and a key
 *      it escrows anew, and the host must not read "Action required" while the disk encrypts
 *      (fleetdm/fleet#53426). Windows' own encryption would be XTS-AES 128, which is how the test tells the two
 *      apart: on 2026-11-16 fleetd got there first, 2.5 minutes after the decryption ended.
 *
 * Nobody is asked for anything at any step, and nothing restarts the host. A restart with Fleet's protectors
 * on the disk was tried once by hand (the step E experiments): the VM booted unattended.
 *
 * **Each run puts the disk back.** Fleet never decrypts and never removes a protector, and turning the setting
 * off changes nothing on the disk. So the host moves back to OS matrix, which drops Fleet's key, and a script
 * suspends protection and deletes the protectors (`test-data/windows/disk-encryption/`), which is the stock
 * state again, with XTS-AES 256 once a run has re-encrypted the disk. It also keeps the host off a TPM
 * protector the lab's server firmware could invalidate. A test that finds protectors at the start (a dead
 * run's) runs the reset first.
 *
 * **The key.** It reaches the page in the key modal, so the project keeps no trace, screenshot or video, and
 * its format is checked in code, never by a matcher that would print it. It is destroyed by the reset.
 *
 * **A Windows Server on the same kind of fleet is left alone.** Fleet manages BitLocker only on hosts in its
 * MDM that aren't servers, and the lab's Servers aren't in MDM: `prem-ws2022-01` spends ten minutes on an
 * enforcing fleet and must keep answering, with no status. fleetdm/fleet#55549 was a Server that stopped
 * answering on such a fleet. It is an OS matrix host the per-OS smokes run on, off OS matrix for that test only.
 *
 * Grounded in: `orbit/pkg/bitlocker/bitlocker_management_windows.go` (encrypt, rotate), `notifications.go`
 * (`attemptBitlockerEncryption`, `attemptEnableBitlockerProtection`), `server/service/orbit.go`
 * (`setDiskEncryptionNotifications`), `cards/Controls/statusDisplayConfig.tsx` (the Windows statuses),
 * `DiskEncryptionKeyModal.tsx`, and experiment 5 of `docs/device-lab-step-e-analysis.md`.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@fixtures';
import {
  assertActivityAfter,
  findFleetByName,
  getHostCollectedAt,
  getHostDiskEncryption,
  latestActivityId,
  type HostDiskEncryption,
  requestHostRefetch,
  requireLabHost,
  runAdHocScript,
  setFleetDiskEncryption,
  transferHosts,
  waitForHostRefetch,
} from '@helpers/api';
import {
  bitlockerDecryptScript,
  bitlockerEncryptLikeWindowsScript,
  bitlockerResetScript,
  bitlockerStatusScript,
  parseBitlockerState,
  type BitlockerState,
} from '@helpers/disk-encryption';
import { labHostFleet, matrixHostOfRun, specialHostOfRun } from '@helpers/lab-hosts';

/** A BitLocker recovery password: 48 digits in eight groups of six. */
const RECOVERY_PASSWORD = /^\d{6}(-\d{6}){7}$/;

async function diskState(request: APIRequestContext, hostId: number): Promise<BitlockerState> {
  return parseBitlockerState((await runAdHocScript(request, hostId, bitlockerStatusScript())).output);
}

async function resetToStock(request: APIRequestContext, hostId: number): Promise<BitlockerState> {
  return parseBitlockerState((await runAdHocScript(request, hostId, bitlockerResetScript())).output);
}

/**
 * Waits until Fleet's view of the host's disk encryption satisfies `done`, asking for its vitals every two
 * minutes: a Windows host's status follows its vitals, and nothing in the escrow asks for them. Returns every
 * status seen on the way.
 */
async function waitForFleet(
  request: APIRequestContext,
  hostId: number,
  what: string,
  done: (e: HostDiskEncryption) => boolean,
  minutes: number,
): Promise<string[]> {
  const seen: string[] = [];
  const end = Date.now() + minutes * 60_000;
  let nextRefetch = 0;
  while (Date.now() < end) {
    if (Date.now() >= nextRefetch) {
      await requestHostRefetch(request, hostId);
      nextRefetch = Date.now() + 120_000;
    }
    const now = await getHostDiskEncryption(request, hostId);
    if (seen[seen.length - 1] !== (now.status ?? 'none')) seen.push(now.status ?? 'none');
    if (done(now)) return seen;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`host ${hostId}: Fleet never showed ${what} in ${minutes} min; its status read ${seen.join(' → ')}`);
}

/**
 * Puts C: in Windows 11's stock state from wherever a run left it: protection suspended and the protectors
 * deleted, and a fully decrypted disk (a run stopped mid-decryption) first encrypted as Windows does it.
 */
async function restoreStock(request: APIRequestContext, hostId: number): Promise<BitlockerState> {
  let disk = await diskState(request, hostId);
  if (disk.volume === 'FullyDecrypted') {
    const { output } = await runAdHocScript(request, hostId, bitlockerEncryptLikeWindowsScript());
    expect(output.trim(), 'encrypting the decrypted disk as Windows does').toBe('encryption started');
    await expect
      .poll(async () => (disk = await diskState(request, hostId)).volume, { timeout: 900_000, intervals: [20_000] })
      .toBe('FullyEncrypted');
  }
  if (disk.protectors.length > 0 || disk.protection !== 'Off') disk = await resetToStock(request, hostId);
  return disk;
}

test.describe('Premium • Disk encryption • BitLocker on a real Windows 11 host', () => {
  // Two passes of fleetd's five-minute cycle, a decryption and an encryption of the disk, and the reset.
  test.describe.configure({ timeout: 1_800_000 });

  test('from the stock state and from a decrypted disk, Fleet escrows a key and protects the disk', async ({
    hostDetails,
    request,
    throwawayFleet,
    cleanup,
  }) => {
    const entry = specialHostOfRun('BitLocker');
    const host = await requireLabHost(request, entry);
    const home = await findFleetByName(request, labHostFleet(entry)!);
    if (!home) throw new Error(`no fleet named ${labHostFleet(entry)} to return ${host.displayName} to`);

    await test.step('the disk is in the stock state: encrypted, protection off, no protectors', async () => {
      expect(await restoreStock(request, host.id)).toMatchObject({ volume: 'FullyEncrypted', protection: 'Off', protectors: [] });
    });

    const fleet = await throwawayFleet('bitlocker');
    await setFleetDiskEncryption(request, fleet.id, { windowsEnabled: true });
    // Registered in this order so that the host is home, and Fleet no longer asks, before the reset runs.
    cleanup.add(`put ${host.displayName}'s disk back in the stock state`, (r) => resetToStock(r, host.id));
    cleanup.add(`return ${host.displayName} to ${home.name}`, (r) => transferHosts(r, home.id, [host.id]));

    const beforeEscrow = await latestActivityId(request);
    await transferHosts(request, fleet.id, [host.id]);

    await test.step('Fleet escrows a key and turns protection on, with nobody asked', async () => {
      await waitForFleet(request, host.id, 'Verified', (e) => e.status === 'verified', 12);
      await assertActivityAfter(request, 'escrowed_disk_encryption_key', beforeEscrow, (d) => d.host_id === host.id, {
        actor: null,
      });
      const disk = await diskState(request, host.id);
      expect(disk).toMatchObject({ volume: 'FullyEncrypted', protection: 'On' });
      expect(disk.protectors).toEqual(expect.arrayContaining(['RecoveryPassword', 'Tpm']));
    });

    await test.step('Host details: Verified, and the key', async () => {
      await hostDetails.goto(host.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow('Disk encryption')).toContainText('Verified');
      const beforeView = await latestActivityId(request);
      await hostDetails.showDiskEncryptionKey();
      // Checked here, not by a matcher: a failed `toMatch` prints the value it was given.
      const looksRight = RECOVERY_PASSWORD.test(await hostDetails.diskEncryptionKeyField.inputValue());
      expect(looksRight, 'the key Fleet shows has the shape of a BitLocker recovery password').toBe(true);
      await assertActivityAfter(request, 'read_host_disk_encryption_key', beforeView, (d) => d.host_id === host.id);
    });

    await test.step('a disk decrypted by script is encrypted again by fleetd, never "Action required" on the way', async () => {
      const beforeReEscrow = await latestActivityId(request);
      const { exitCode, output } = await runAdHocScript(request, host.id, bitlockerDecryptScript());
      expect(exitCode, output).toBe(0);
      await expect
        .poll(async () => (await diskState(request, host.id)).volume, { timeout: 900_000, intervals: [20_000] })
        .toBe('FullyDecrypted');
      // Fleet reads the decryption from the host's vitals before it asks fleetd to encrypt again.
      const seen = await waitForFleet(request, host.id, 'the disk decrypted', (e) => e.encrypted === false, 6);
      seen.push(...(await waitForFleet(request, host.id, 'Verified', (e) => e.encrypted === true && e.status === 'verified', 20)));
      // fleetdm/fleet#53426 showed "Action required" while the disk encrypted.
      expect(seen, `statuses on the way: ${seen.join(' → ')}`).not.toContain('action_required');
      const disk = await diskState(request, host.id);
      expect(disk, "fleetd's encryption, not Windows' own").toMatchObject({
        volume: 'FullyEncrypted',
        method: 'XtsAes256',
        protection: 'On',
      });
      await assertActivityAfter(request, 'escrowed_disk_encryption_key', beforeReEscrow, (d) => d.host_id === host.id, {
        actor: null,
      });
      await hostDetails.goto(host.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow('Disk encryption')).toContainText('Verified');
    });

    await test.step('back on its own fleet, Fleet holds no key, and the reset leaves the stock state', async () => {
      await transferHosts(request, home.id, [host.id]);
      expect(await getHostDiskEncryption(request, host.id)).toMatchObject({ keyAvailable: false, status: null });
      expect(await resetToStock(request, host.id)).toMatchObject({
        volume: 'FullyEncrypted',
        protection: 'Off',
        protectors: [],
      });
    });
  });

  test('a Windows Server on an enforcing fleet keeps answering, with no disk-encryption status', async ({
    hostDetails,
    request,
    throwawayFleet,
    cleanup,
  }) => {
    test.setTimeout(1_200_000);
    const entry = matrixHostOfRun('windows-server-2022');
    const host = await requireLabHost(request, entry);
    const home = await findFleetByName(request, labHostFleet(entry)!);
    if (!home) throw new Error(`no fleet named ${labHostFleet(entry)} to return ${host.displayName} to`);

    const fleet = await throwawayFleet('bitlocker');
    await setFleetDiskEncryption(request, fleet.id, { windowsEnabled: true });
    cleanup.add(`return ${host.displayName} to ${home.name}`, (r) => transferHosts(r, home.id, [host.id]));
    await transferHosts(request, fleet.id, [host.id]);

    await test.step('for ten minutes on the fleet, three refetches land, and Fleet shows no status', async () => {
      const end = Date.now() + 600_000;
      let refetches = 0;
      while (Date.now() < end || refetches < 3) {
        const since = await getHostCollectedAt(request, host.id, 'detail_updated_at');
        await waitForHostRefetch(request, host.id, { since, refetch: true });
        refetches += 1;
        expect((await getHostDiskEncryption(request, host.id)).status, 'a Server has no disk-encryption status').toBeNull();
        if (Date.now() < end) await new Promise((r) => setTimeout(r, Math.min(180_000, end - Date.now())));
      }
    });

    await test.step('Host details lists no disk-encryption control', async () => {
      await hostDetails.goto(host.id);
      await hostDetails.openControlsTab();
      // The Controls table, or its empty state, rendered: the row's absence below means something.
      await expect(hostDetails.controlRow('Disk encryption')).toHaveCount(0);
    });
  });
});
