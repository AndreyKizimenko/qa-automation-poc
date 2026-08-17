/**
 * Fleet (team) commands, which exist only on premium.
 *
 * The transfer test mutates host membership, so it draws from the **simulated**
 * osquery-perf pool via `findSimulatedHostIds` — never a real VM. It claims
 * offset 30 to stay clear of the slices the browser specs use (host-delete
 * takes 10 and 20, bulk-transfer takes 0).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiLatestUrl, authHeaders } from '@helpers/api';
import { findSimulatedHostIds, getHostFleetId } from '@helpers/api/hosts';
import { fleetctl } from '@helpers/fleetctl';

const TRANSFER_OFFSET = 30;

/**
 * `fleetctl hosts transfer --hosts` resolves each entry as a host *identifier*,
 * which is the hostname — not the display name the UI shows. The two diverge on
 * macOS ("macos-prem's Virtual Machine" vs "macos-prems-Virtual-Machine.local"),
 * so the hostname is read off the host record rather than assumed.
 */
async function hostnameFor(request: APIRequestContext, hostId: number): Promise<string> {
  const res = await request.get(apiLatestUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res).toBeOK();
  const body = await res.json();
  return body.host.hostname as string;
}

test.describe('fleetctl · premium fleet commands', () => {
  test('get fleets lists the provisioned fleets', async () => {
    const res = await fleetctl(['get', 'fleets']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('FLEET NAME');
    expect(res.stdout).toContain('HOST COUNT');
    expect(res.stdout).toContain('Workstations');
  });

  test('hosts transfer moves a simulated host between fleets', async ({ request }) => {
    const [host] = await findSimulatedHostIds(request, 'darwin', 1, TRANSFER_OFFSET);
    expect(host, 'no simulated macOS host available to transfer').toBeTruthy();

    const hostname = await hostnameFor(request, host.id);
    const originalFleetId = await getHostFleetId(request, host.id);

    try {
      const toWorkstations = await fleetctl([
        'hosts',
        'transfer',
        '--fleet',
        'Workstations',
        '--hosts',
        hostname,
      ]);
      expect(toWorkstations.code).toBe(0);

      await expect
        .poll(() => getHostFleetId(request, host.id), {
          message: `host ${hostname} never landed in Workstations`,
        })
        .not.toBe(originalFleetId);
    } finally {
      // An empty --fleet returns the host to unassigned, which is where the
      // simulated pool lives. getHostFleetId reports unassigned as null.
      await fleetctl(['hosts', 'transfer', '--fleet', '', '--hosts', hostname]);
    }

    await expect
      .poll(() => getHostFleetId(request, host.id), {
        message: `host ${hostname} was not returned to its original fleet`,
      })
      .toBe(originalFleetId);
  });
});
