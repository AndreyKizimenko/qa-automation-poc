/**
 * Free • Policies • automations. Same failing-policies webhook enable/persist
 * as premium (webhook automations exist on free); free has no team dropdown.
 *
 * Mutates GLOBAL config (webhook_settings.failing_policies_webhook) — the
 * original is snapshotted + restored via the config helper. A global policy is
 * seeded/torn down via the API so the "Automations" button is enabled.
 *
 * Grounded in frontend/pages/policies/ManagePoliciesPage + its AutomationsModal
 * / OtherWorkflowsModal.
 */
import { test, expect } from '@fixtures';
import {
  createPolicy,
  deletePolicies,
  getAppConfig,
  patchAppConfig,
  type FailingPoliciesWebhook,
} from '@helpers/api';

test.describe('Free • Policies • automations', () => {
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
