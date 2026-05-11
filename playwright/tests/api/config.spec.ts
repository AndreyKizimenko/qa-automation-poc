/**
 * Tier-agnostic config-endpoint shape checks. Runs on premium + free.
 *
 * Tier-specific contracts (e.g. asserting `license.tier === 'free'`) live
 * alongside this file in `tests/api/free/`.
 */
import { test, expect } from '@fixtures';
import { authHeaders, apiUrl } from '@helpers/api';

test.describe('Config shape', { tag: '@free' }, () => {
  test('org info is populated', async ({ request }) => {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res).toBeOK();
    const config = await res.json();
    expect(config.org_info?.org_name).toBeTruthy();
  });

  test('server settings include a server URL', async ({ request }) => {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res).toBeOK();
    const config = await res.json();
    expect(config.server_settings?.server_url).toMatch(/^https?:\/\//);
  });

  test('mdm key exists in config', async ({ request }) => {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res).toBeOK();
    const config = await res.json();
    expect(config.mdm).toBeDefined();
  });
});
