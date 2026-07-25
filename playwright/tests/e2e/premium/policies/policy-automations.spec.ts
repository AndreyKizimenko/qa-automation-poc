/**
 * Premium • Policies • automations. The policies-list "Automations" modal
 * enables the global failing-policies webhook with a destination URL; the
 * change persists (verified server-side).
 *
 * Mutates GLOBAL config (webhook_settings.failing_policies_webhook) — the
 * original is snapshotted + restored via the config helper. A global policy is
 * seeded/torn down via the API so the "Automations" button is enabled (it's
 * disabled until the scope has ≥1 policy).
 *
 * Grounded in frontend/pages/policies/ManagePoliciesPage + its AutomationsModal
 * / OtherWorkflowsModal (toast "Successfully updated policy automations.").
 */
import { test, expect } from '@fixtures';
import {
  createPolicy,
  deletePolicies,
  getAppConfig,
  patchAppConfig,
  type FailingPoliciesWebhook,
} from '@helpers/api';

test.describe('Premium • Policies • automations', () => {
  let original: FailingPoliciesWebhook;
  let policyId: number;

  test.beforeEach(async ({ request }) => {
    original = (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};
    ({ id: policyId } = await createPolicy(request, { name: `pw-policy-auto-${Date.now()}` }));
  });

  test.afterEach(async ({ request }) => {
    await patchAppConfig(request, {
      webhook_settings: {
        failing_policies_webhook: {
          enable_failing_policies_webhook: original.enable_failing_policies_webhook ?? false,
          destination_url: original.destination_url ?? '',
        },
      },
    });
    await deletePolicies(request, [policyId]);
  });

  test('enabling the failing-policies webhook persists', async ({ policiesList, request }) => {
    const webhookUrl = 'https://example.com/pw-policy-webhook';

    await policiesList.goto();
    await policiesList.teamDropdown.select('All fleets');

    await policiesList.openAutomations();
    await policiesList.setPolicyAutomations(true);
    await policiesList.selectWebhookWorkflow();
    await policiesList.policyWebhookUrlInput.fill(webhookUrl);
    await policiesList.saveAutomations();
    await policiesList.toast.expectSuccess('Successfully updated policy automations.');

    const webhook = (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};
    expect(webhook.enable_failing_policies_webhook).toBe(true);
    expect(webhook.destination_url).toBe(webhookUrl);
  });
});
