/**
 * `fleetctl mdm lock / unlock / wipe` are premium features. On free every one of
 * them must refuse with the licence error.
 *
 * Free is the only tier where these commands can be pointed at an MDM-connected
 * host safely: `Service.LockHost` / `UnlockHost` return `ErrMissingLicense`
 * immediately with `SkipAuthorization` and no datastore write, so nothing is ever
 * enqueued (`server/service/scripts.go`). On premium the same call against a
 * connected simulation would queue a command the host can never acknowledge —
 * which is why `tests/cli/premium/mdm-lock-wipe.spec.ts` only tests refusals.
 *
 * That also makes free the only place **Linux** can be covered. Linux isn't
 * MDM-supported, so fleetctl's client-side guard doesn't intercept it and the
 * request reaches the server — harmless here, unrecoverable on premium.
 *
 * Free's one carve-out is Android wipe (COBO), which the QA pool has no hosts
 * for, so it is not asserted.
 */
import { test, expect } from '@playwright/test';
import { findSimulatedHostForMdm } from '@helpers/api/hosts';
import { fleetctl, output } from '@helpers/fleetctl';

const LICENCE_ERROR = /missing or invalid license/;

test.describe('fleetctl mdm · free licence gating', () => {
  // MDM-connected macOS and Windows hosts get past fleetctl's client-side MDM
  // guard, so the licence error is what the server actually returns.
  for (const platform of ['darwin', 'windows'] as const) {
    for (const action of ['lock', 'unlock', 'wipe'] as const) {
      test(`${action} is refused on an MDM-enrolled ${platform} host`, async ({ request }) => {
        const host = await findSimulatedHostForMdm(request, platform, { mdmConnected: true });
        test.skip(!host, `no MDM-enrolled simulated ${platform} host in the pool`);

        const res = await fleetctl(['mdm', action, '--host', host!.hostname]);

        expect(res.code).toBe(1);
        expect(output(res)).toMatch(LICENCE_ERROR);
      });
    }
  }

  // Linux bypasses the client-side guard entirely, so these reach the server and
  // prove the licence check fires there rather than in the CLI.
  for (const action of ['lock', 'unlock', 'wipe'] as const) {
    test(`${action} is refused on a Linux host`, async ({ request }) => {
      const host = await findSimulatedHostForMdm(request, 'linux', { mdmConnected: false });
      expect(host, 'no simulated Linux host is available').toBeTruthy();

      const res = await fleetctl(['mdm', action, '--host', host!.hostname]);

      expect(res.code).toBe(1);
      expect(output(res)).toMatch(LICENCE_ERROR);
    });
  }
});
