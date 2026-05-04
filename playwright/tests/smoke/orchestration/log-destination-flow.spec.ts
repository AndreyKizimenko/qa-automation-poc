import { test, expect } from '@fixtures';
import { connect, StringCodec, NatsConnection } from 'nats';
import { authHeaders, sessionAuthHeaders, findActivity, apiUrl } from '@helpers/api';

test.describe('Log destination flow', () => {
  // ── Config validation ─────────────────────────────────────────────────────
  test.describe('Config validation', () => {
    test('logging config is retrievable via API', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      await expect(response).toBeOK();
      const config = await response.json();
      expect(config.logging).toBeDefined();
    });

    test('result log destination is configured', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      const config = await response.json();
      expect(config.logging.result).toBeDefined();
      expect(config.logging.result.plugin).toBeTruthy();
    });

    test('status log destination is configured', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      const config = await response.json();
      expect(config.logging.status).toBeDefined();
      expect(config.logging.status.plugin).toBeTruthy();
    });

    test('audit log destination is configured', async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      const config = await response.json();
      // Audit logs may not be enabled on all deployments; check it's defined
      expect(config.logging.audit).toBeDefined();
    });
  });

  // ── UI verification ───────────────────────────────────────────────────────
  // Log destinations are configured via the Fleet config file / env vars, not
  // through the UI. These tests verify settings navigation is healthy and that
  // admins can reach the pages where logging-related automations (policy /
  // software automations) are configured.
  test.describe('UI verification', () => {
    test('advanced settings page is accessible', async ({ page }) => {
      await page.goto('/settings/organization/advanced');

      await expect(page).toHaveURL(/\/settings/);
      await expect(
        page.getByRole('heading', { name: 'Advanced options', exact: true }),
      ).toBeVisible();
    });

    test('policies page loads (source of policy log events)', async ({ page }) => {
      await page.goto('/policies/manage');

      await expect(page).toHaveURL(/\/policies/);
      await expect(page.getByRole('button', { name: /add policy/i })).toBeVisible();
    });
  });

  // Asserts admin actions reach the activity log (which any log destination
  // ultimately drains from).
  // eslint-disable-next-line playwright/no-skipped-test -- tracked in TODO.md
  test.describe.skip('End-to-end log delivery', () => {
    test('report (query) lifecycle events are logged', async ({ request }) => {
      const name = `log_test_query_${Date.now()}`;

      const createRes = await request.post(apiUrl('queries'), {
        headers: sessionAuthHeaders(),
        data: { name, query: 'SELECT 1;' },
      });
      await expect(createRes).toBeOK();
      const queryID = (await createRes.json()).query.id;

      const created = await findActivity(request, 'created_saved_query', (d) => d.query_name === name);
      expect(created).toBeDefined();

      const delRes = await request.delete(apiUrl(`queries/id/${queryID}`), { headers: sessionAuthHeaders() });
      await expect(delRes).toBeOK();

      const deleted = await findActivity(request, 'deleted_saved_query', (d) => d.query_name === name);
      expect(deleted).toBeDefined();
    });

    test('policy lifecycle events are logged', async ({ request }) => {
      const name = `log_test_policy_${Date.now()}`;

      const createRes = await request.post(apiUrl('policies'), {
        headers: sessionAuthHeaders(),
        data: { name, query: 'SELECT 1;', description: 'smoke test policy' },
      });
      await expect(createRes).toBeOK();
      const policyID = (await createRes.json()).policy.id;

      const created = await findActivity(request, 'created_policy', (d) => d.policy_name === name);
      expect(created).toBeDefined();

      const delRes = await request.post(apiUrl('policies/delete'), {
        headers: sessionAuthHeaders(),
        data: { ids: [policyID] },
      });
      await expect(delRes).toBeOK();

      const deleted = await findActivity(request, 'deleted_policy', (d) => d.policy_name === name);
      expect(deleted).toBeDefined();
    });

    test('pack lifecycle events are logged', async ({ request }) => {
      const name = `log_test_pack_${Date.now()}`;

      const createRes = await request.post(apiUrl('packs'), {
        headers: sessionAuthHeaders(),
        data: { name, description: 'smoke test pack', host_ids: [], label_ids: [] },
      });
      await expect(createRes).toBeOK();
      const packID = (await createRes.json()).pack.id;

      const created = await findActivity(request, 'created_pack', (d) => d.pack_name === name);
      expect(created).toBeDefined();

      const delRes = await request.delete(apiUrl(`packs/id/${packID}`), { headers: sessionAuthHeaders() });
      await expect(delRes).toBeOK();

      const deleted = await findActivity(request, 'deleted_pack', (d) => d.pack_name === name);
      expect(deleted).toBeDefined();
    });
  });

  // ── NATS log destination verification ─────────────────────────────────────
  // Auto-detects NATS from Fleet's logging config. When Fleet's result/status/
  // audit logging plugin is "nats", the test connects to the NATS server URL
  // reported in that config (overridable via FLEET_NATS_URL) and verifies that
  // admin actions produce audit messages on the configured subject.
  test.describe('NATS log delivery', () => {
    let natsEnabled = false;
    let natsConn: NatsConnection | undefined;
    let auditSubject = '';
    let skipReason = '';

    test.beforeAll(async ({ request }) => {
      const response = await request.get('/api/latest/fleet/config', { headers: authHeaders() });
      const config = await response.json();
      const logging = config.logging;

      const natsPluginConfig =
        logging?.result?.plugin === 'nats' ? logging.result.config :
        logging?.status?.plugin === 'nats' ? logging.status.config :
        logging?.audit?.plugin === 'nats' ? logging.audit.config :
        undefined;

      if (!natsPluginConfig) {
        skipReason = 'Fleet is not configured to use the NATS logging plugin';
        return;
      }

      const natsUrl = process.env.FLEET_NATS_URL ?? natsPluginConfig.server;
      if (!natsUrl) {
        skipReason = 'Fleet NATS config has no server URL and FLEET_NATS_URL is not set';
        return;
      }

      auditSubject = logging?.audit?.config?.audit_subject ?? 'fleet_audit';

      try {
        natsConn = await connect({ servers: natsUrl, timeout: 5000 });
        natsEnabled = true;
      } catch (err) {
        skipReason = `NATS connect failed (${natsUrl}): ${(err as Error).message}`;
      }
    });

    test.afterAll(async () => {
      if (natsConn) {
        await natsConn.drain();
      }
    });

    test('can connect to NATS with the configured subjects', async () => {
      test.skip(!natsEnabled, skipReason || 'NATS not enabled');
      expect(natsConn).toBeDefined();
      expect(auditSubject).toBeTruthy();
    });

    test('audit log message is published to NATS on admin action', async ({ request }) => {
      test.skip(!natsEnabled, skipReason || 'NATS not enabled');

      const sc = StringCodec();
      const sub = natsConn!.subscribe(auditSubject);
      const received: unknown[] = [];

      // Intentional fire-and-forget subscription consumer. It runs for the
      // lifetime of the subscription; we stop it below with `sub.unsubscribe()`.
      void (async () => {
        for await (const msg of sub) {
          try {
            received.push(JSON.parse(sc.decode(msg.data)));
          } catch {
            received.push(sc.decode(msg.data));
          }
        }
      })();

      await natsConn!.flush();

      const name = `nats_audit_test_${Date.now()}`;
      const createRes = await request.post('/api/latest/fleet/queries', {
        headers: authHeaders(),
        data: { name, query: 'SELECT 1;' },
      });
      await expect(createRes).toBeOK();
      const queryID = (await createRes.json()).query.id;

      // Activity → audit log streaming runs on a cron. Trigger the cron so we
      // don't have to wait for the scheduled run.
      await request.post('/api/latest/fleet/trigger', {
        headers: authHeaders(),
        params: { name: 'activities_streaming' },
      });

      const deadline = Date.now() + 10000;
      let matched: Record<string, unknown> | undefined;
      while (Date.now() < deadline) {
        matched = received.find((m): m is Record<string, unknown> => {
          if (typeof m !== 'object' || m === null) return false;
          const entry = m as Record<string, unknown>;
          const details = entry.details as Record<string, unknown> | undefined;
          return entry.type === 'created_saved_query' && details?.query_name === name;
        });
        if (matched) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      await request.delete(`/api/latest/fleet/queries/id/${queryID}`, { headers: authHeaders() });
      sub.unsubscribe();

      expect(
        matched,
        `Expected created_saved_query audit message with query_name="${name}" on "${auditSubject}" (received ${received.length} messages total)`,
      ).toBeDefined();
    });
  });

});
