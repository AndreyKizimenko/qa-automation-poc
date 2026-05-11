/**
 * Free-tier license assertions. The agnostic-shape parts of /config live
 * in `tests/api/config.spec.ts`.
 */
import { test, expect } from '@fixtures';
import { authHeaders, apiUrl } from '@helpers/api';

test.describe('Free • license', { tag: '@free' }, () => {
  test('license tier is free', async ({ request }) => {
    const res = await request.get(apiUrl('config'), { headers: authHeaders() });
    await expect(res).toBeOK();
    const config = await res.json();
    expect(config.license?.tier).toBe('free');
  });
});
