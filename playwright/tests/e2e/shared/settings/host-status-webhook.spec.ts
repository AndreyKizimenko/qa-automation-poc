/**
 * Shared • Settings • Host status webhook (global).
 *
 * Settings → Integrations → Host status alerts: enable the global host-status
 * webhook, set a destination URL, save, and confirm it persisted via the API.
 * The webhook is global config (`webhook_settings.host_status_webhook`) and
 * exists on both tiers → shared. cleanup.steps.ts doesn't reset app config, so
 * the touched subtree is snapshotted in beforeEach and restored in afterEach.
 */
import { test, expect } from '@fixtures';
import { getAppConfig, patchAppConfig } from '@helpers/api';
import type { HostStatusWebhook } from '@helpers/api';

const DESTINATION_URL = 'https://example.com/host-status-webhook';

test.describe('Shared • Settings • Host status webhook', () => {
  let saved: HostStatusWebhook | undefined;

  test.beforeEach(async ({ request }) => {
    saved = (await getAppConfig(request)).webhook_settings?.host_status_webhook;
  });

  test.afterEach(async ({ request }) => {
    await patchAppConfig(request, { webhook_settings: { host_status_webhook: saved ?? {} } });
  });

  test('enabling the host status webhook with a destination URL persists', async ({
    integrationsPage,
    request,
  }) => {
    await integrationsPage.gotoHostStatusWebhook();
    await integrationsPage.setHostStatusWebhookEnabled(true);
    await integrationsPage.hostStatusDestinationUrl.fill(DESTINATION_URL);
    await integrationsPage.saveHostStatusWebhook();

    const webhook = (await getAppConfig(request)).webhook_settings?.host_status_webhook;
    expect(webhook?.enable_host_status_webhook).toBe(true);
    expect(webhook?.destination_url).toBe(DESTINATION_URL);
  });
});
