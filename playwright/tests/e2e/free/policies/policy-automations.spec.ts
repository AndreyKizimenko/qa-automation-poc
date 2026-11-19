/**
 * Free • Policies • automations, both ways the policies list sets them:
 *
 *   - **Scope-wide** — the same failing-policies webhook lifecycle as premium
 *     (webhook automations exist on free; free has no team dropdown): enabled
 *     with a destination URL, chosen as one policy's automation in that
 *     policy's own modal (stored on the policy as its `automation_type`, the
 *     cell reading "Webhook"), and turned off again, keeping the URL and the
 *     policy's automation, which the cell goes on naming. This
 *     mutates GLOBAL config (webhook_settings.failing_policies_webhook): the
 *     original is snapshotted and restored via the config helper, and a global
 *     policy is seeded so the "Automations" button is enabled. With no ticket
 *     integration, choosing Ticket offers "Add integration", which leads to
 *     Settings › Integrations.
 *   - **One policy's** — a row's Automation cell opens the same "Manage
 *     automations" modal premium's fleet policies have, but every policy on free
 *     is global, and `PolicyAutomationsFields` offers a global policy only None
 *     and *Send webhook or create ticket*: no Install software, Run script,
 *     Resend configuration profile, Calendar event or Conditional access, and no
 *     Continuous checkbox (they need a fleet policy, and their API fields are
 *     `premium:"true"`). The premium twin is in
 *     `premium/policies/policy-automations.spec.ts`.
 *
 * Grounded in frontend/pages/policies/ManagePoliciesPage — AutomationsModal /
 * OtherWorkflowsModal, ManageAutomationsModal; `renderAutomationFilter` (the
 * "Filter by automation" dropdown renders on premium only).
 */
import { test, expect } from '@fixtures';
import { FLEET_POLICY_AUTOMATION_OPTIONS } from '@pages';
import { runNonce } from '@helpers/profiles';
import { toastCopy } from '@helpers/toast-copy';
import {
  createPolicy,
  deletePolicies,
  getAppConfig,
  getGlobalPolicy,
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

  // The policy's own webhook choice goes with the policy, which this hook
  // deletes, so only the scope's switch and URL are restored.
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
      await policiesList.toast.expectSuccess(toastCopy.policies.automationsUpdated);

      const webhook = await stored();
      expect(webhook.enable_failing_policies_webhook).toBe(true);
      expect(webhook.destination_url).toBe(webhookUrl);
    });

    await test.step("choose Send webhook as the policy's automation in its own modal", async () => {
      // `SELECT 1;` passes on every host, so the webhook never has a failure to send.
      await policiesList.openPolicyAutomations(policyName);
      await expect(policiesList.policyAutomationsModal).toContainText(
        `Manage automations for the ${policyName} policy`,
      );
      await policiesList.policyAutomations.chooseAutomation('webhook_or_ticket');
      await policiesList.savePolicyAutomations();
      // The previous save's toast can still be showing, so poll the stored state.
      await expect.poll(async () => (await getGlobalPolicy(request, policyId)).automationType).toBe('webhook_or_ticket');
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Edit automation: Webhook');
    });

    await test.step("turn it off, keeping the URL and the policy's automation", async () => {
      await policiesList.openAutomations();
      await policiesList.setPolicyAutomations(false);
      await policiesList.saveAutomations();
      await expect.poll(async () => (await stored()).enable_failing_policies_webhook).toBe(false);
      expect((await stored()).destination_url).toBe(webhookUrl);
      expect((await getGlobalPolicy(request, policyId)).automationType).toBe('webhook_or_ticket');
      // The cell names the policy's automation whether or not the scope's
      // webhook is on: the switch decides only whether failures are sent. Read
      // on a freshly loaded list, so the cell is what Fleet renders from the
      // stored state, not the one drawn before the switch.
      await policiesList.goto();
      await policiesList.narrowTo(policyName);
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Edit automation: Webhook');
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
    await policiesList.toast.expectSuccess(toastCopy.policies.automationsUpdated);
  });
});

test.describe("Free • Policies • one policy's automation", () => {
  test("a policy's Automation dropdown offers only webhooks or tickets, nothing a fleet policy adds", async ({
    dashboard,
    policiesList,
    page,
    seed,
  }) => {
    const policy = await seed.policy('policy-automation');

    await dashboard.goto();
    await dashboard.navbar.goToPolicies();
    // The automation filter beside the platform one is premium's alone.
    await expect(page.getByRole('combobox', { name: 'Filter by platform', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filter by automation' })).toHaveCount(0);

    await policiesList.openPolicyAutomations(policy.name);
    const fields = policiesList.policyAutomations;
    await fields.expectAutomation('none');
    await fields.openAutomationMenu();
    // Read off the open menu: None (which opening it waits for) and the webhook or ticket option, nothing else.
    await expect(fields.option('webhook_or_ticket')).toBeVisible();
    await expect(fields.options).toHaveCount(2);
    for (const type of FLEET_POLICY_AUTOMATION_OPTIONS.filter((t) => t !== 'none' && t !== 'webhook_or_ticket')) {
      await expect(fields.option(type), `${type} is a fleet policy's automation`).toHaveCount(0);
    }
    await fields.closeAutomationMenu();
    await expect(fields.continuousCheckbox).toHaveCount(0);
    await policiesList.cancelPolicyAutomations();
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
