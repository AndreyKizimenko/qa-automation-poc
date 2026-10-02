/**
 * Free • Policies • automations, both ways the policies list sets them:
 *
 *   - **Scope-wide** — the same failing-policies webhook lifecycle as premium
 *     (webhook automations exist on free; free has no team dropdown): enabled
 *     with a destination URL, ticked for one policy in that policy's own modal
 *     (stored in `policy_ids`, the cell reading "Webhook"), and turned off
 *     again, keeping the URL and the policy while the cell goes back to "Add
 *     automation". This mutates GLOBAL config
 *     (webhook_settings.failing_policies_webhook): the original, `policy_ids`
 *     included, is snapshotted and restored via the config helper, and a global
 *     policy is seeded so the "Automations" button is enabled. With no ticket
 *     integration, choosing Ticket offers "Add integration", which leads to
 *     Settings › Integrations.
 *   - **One policy's** — a row's Automations cell opens the same "Manage
 *     automations" modal premium's fleet policies have, but every policy on free
 *     is global, and `PolicyAutomationsFields` gives a global policy only *Send
 *     webhook or create ticket*: no Install software, Run script, Resend
 *     configuration profile, Calendar event or Conditional access, and no
 *     Continuous checkbox (they need a fleet policy, and their API fields are
 *     `premium:"true"`). The premium twin is in
 *     `premium/policies/policy-automations.spec.ts`.
 *
 * Grounded in frontend/pages/policies/ManagePoliciesPage — AutomationsModal /
 * OtherWorkflowsModal, ManageAutomationsModal; `renderAutomationFilter` (the
 * "Filter by automation" dropdown renders on premium only).
 */
import { test, expect } from '@fixtures';
import { FLEET_POLICY_AUTOMATION_KEYS } from '@pages';
import { runNonce } from '@helpers/profiles';
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
  let policyName: string;

  test.beforeEach(async ({ request }) => {
    original = (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};
    policyName = `pw-policy-auto-${runNonce()}`;
    ({ id: policyId } = await createPolicy(request, { name: policyName }));
  });

  test.afterEach(async ({ request }) => {
    await patchAppConfig(request, {
      webhook_settings: {
        failing_policies_webhook: {
          enable_failing_policies_webhook: original.enable_failing_policies_webhook ?? false,
          destination_url: original.destination_url ?? '',
          policy_ids: original.policy_ids ?? [],
        },
      },
    });
    await deletePolicies(request, [policyId]);
  });

  test('the failing-policies webhook is enabled, sent for one policy, and turned off again', async ({
    policiesList,
    request,
  }) => {
    const webhookUrl = 'https://example.com/pw-policy-webhook';
    const stored = async (): Promise<FailingPoliciesWebhook> =>
      (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};

    await test.step('enable it with a destination URL', async () => {
      await policiesList.goto();

      await policiesList.openAutomations();
      await policiesList.setPolicyAutomations(true);
      await policiesList.selectWebhookWorkflow();
      await policiesList.policyWebhookUrlInput.fill(webhookUrl);
      await policiesList.saveAutomations();
      await policiesList.toast.expectSuccess('Successfully updated policy automations.');

      const webhook = await stored();
      expect(webhook.enable_failing_policies_webhook).toBe(true);
      expect(webhook.destination_url).toBe(webhookUrl);
    });

    await test.step("tick Send webhook in the policy's own modal", async () => {
      // `SELECT 1;` passes on every host, so the webhook never has a failure to send.
      await policiesList.openPolicyAutomations(policyName);
      await expect(policiesList.policyAutomationsModal).toContainText(
        `Manage automations for the ${policyName} policy`,
      );
      await policiesList.policyAutomations.setAutomation('ticket_webhook', true);
      await policiesList.savePolicyAutomations();
      await policiesList.toast.expectSuccess('Successfully updated policy automations.');

      expect((await stored()).policy_ids).toContain(policyId);
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Edit automation: Webhook');
    });

    await test.step('turn it off, keeping the URL and the policy', async () => {
      await policiesList.openAutomations();
      await policiesList.setPolicyAutomations(false);
      await policiesList.saveAutomations();
      await policiesList.toast.expectSuccess('Successfully updated policy automations.');

      const webhook = await stored();
      expect(webhook.enable_failing_policies_webhook).toBe(false);
      expect(webhook.destination_url).toBe(webhookUrl);
      expect(webhook.policy_ids).toContain(policyId);
      // The cell names the webhook only while the webhook is on.
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Add automation');
    });
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

test.describe("Free • Policies • one policy's automations", () => {
  test("a policy's automations modal offers webhooks or tickets, and nothing a fleet policy adds", async ({
    dashboard,
    policiesList,
    page,
    request,
  }) => {
    const policyName = `pw-policy-automations-${runNonce()}`;
    const { id: policyId } = await createPolicy(request, { name: policyName });

    try {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      // The automation filter beside the platform one is premium's alone.
      await expect(page.getByRole('combobox', { name: 'platform-dropdown' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Filter by automation' })).toHaveCount(0);

      await policiesList.openPolicyAutomations(policyName);
      const fields = policiesList.policyAutomations;
      await expect(fields.checkbox('ticket_webhook')).toBeVisible();
      await expect(fields.allCheckboxes()).toHaveCount(1);
      for (const key of FLEET_POLICY_AUTOMATION_KEYS.filter((k) => k !== 'ticket_webhook')) {
        await expect(fields.checkbox(key), `${key} is a fleet policy's automation`).toHaveCount(0);
      }
      await expect(fields.continuousCheckbox).toHaveCount(0);
      await policiesList.cancelPolicyAutomations();
    } finally {
      await deletePolicies(request, [policyId]);
    }
  });
});

test.describe('Free • Policies • automations with no ticket integration', () => {
  test('choosing Ticket offers "Add integration", which leads to Settings › Integrations', async ({
    dashboard,
    policiesList,
    integrationsPage,
    request,
  }) => {
    // The instances carry no Jira or Zendesk integration: gitops doesn't declare
    // `integrations`, so every apply clears them, and no spec adds one. Checked
    // first so a configured integration fails here, not as a missing button.
    const { integrations } = await getAppConfig(request);
    expect(integrations?.jira ?? [], 'no Jira integration on the instance').toHaveLength(0);
    expect(integrations?.zendesk ?? [], 'no Zendesk integration on the instance').toHaveLength(0);

    // The Manage automations button stays disabled until there's a policy.
    const { id: policyId } = await createPolicy(request, { name: `pw-policy-no-integration-${runNonce()}` });
    try {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();

      // Nothing is saved: the slider and the radio are only switched in the form.
      await policiesList.openAutomations();
      await policiesList.setPolicyAutomations(true);
      await policiesList.selectTicketWorkflow();
      await expect(policiesList.noIntegrationsMessage).toBeVisible();
      await expect(policiesList.addIntegrationButton).toBeEnabled();

      await policiesList.addIntegrationButton.click();
      await expect(policiesList.page).toHaveURL(/\/settings\/integrations/);
      await expect(integrationsPage.ticketingHeading).toBeVisible();
    } finally {
      await deletePolicies(request, [policyId]);
    }
  });
});
