/**
 * Tier-agnostic • API • `GET /hosts/identifier/:identifier`. The
 * `exclude_software=true` parameter exists so integrations can poll a host's
 * details without paying for its software inventory, which is by far the
 * largest part of the payload. The contract is narrow and easy to break: it
 * must drop the software list and *nothing else*.
 *
 * Lives at the root of `tests/api/` rather than under `premium/` because there
 * is nothing premium about it — the parameter, the endpoint and the payload are
 * identical on free, which would otherwise have no coverage of either.
 *
 * **The comparison is structural, not deep.** The two calls are seconds apart
 * against a live host, so vitals like `detail_updated_at`, `seen_time` and
 * `percent_disk_space_available` legitimately differ between them; a deep
 * equality check would fail on a host that checked
 * in mid-test. What cannot legitimately differ is the host's identity or the
 * set of keys returned, so those are what is asserted.
 *
 * Grounded in server/service/hosts.go (`hostByIdentifierRequest.ExcludeSoftware`
 * → `fleet.HostDetailOptions{ExcludeSoftware}`).
 */
import { test, expect } from '@fixtures';
import { apiUrl, authHeaders, findHostWithSoftware } from '@helpers/api';

/** Identity fields that must survive the parameter untouched. */
const IDENTITY_FIELDS = ['id', 'uuid', 'hostname', 'hardware_serial', 'platform', 'team_id'];

test.describe('API • host by identifier', () => {
  test('exclude_software drops the software list and nothing else', async ({ request }) => {
    const host = await findHostWithSoftware(request);
    test.skip(!host, 'no host on this instance reports software');

    const detail = await request.get(apiUrl(`hosts/${host!.id}`), { headers: authHeaders() });
    await expect(detail).toBeOK();
    const hostname = (await detail.json()).host.hostname as string;
    expect(hostname, 'the resolved host must have a hostname to look up by').toBeTruthy();

    const identifier = encodeURIComponent(hostname);
    const withSoftware = await request.get(apiUrl(`hosts/identifier/${identifier}`), {
      headers: authHeaders(),
    });
    await expect(withSoftware).toBeOK();
    const full = (await withSoftware.json()).host;

    expect(full.hostname).toBe(hostname);
    expect(full.software?.length ?? 0).toBeGreaterThan(0);

    const withoutSoftware = await request.get(apiUrl(`hosts/identifier/${identifier}`), {
      headers: authHeaders(),
      params: { exclude_software: 'true' },
    });
    await expect(withoutSoftware).toBeOK();
    const trimmed = (await withoutSoftware.json()).host;

    expect(trimmed.software?.length ?? 0).toBe(0);
    for (const field of IDENTITY_FIELDS) {
      expect(trimmed[field], `${field} must be unchanged by exclude_software`).toEqual(full[field]);
    }
    // Every key the full payload carries is still there — the parameter empties
    // `software`, it does not thin the response out.
    expect(Object.keys(trimmed).sort()).toEqual(Object.keys(full).sort());
  });
});
