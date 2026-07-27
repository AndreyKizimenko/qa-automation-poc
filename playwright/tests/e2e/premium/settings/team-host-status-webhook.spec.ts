/**
 * Premium • Settings • A fleet's own host-status webhook, driven by that
 * fleet's team admin. C1 #16.
 *
 * Distinct from the global host-status webhook shipped in Batch 3
 * (`tests/e2e/shared/settings/host-status-webhook.spec.ts`): this one lives on
 * the fleet and fires separately from the global one.
 *
 * The webhook config is a global-config-style mutation, so the fleet's whole
 * `webhook_settings` subtree is snapshotted and restored — Fleet replaces that
 * subtree wholesale on PATCH, and Workstations carries a failing-policies
 * webhook with gitops-provisioned policy ids that must survive.
 *
 * The host-expiry assertions depend on host expiry being enabled globally, which
 * it is on both QA instances (`host_expiry` = 1 day, set so the load fleet's
 * abandoned hosts get swept). With it on, a fleet cannot opt out — Fleet
 * disables the fleet-level checkbox and explains why in help text.
 */
import { test, expect } from '@fixtures';
import { TeamSettingsPage } from '@pages';
import { withStaticUser } from '@helpers/auth';
import { getFleetWebhookSettings, setFleetWebhookSettings } from '@helpers/api';

const DESTINATION_URL = 'https://example.com/fleet-team-host-status';

test.describe('Premium • Settings • fleet host status webhook', () => {
  test('a team admin enables their fleet host status webhook and it persists', async ({
    browser,
    workstationsFleetId,
    request,
  }) => {
    // Snapshot/restore lives in the test, not a hook: the read-only test below
    // shares this fleet and runs in parallel, so a hook-based restore there
    // would roll this one back mid-flight.
    const savedWebhookSettings = await getFleetWebhookSettings(request, workstationsFleetId);

    try {
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
    } finally {
      await setFleetWebhookSettings(request, workstationsFleetId, savedWebhookSettings);
    }
  });

  test('host expiry cannot be opted out of when it is enabled globally', async ({
    browser,
    workstationsFleetId,
  }) => {
    await withStaticUser(browser, 'team-admin', async (page) => {
      const teamSettings = new TeamSettingsPage(page);

      await teamSettings.goto(workstationsFleetId);

      // Globally enabled, so the fleet inherits it and can't turn it off here.
      await expect(teamSettings.hostExpiryCheckbox).toHaveAttribute('aria-checked', 'true');
      await expect(teamSettings.hostExpiryCheckbox).toHaveAttribute('aria-disabled', 'true');
      await expect(teamSettings.hostExpiryHelpText).toBeVisible();

      await teamSettings.hostExpiryLabel.hover();
      await expect(page.getByRole('tooltip')).toContainText(
        'allows automatic cleanup of',
      );
    });
  });
});
