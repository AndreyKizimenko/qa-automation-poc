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
 * Host expiry on a fleet stacks on the global setting instead of replacing it:
 * Fleet ticks the fleet-level checkbox for the fleet's own setting *or* the
 * inherited global one, and locks it while the global one is on — a fleet can
 * add a custom window on top of the global policy but cannot opt out of it. The
 * test below reads both settings from the API and asserts the checkbox derives
 * from them, so it holds whichever way the instance is configured. The QA
 * instances keep global host expiry off (gitops `default.yml`), and the suite
 * deliberately never turns it on: a live expiry window can make Fleet delete the
 * simulated hosts the rest of the suite depends on.
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
