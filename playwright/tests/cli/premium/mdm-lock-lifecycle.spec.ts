/**
 * `fleetctl mdm lock` → `unlock` end to end against a simulated host.
 *
 * ── What the simulations actually do (measured, 2026-08-14) ──────────────────
 *
 * | Platform | lock                                    | unlock              |
 * |----------|-----------------------------------------|---------------------|
 * | Windows  | → `locked` once orbit runs the script   | script, retryable   |
 * | Linux    | → `locked` once orbit runs the script   | script, retryable   |
 * | macOS    | **502 `bad device token`** — never locks | n/a                 |
 *
 * "Once orbit runs the script" is usually seconds but can be most of a minute:
 * orbit polls on a ~60s `config_interval`, so the timeouts here are sized for a
 * full poll cycle plus execution, not for the common fast case.
 *
 * **macOS is absent by design.** osquery-perf enrols in MDM with a synthetic
 * APNs device token, so Fleet's DeviceLock push always fails with a 502 before
 * the host can lock. Asserting that would be pinning our load fleet's fake
 * credentials, not a Fleet contract. macOS lock is covered by the refusal specs
 * in `mdm-lock-wipe.spec.ts` instead.
 *
 * **Windows is absent by choice.** It reaches the same script path this spec
 * already exercises, so the incremental coverage is thin: fleetctl's client-side
 * MDM guard in its *passing* direction, plus `VerifyMDMWindowsConfigured`. What
 * it costs is a scarce, drifting precondition — a Windows lock needs an
 * MDM-connected simulation, and only ~29 of those exist against ~100 Linux, with
 * enrolment set probabilistically by `--mdm_prob 0.3`. When that pool shrinks the
 * spec fails on a missing host rather than a real defect. The refusal specs pin
 * the guard in the direction that protects the pool; this one covers the lock
 * state machine, and Linux covers it with the least ceremony.
 *
 * **Why both steps are retry loops.** Windows and Linux lock *and* unlock run as
 * *scripts*, and osquery-perf answers every script with `exitCode := rand.Intn(2)`
 * — a coin flip. Fleet accepts the request either way; the host simply doesn't
 * reach the new state when the script "fails", and the only recourse is to issue
 * it again. Single-shot assertions flake about half the time on each step, which
 * is exactly how this spec failed twice before `settle()` existed.
 *
 * That randomness lives in our simulator, not in Fleet, so a failure here is far
 * more likely to be luck running out than a regression. The assertion messages
 * say so.
 *
 * **Why the host must run orbit.** Orbit is what polls for the lock script, and
 * only ~40% of the pool runs it (`--orbit_prob` defaults to 0.5). Lock a
 * simulation without orbit and the script never executes: the host sits at
 * `pending_action: 'lock'` permanently, and Fleet then refuses every further lock
 * *and* unlock, so it can only be deleted. One host was lost that way while
 * building this.
 *
 * **Why cleanup lives in afterAll.** The describe is serial, so a failure in the
 * lock step skips the unlock test entirely — cleanup hanging off the unlock test
 * would never run and would strand a locked host. afterAll runs either way, and
 * only deletes when unlock could not recover the host. A deleted simulation does
 * not re-enrol on its own; the pool is replenished by the daily refresh in
 * `tools/perf-hosts/`, so this costs at most one host per run, on failure only.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { withApiRequest } from '@helpers/api';
import {
  deleteHost,
  findSimulatedHostForMdm,
  getHostDeviceState,
  type MdmTargetHost,
} from '@helpers/api/hosts';
import { fleetctl, output } from '@helpers/fleetctl';

/**
 * Distinct from the offsets the browser specs claim (bulk-transfer 0,
 * host-delete 10/20) and from the CLI transfer spec's 30. Kept small because
 * requiring orbit cuts the ~97 Ubuntu simulations down to ~39 — the pool this
 * draws from is far shallower than the raw platform count suggests.
 */
const LOCK_OFFSET = 5;
/** Each attempt is a fresh coin flip, so 5 leaves a ~3% chance of a false failure. */
const ATTEMPTS = 5;
/** Orbit's script poll runs on a ~60s interval, so one round trip needs well over a minute. */
const SETTLE_TIMEOUT = 120_000;

