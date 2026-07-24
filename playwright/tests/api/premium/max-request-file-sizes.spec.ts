/**
 * Premium • API • max request / file sizes. Fleet enforces two distinct size
 * limits, checked here at the API layer with runtime-generated payloads (no
 * committed multi-MB fixtures):
 *   - a per-script business limit of 500,000 characters (POST /scripts), and
 *   - a 1.573MB request-body limit on the profile-upload endpoint
 *     (POST /mdm/profiles), enforced by middleware before the handler.
 * Only the rejection paths are exercised — they create nothing, so no cleanup
 * — and each asserts the size-specific error so a generic failure can't pass.
 */
import { test, expect } from '@fixtures';
import { apiUrl, authHeaders } from '@helpers/api';

test.describe('Premium • API • max request/file sizes', () => {
  test('a script over 500,000 characters is rejected', async ({ request }) => {
    const oversized = `#!/bin/sh\n# ${'a'.repeat(500_001)}`;

    const res = await request.post(apiUrl('scripts'), {
      headers: authHeaders(),
      multipart: {
        script: {
          name: 'pw-oversized.sh',
          mimeType: 'application/octet-stream',
          buffer: Buffer.from(oversized),
        },
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('Script is too large');
  });

  test('a configuration profile over the 1.573MB request limit is rejected', async ({ request }) => {
    // 2MB of padding — the request-size middleware rejects before the profile
    // is ever parsed, so the content need not be a valid .mobileconfig.
    const oversized = Buffer.alloc(2 * 1024 * 1024, 'a');

    const res = await request.post(apiUrl('mdm/profiles'), {
      headers: authHeaders(),
      multipart: {
        team_id: '0',
        profile: {
          name: 'pw-oversized.mobileconfig',
          mimeType: 'application/x-apple-aspen-config',
          buffer: oversized,
        },
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('max size limit of 1.573MB');
  });
});
