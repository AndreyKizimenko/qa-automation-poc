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
  // Both cases drive the same global config key, and each restores it in
  // afterEach — running them in parallel lets one test's restore land between
  // the other's save and its read-back. Serial keeps the two hook cycles from
  // interleaving.
  test.describe.configure({ mode: 'serial' });

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

  test('the automations form locks itself while the save is in flight', async ({
    policiesList,
    page,
  }) => {
    // Hold Fleet's config PATCH open until the in-flight assertions have run,
    // then release it. Holding the response rather than sleeping keeps the
    // window as long as the assertions need and no longer.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/api\/[^/]+\/fleet\/config$/, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }
      await held;
      await route.continue();
    });

    await policiesList.goto();

    await policiesList.openAutomations();
    await policiesList.setPolicyAutomations(true);
    await policiesList.selectWebhookWorkflow();
    await policiesList.policyWebhookUrlInput.fill('https://example.com/pw-policy-webhook-inflight');
    await policiesList.saveAutomationsButton.click();

    // Fleet passes `isUpdating` down as the Modal's `isContentDisabled`, which
    // both disables the submit button and lays an overlay over the form. The
    // overlay is a bare div with no role or text, so the modifier class its
    // wrapper gains is the only way to see it.
    await expect(policiesList.saveAutomationsButton).toBeDisabled();
    await expect(
      policiesList.automationsModal.locator('.modal__content-wrapper-disabled'),
    ).toBeVisible();

    release();
    await expect(policiesList.automationsModal).toBeHidden();
    await policiesList.toast.expectSuccess('Successfully updated policy automations.');
  });
});
