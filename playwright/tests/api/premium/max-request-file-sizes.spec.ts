/**
 * Premium • API • max request / file sizes. Fleet enforces size limits at the
 * API layer, checked here with runtime-generated payloads (no committed
 * multi-MB fixtures):
 *   - a per-script business limit of 500,000 characters (POST /scripts);
 *   - a 1.573MB request-body limit on profile upload (POST /mdm/profiles);
 *   - a 2.097MB limit on MDM commands (POST /commands/run);
 *   - a 26.21MB limit on EULA upload (POST /setup_experience/eula), batch
 *     profiles (POST /configuration_profiles/batch) and batch scripts
 *     (POST /scripts/batch).
 * All but the first are enforced by the same request-body-size middleware,
 * before the handler ever parses the payload, so an oversized body is refused
 * whatever it contains. Each case asserts the size-specific error, so a generic
 * failure can't pass for one.
 *
 * **Only rejection paths create nothing, so only they are safe to run without
 * cleanup** — and that is all this spec does. The one under-limit case
 * (`commands/run`) is written to prove the payload got *past* the size gate
 * without queuing anything: it targets a host UUID that cannot exist, so Fleet
 * fails it on the target instead. Queuing a real command needs an MDM-enrolled
 * host and leaves a command in that host's history with no way to withdraw it,
 * which belongs with the host-execution specs, not here.
 *
 * Limits come from server/fleet/request.go (MaxMDMCommandSize,
 * MaxBatchProfileSize, MaxBatchScriptSize) and the message from
 * server/platform/http/errors.go, which formats them with `units.HumanSize` —
 * hence MiB values rendered in MB.
 */
import { test, expect } from '@fixtures';
import { apiUrl, authHeaders } from '@helpers/api';

const MIB = 1024 * 1024;

/**
 * A syntactically valid UUID that belongs to no host. Lets the under-limit MDM
 * command case exercise the size gate without queuing a command on a real one.
 */
const UNKNOWN_HOST_UUID = '00000000-0000-4000-8000-000000000000';

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

  test('an EULA PDF over the 26.21MB request limit is rejected', async ({ request }) => {
    // A valid PDF magic prefix padded past the 26.21MB (25 MiB) limit — the
    // request-size middleware rejects on size before the PDF is ever parsed, so
    // uploading it never persists an EULA (nothing to clean up).
    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.7\n'),
      Buffer.alloc(27 * 1024 * 1024, 'a'),
    ]);

    const res = await request.post(apiUrl('setup_experience/eula'), {
      headers: authHeaders(),
      multipart: {
        eula: {
          name: 'pw-oversized.pdf',
          mimeType: 'application/pdf',
          buffer: oversized,
        },
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('max size limit of 26.21MB');
  });

  test('an MDM command over the 2.097MB request limit is rejected', async ({ request }) => {
    // The command travels base64-encoded in the JSON body; 3MiB of padding puts
    // the body past the limit before Fleet parses the plist inside it.
    const oversized = Buffer.alloc(3 * MIB, 'a').toString('base64');

    const res = await request.post(apiUrl('commands/run'), {
      headers: authHeaders(),
      data: { command: oversized, host_uuids: [UNKNOWN_HOST_UUID] },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('max size limit of 2.097MB');
  });

  test('an MDM command under the limit gets past the size gate', async ({ request }) => {
    // ~1.4MB of base64 — comfortably inside the 2.097MB limit, so the request
    // must fail on its *target* rather than its size. Asserting the absence of
    // the size error is the point: it is what separates "the limit is set too
    // low" from "this host doesn't exist", and it queues nothing because the
    // UUID resolves to no host.
    const underLimit = Buffer.alloc(1 * MIB, 'a').toString('base64');

    const res = await request.post(apiUrl('commands/run'), {
      headers: authHeaders(),
      data: { command: underLimit, host_uuids: [UNKNOWN_HOST_UUID] },
    });

    const body = await res.text();
    expect(body).not.toContain('max size limit');
    // Fleet's own handler answering about the target is the proof the body was
    // read in full: the size middleware never reaches it.
    expect(res.status()).toBe(404);
    expect(body).toContain('No hosts targeted');
  });

  test('a batch of configuration profiles over the 26.21MB request limit is rejected', async ({
    request,
  }) => {
    // 27MiB of padding across a handful of entries. The request-size middleware
    // rejects before any profile is parsed, so nothing is written to the fleet
    // and the payload need not be valid .mobileconfig.
    const profile = Buffer.alloc(7 * MIB, 'a').toString('base64');
    const res = await request.post(apiUrl('configuration_profiles/batch'), {
      headers: authHeaders(),
      params: { team_id: '0' },
      data: { profiles: Array.from({ length: 5 }, () => ({ profile })) },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('max size limit of 26.21MB');
  });

  test('a batch of scripts over the 26.21MB request limit is rejected', async ({ request }) => {
    // Same middleware, same 25MiB ceiling. Batch-setting scripts *replaces* a
    // fleet's whole script set, so a request that got through would be
    // destructive — the assertion that it is refused on size is what keeps this
    // case safe to run against a shared instance.
    const scriptContents = Buffer.from(`#!/bin/sh\n# ${'a'.repeat(6 * MIB)}`).toString('base64');
    const res = await request.post(apiUrl('scripts/batch'), {
      headers: authHeaders(),
      params: { team_id: '0' },
      data: {
        scripts: Array.from({ length: 5 }, (_, i) => ({
          name: `pw-oversized-${i}.sh`,
          script_contents: scriptContents,
        })),
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toContain('max size limit of 26.21MB');
  });
});
