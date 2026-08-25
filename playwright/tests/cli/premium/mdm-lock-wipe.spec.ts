/**
 * `fleetctl mdm lock / unlock / wipe` — premium error handling.
 *
 * ── Why this file only tests refusals ────────────────────────────────────────
 *
 * A successful lock or wipe against an osquery-perf simulation is **not
 * recoverable**. The simulation never acknowledges the MDM command (macOS,
 * Windows) and never executes the script (Windows, Linux), so the host sits at
 * `IsPendingLock()` / `IsPendingWipe()` indefinitely — and once pending, Fleet
 * rejects every subsequent lock *and* unlock for that host. There is no CLI path
 * back. The host is spent.
 *
 * What keeps these specs safe is a client-side guard: `hostMdmActionSetup`
 * refuses a host that isn't connected to Fleet MDM *before* calling the server,
 * so nothing is ever enqueued. That guard only covers platforms where
 * `MDMTurnedOnSupported` is true — darwin, ios, ipados, windows, android.
 *
 * **Linux is deliberately absent from this file.** Linux is not MDM-supported,
 * so the client-side guard doesn't apply; the request reaches the server, whose
 * only Linux gate is `scripts_enabled`, and every simulation reports
 * `scripts_enabled: null` — which does *not* trip the guard. A Linux lock or
 * wipe here would enqueue for real. Linux is covered on the free tier instead
 * (`tests/cli/free/mdm-licensing.spec.ts`), where the licence check
 * short-circuits before anything is queued.
 *
 * Every host is drawn with `mdmConnected: false` for the same reason — roughly a
 * third of the simulated pool *is* MDM-enrolled, and one of those would reach
 * the server.
 */
import { test, expect } from '@playwright/test';
import { findSimulatedHostForMdm } from '@helpers/api/hosts';
import { fleetctl, output } from '@helpers/fleetctl';

const MDM_OFF = (action: string) =>
  new RegExp(`Can't ${action} the host because it doesn't have MDM turned on\\.`);

const UNKNOWN_HOST = 'no-such-host-fleetctl-cli-spec';

test.describe('fleetctl mdm · premium error handling', () => {
  for (const platform of ['darwin', 'windows'] as const) {
    for (const action of ['lock', 'unlock', 'wipe'] as const) {
      test(`${action} refuses a ${platform} host with MDM off`, async ({ request }) => {
        const host = await findSimulatedHostForMdm(request, platform, { mdmConnected: false });
        expect(host, `no simulated ${platform} host with MDM off is available`).toBeTruthy();

        const res = await fleetctl(['mdm', action, '--host', host!.hostname]);

        expect(res.code).toBe(1);
        expect(output(res)).toMatch(MDM_OFF(action));
      });
    }
  }

  for (const action of ['lock', 'unlock', 'wipe'] as const) {
    test(`${action} reports an unknown host identifier`, async () => {
      const res = await fleetctl(['mdm', action, '--host', UNKNOWN_HOST]);

      expect(res.code).toBe(1);
      expect(output(res)).toContain("Host doesn't exist.");
    });
  }

  for (const action of ['lock', 'unlock', 'wipe'] as const) {
    test(`${action} requires the --host flag`, async () => {
      const res = await fleetctl(['mdm', action]);

      expect(res.code).toBe(1);
      expect(output(res)).toMatch(/Required flag "host" not set/);
    });
  }
});