/** Distinguishes simulator luck from a real Fleet regression in the failure message. */
const didNotConverge = (action: string) =>
  `${action} did not converge in ${ATTEMPTS} attempts — osquery-perf returns a random script ` +
  'exit code, so this is most likely luck running out rather than a Fleet defect';

/**
 * Drives a host to `target`, re-issuing the command whenever the script fails.
 *
 * osquery-perf answers **every** script with `exitCode := rand.Intn(2)` — lock and
 * unlock alike — so a request that Fleet accepted still lands on the wrong state
 * about half the time. Re-issuing is the only recourse, and it is safe: Fleet
 * rejects a second request while one is pending, so the loop waits for
 * `pending_action` to clear before trying again.
 *
 * Returns the final `device_status`, for the caller to assert on.
 */
async function settle(
  request: APIRequestContext,
  host: MdmTargetHost,
  action: 'lock' | 'unlock',
  target: 'locked' | 'unlocked',
): Promise<string | null> {
  let status = (await getHostDeviceState(request, host.id)).deviceStatus;

  for (let attempt = 0; attempt < ATTEMPTS && status !== target; attempt++) {
    const { pendingAction } = await getHostDeviceState(request, host.id);
    if (!pendingAction) {
      const res = await fleetctl(['mdm', action, '--host', host.hostname]);
      expect(res.code, `${action} failed for ${host.hostname}: ${output(res)}`).toBe(0);
    }

    await expect
      .poll(async () => (await getHostDeviceState(request, host.id)).pendingAction, {
        message: `${action} request never settled`,
        timeout: SETTLE_TIMEOUT,
      })
      .toBeFalsy();

    status = (await getHostDeviceState(request, host.id)).deviceStatus;
  }

  return status;
}

test.describe('fleetctl mdm lock lifecycle · linux', () => {
  // Serial: the unlock depends on the lock that precedes it.
  test.describe.configure({ mode: 'serial' });

  let host: MdmTargetHost | null = null;

  /**
   * Restores the host whatever happened above, including when the lock step
   * itself failed — serial mode would otherwise skip the unlock test and strand
   * a locked host. Deletes it only when unlock cannot converge.
   */
  test.afterAll(async () => {
    if (!host) return;
    // afterAll only receives worker-scoped fixtures, so the test-scoped
    // `request` isn't available here.
    await withApiRequest(async (request) => {
      const state = await getHostDeviceState(request, host!.id);
      if (state.deviceStatus === 'unlocked' && !state.pendingAction) return;
      await fleetctl(['mdm', 'unlock', '--host', host!.hostname]);
      await deleteHost(request, host!.id);
    });
  });

  test('locks a simulated linux host', async ({ request }) => {
    test.setTimeout(ATTEMPTS * SETTLE_TIMEOUT);

    // Linux is not an MDM platform, so fleetctl's client-side guard never
    // applies and no MDM-connected host is needed. Orbit is what polls for the
    // lock script, though, so a host without it could never complete the lock.
    host = await findSimulatedHostForMdm(request, 'linux', {
      mdmConnected: false,
      withOrbit: true,
      offset: LOCK_OFFSET,
    });
    expect(host, 'no simulated linux host with orbit available to lock').toBeTruthy();

    const res = await fleetctl(['mdm', 'lock', '--host', host!.hostname]);
    expect(res.code, `lock failed for ${host!.hostname}: ${output(res)}`).toBe(0);
    expect(res.stdout).toContain('The host will lock when it comes online.');

    expect(await settle(request, host!, 'lock', 'locked'), didNotConverge('lock')).toBe('locked');
  });

  test('unlocks the linux host again', async ({ request }) => {
    test.skip(!host, 'lock step did not resolve a host');
    test.setTimeout(ATTEMPTS * SETTLE_TIMEOUT);

    // No cleanup here — afterAll owns it, so a failure in this loop and a
    // failure in the lock step are handled the same way.
    expect(await settle(request, host!, 'unlock', 'unlocked'), didNotConverge('unlock')).toBe(
      'unlocked',
    );
  });
});
