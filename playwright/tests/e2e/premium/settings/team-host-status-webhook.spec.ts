/**
 * Premium • Settings • A fleet's own host-status webhook, driven by that
 * fleet's team admin.
 *
 * Distinct from the global host-status webhook
 * (`tests/e2e/shared/settings/host-status-webhook.spec.ts`): this one lives on
 * the fleet and fires separately from the global one.
 *
 * The webhook sits in the fleet's `webhook_settings`, beside its
 * failing-policies and host-activities webhooks. A save replaces only the
 * webhooks it carries, so the test snapshots and restores its own key,
 * `host_status_webhook`, and leaves the other two to the specs that write them.
 *
 * Host expiry on a fleet stacks on the global setting instead of replacing it:
 * Fleet ticks the fleet-level checkbox for the fleet's own setting *or* the
 * inherited global one, and locks it while the global one is on — a fleet can
 * add a custom window on top of the global policy but cannot opt out of it. The
 * test below reads both settings from the API and asserts the checkbox derives
 * from them, so it holds whichever way the instance is configured. The QA
 * instances keep global host expiry on at one day (gitops `default.yml`): that
 * is what culls the simulations the perf daemons abandon at their daily
 * refresh. The suite never changes it, and a fleet's own window only stacks on
 * top of it.
 */
import { test, expect } from '@fixtures';
import { TeamSettingsPage } from '@pages';
import { withStaticUser } from '@helpers/auth';
import {
  getAppConfig,
  getFleetHostExpirySettings,
  getFleetWebhookSettings,
  setFleetWebhookSettings,
} from '@helpers/api';

const DESTINATION_URL = 'https://example.com/fleet-team-host-status';
/** The webhook switched off, for a fleet that never had one: Fleet takes a webhook sent as `null` as not sent. */
const HOST_STATUS_WEBHOOK_OFF = { enable_host_status_webhook: false, destination_url: '', host_percentage: 0, days_count: 0 };

test.describe('Premium • Settings • fleet host status webhook', () => {
  test('a team admin enables their fleet host status webhook and it persists', async ({
    browser,
    workstationsFleetId,
    cleanup,
    request,
  }) => {
    // Restored by this test alone, not by a hook: the read-only test below
    // shares this fleet and runs in parallel, so a hook-based restore there
    // would roll this one back mid-flight.
    const saved = (await getFleetWebhookSettings(request, workstationsFleetId)).host_status_webhook;
    cleanup.add("restore Workstations' host-status webhook", (r) =>
      setFleetWebhookSettings(r, workstationsFleetId, { host_status_webhook: saved ?? HOST_STATUS_WEBHOOK_OFF }),
    );

    await withStaticUser(browser, 'team-admin', async (page) => {
      const teamSettings = new TeamSettingsPage(page);

      await teamSettings.goto(workstationsFleetId);
      await teamSettings.setHostStatusWebhookEnabled(true);

      // The URL field only renders once the webhook is enabled.
      await teamSettings.destinationUrlInput.fill(DESTINATION_URL);
      await teamSettings.save();

      await teamSettings.toast.expectSuccess('Successfully updated settings.');

      // Reload rather than trusting the form's own state.
      await teamSettings.goto(workstationsFleetId);
      await expect(teamSettings.hostStatusWebhookCheckbox).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(teamSettings.destinationUrlInput).toHaveValue(DESTINATION_URL);
    });

    const webhook = (await getFleetWebhookSettings(request, workstationsFleetId))
      .host_status_webhook as Record<string, unknown> | undefined;
    expect(webhook?.enable_host_status_webhook).toBe(true);
    expect(webhook?.destination_url).toBe(DESTINATION_URL);
  });

  test('the fleet host expiry checkbox derives from the global and fleet settings', async ({
    browser,
    workstationsFleetId,
    request,
  }) => {
    const globalExpiry = (await getAppConfig(request)).host_expiry_settings as
      | { host_expiry_enabled?: boolean }
      | undefined;
    const globalEnabled = globalExpiry?.host_expiry_enabled === true;
    const fleetEnabled =
      (await getFleetHostExpirySettings(request, workstationsFleetId)).host_expiry_enabled === true;

    await withStaticUser(browser, 'team-admin', async (page) => {
      const teamSettings = new TeamSettingsPage(page);

      await teamSettings.goto(workstationsFleetId);

      // Ticked for either setting, locked only by the global one.
      await expect(teamSettings.hostExpiryCheckbox).toHaveAttribute(
        'aria-checked',
        String(fleetEnabled || globalEnabled),
      );
      await expect(teamSettings.hostExpiryCheckbox).toHaveAttribute(
        'aria-disabled',
        String(globalEnabled),
      );

      // The help text is the explanation for the lock, so it appears with it.
      if (globalEnabled) {
        await expect(teamSettings.hostExpiryHelpText).toBeVisible();
      } else {
        await expect(teamSettings.hostExpiryHelpText).toHaveCount(0);
      }

      // The label tooltip describes the setting regardless of either state.
      await teamSettings.hostExpiryLabel.hover();
      await expect(page.getByRole('tooltip')).toContainText(
        'allows automatic cleanup of',
      );
    });
  });
});
