/**
 * Shared • Settings • Host status webhook (global).
 *
 * Settings → Integrations → Host status alerts: enable the global host-status
 * webhook, set a destination URL, a percentage of hosts and a number of days,
 * save, and confirm all four persisted, on the page after a reload and through
 * the API. The webhook is global config (`webhook_settings.host_status_webhook`)
 * and exists on both tiers → shared. cleanup.steps.ts doesn't reset app config,
 * so the touched subtree is snapshotted in beforeEach and restored in afterEach.
 *
 * The two dropdowns render only while the webhook is enabled, and default to
 * 1% / 1 day. The test picks 5% / 3 days — or 10% / 7 days if those are what's
 * stored — so the values it reads back are ones only a working save produces.
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

  test('enabling the host status webhook with a URL, percentage and window persists', async ({
    integrationsPage,
    request,
  }) => {
    const percentage = saved?.host_percentage === 5 ? 10 : 5;
    const days = saved?.days_count === 3 ? 7 : 3;

    await integrationsPage.gotoHostStatusWebhook();
    await integrationsPage.setHostStatusWebhookEnabled(true);
    await integrationsPage.hostStatusDestinationUrl.fill(DESTINATION_URL);
    await integrationsPage.selectHostStatusOption(integrationsPage.hostStatusPercentageField, `${percentage}%`);
    await integrationsPage.selectHostStatusOption(integrationsPage.hostStatusDaysField, `${days} days`);
    await integrationsPage.saveHostStatusWebhook();

    await integrationsPage.gotoHostStatusWebhook();
    await expect(integrationsPage.hostStatusWebhookToggle).toHaveAttribute('aria-checked', 'true');
    await expect(integrationsPage.hostStatusDestinationUrl).toHaveValue(DESTINATION_URL);
    await expect(integrationsPage.hostStatusValue(integrationsPage.hostStatusPercentageField)).toHaveText(`${percentage}%`);
    await expect(integrationsPage.hostStatusValue(integrationsPage.hostStatusDaysField)).toHaveText(`${days} days`);

    const webhook = (await getAppConfig(request)).webhook_settings?.host_status_webhook;
    expect(webhook).toMatchObject({
      enable_host_status_webhook: true,
      destination_url: DESTINATION_URL,
      host_percentage: percentage,
      days_count: days,
    });
  });
});
