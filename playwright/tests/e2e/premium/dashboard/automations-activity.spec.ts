/**
 * Premium • Dashboard • Activity-feed automations. C1 #8 (filed under hosts in
 * the audit, but it's the dashboard's "Manage automations" modal, not a host
 * webhook — reassigned here).
 *
 * Enabling, editing and disabling the activity webhook each write their own
 * entry into the very feed the modal configures, so the spec drives all three
 * in one flow and then reads its own trail back off the dashboard.
 *
 * Mutates global config, so `webhook_settings.activities_webhook` is
 * snapshotted and restored. Only the touched subtree is sent, and PATCH /config
 * merges *within* `webhook_settings` (verified — the sibling vulnerabilities,
 * failing-policies and host-status webhooks survive untouched). Note this
 * differs from PATCH on a *fleet*, which replaces that subtree wholesale.
 *
 * There is one global activity webhook, so this test cannot run concurrently
 * with a copy of itself — `--repeat-each` with parallel workers will fail it.
 * Sibling appConfig specs are fine: they restore only their own subtree.
 */
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { getAppConfig, patchAppConfig } from '@helpers/api';

const DESTINATION_URL = 'https://example.com/fleet-activity-automations';
const EDITED_URL = 'https://example.com/fleet-activity-automations-edited';

/**
 * Asserts what Fleet actually stored after a save.
 *
 * Load-bearing between steps, not just a check: closing the modal doesn't mean
 * the PATCH has landed, and reopening it immediately can load pre-save config —
 * whereupon the next save writes that stale value back and silently undoes the
 * edit. Confirming the write before reopening removes that race.
 */
async function expectActivitiesWebhook(
  request: Parameters<typeof getAppConfig>[0],
  expected: { enabled: boolean; url: string },
): Promise<void> {
  const webhook = (await getAppConfig(request)).webhook_settings?.activities_webhook;
  expect(webhook?.enable_activities_webhook, 'activities webhook enabled').toBe(expected.enabled);
  expect(webhook?.destination_url, 'activities webhook destination').toBe(expected.url);
}

test.describe('Premium • Dashboard • activity automations', () => {
  test('enabling, editing, and disabling each land in the activity feed', async ({
    dashboard,
    request,
  }) => {
    const saved = (await getAppConfig(request)).webhook_settings?.activities_webhook;

    try {
      await dashboard.goto();

      await dashboard.openAutomations();
      await dashboard.setAutomationsEnabled(true);
      await dashboard.automationsUrlInput.fill(DESTINATION_URL);
      await dashboard.saveAutomations();
      await expectActivitiesWebhook(request, { enabled: true, url: DESTINATION_URL });

      await dashboard.openAutomations();
      await expect(dashboard.automationsToggle).toHaveAttribute('aria-checked', 'true');
      await dashboard.automationsUrlInput.fill(EDITED_URL);
      await dashboard.saveAutomations();
      await expectActivitiesWebhook(request, { enabled: true, url: EDITED_URL });

      await dashboard.openAutomations();
      await dashboard.setAutomationsEnabled(false);
      await dashboard.saveAutomations();
      await expectActivitiesWebhook(request, { enabled: false, url: EDITED_URL });

      // All three verbs are in the feed. expectActivities pages back through it,
      // so a busy instance pushing them off the first page is fine.
      await dashboard.goto();
      await dashboard.expectActivities([
        activityCopy.activityAutomations.enabled(),
        activityCopy.activityAutomations.edited(),
        activityCopy.activityAutomations.disabled(),
      ]);
    } finally {
      await patchAppConfig(request, {
        webhook_settings: {
          activities_webhook: {
            enable_activities_webhook: saved?.enable_activities_webhook ?? false,
            destination_url: saved?.destination_url ?? '',
          },
        },
      });
    }
  });
});
