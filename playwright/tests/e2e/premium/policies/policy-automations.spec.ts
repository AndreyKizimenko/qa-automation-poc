/**
 * Premium • Policies • automations, both ways the policies list sets them:
 *
 *   - **Scope-wide** — the "Manage automations" button's modal enables the
 *     global failing-policies webhook with a destination URL, a global policy's
 *     own modal ticks "Send webhook" for it (stored in the webhook's
 *     `policy_ids`, and the row's cell reads "Webhook"), and the scope-wide
 *     modal turns it off again — keeping the URL and the policy, while the cell
 *     goes back to "Add automation" because Fleet labels the cell from the
 *     webhook's state. This mutates GLOBAL config
 *     (webhook_settings.failing_policies_webhook): the original, `policy_ids`
 *     included, is snapshotted and restored via the config helper, and a global
 *     policy is seeded so the button is enabled (it's disabled until the scope
 *     has ≥1 policy). With no ticket integration on the instance, choosing
 *     Ticket offers "Add integration", which leads to Settings › Integrations.
 *   - **A fleet's own** — the same modal at a fleet's scope saves the fleet's
 *     failing-policies webhook through the fleet, not global config. On a
 *     throwaway `pw-fleet-webhook-*` fleet: a fleet's automations save replaces
 *     its whole `webhook_settings` (fleetdm/fleet#54619), so on Workstations it
 *     would race `team-host-status-webhook.spec.ts`, which writes the same
 *     subtree.
 *   - **One policy's** — a row's Automations cell opens that policy's own
 *     "Manage automations" modal (Fleet's ManageAutomationsModal, around
 *     PolicyAutomationsFields). QA Wolf's `manage-all-automations-for-a-given-policy-at-once`:
 *     Install software, Run script and Continuous saved together, all three
 *     stored, the row summarised as "2 automations", and the modal reopening on
 *     them. On **Workstations**, which has no hosts, with a script and a package
 *     made for the run — so nothing the automations point at ever runs. Whether
 *     they *run* is `policy-automation-runs.spec.ts` and `install-on-host.spec.ts`,
 *     on the Ubuntu VM.
 *
 * Grounded in frontend/pages/policies/ManagePoliciesPage — AutomationsModal /
 * OtherWorkflowsModal, ManageAutomationsModal, PoliciesTableConfig's
 * AutomationsCell (toast "Successfully updated policy automations." for both).
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { inertDeb } from '@helpers/deb';
import { runNonce } from '@helpers/profiles';
import {
  createFleet,
  createFleetPolicy,
  createPolicy,
  deleteFleet,
  deleteFleetPolicies,
  deletePolicies,
  deleteScript,
  deleteSoftwareTitle,
  getAppConfig,
  getFleetPolicy,
  getFleetWebhookSettings,
  patchAppConfig,
  uploadScript,
  uploadSoftwarePackageBuffer,
  type FailingPoliciesWebhook,
} from '@helpers/api';
import { PoliciesListPage } from '@pages';

test.describe('Premium • Policies • automations', () => {
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

  test("the failing-policies webhook is enabled, sent for one policy, and turned off again", async ({
    policiesList,
    request,
  }) => {
    const webhookUrl = 'https://example.com/pw-policy-webhook';
    const stored = async (): Promise<FailingPoliciesWebhook> =>
      (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};

    await test.step('enable it with a destination URL', async () => {
      await policiesList.goto();
      await policiesList.teamDropdown.select('All fleets');

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
        `Manage automations for the ${policyName} policy on All fleets.`,
      );
      await policiesList.policyAutomations.setAutomation('ticket_webhook', true);
      await policiesList.savePolicyAutomations();
      // The previous save's toast can still be showing, so poll the stored state.
      await expect.poll(async () => (await stored()).policy_ids).toContain(policyId);
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Edit automation: Webhook');
    });

    await test.step('turn it off, keeping the URL and the policy', async () => {
      await policiesList.openAutomations();
      await policiesList.setPolicyAutomations(false);
      await policiesList.saveAutomations();
      await expect.poll(async () => (await stored()).enable_failing_policies_webhook).toBe(false);
      const webhook = await stored();
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
    await policiesList.teamDropdown.select('All fleets');

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

  // TODO(fleetdm/fleet#54623): on a fleet's list, a fleet admin can tick Send
  // webhook on an inherited (All fleets) policy. That membership lives in global
  // config, so Save answers 403 and the modal stays open with no error. Fleet's
  // role table reserves All fleets policy automations for global admins, so the
  // checkbox should be disabled for them. It needs the global webhook on, which
  // the tests above own, hence this describe. Un-skip once the fix ships.
  test.skip("a fleet admin can't add an inherited policy to the global webhook", async ({
    browser,
    request,
    workstationsFleetId,
  }) => {
    await patchAppConfig(request, {
      webhook_settings: {
        failing_policies_webhook: {
          enable_failing_policies_webhook: true,
          destination_url: 'https://example.com/pw-policy-webhook-fleet-admin',
          policy_ids: original.policy_ids ?? [],
        },
      },
    });

    await withStaticUser(browser, 'team-admin', async (page) => {
      const list = new PoliciesListPage(page);
      await list.goto({ fleetId: workstationsFleetId });
      await list.teamDropdown.select('Workstations');
      await list.openPolicyAutomations(policyName);
      await expect(list.policyAutomationsModal).toContainText(
        `Manage automations for the ${policyName} policy on All fleets.`,
      );
      await expect(list.policyAutomations.checkbox('ticket_webhook')).toBeDisabled();
    });
  });
});

test.describe('Premium • Policies • the automation filter by scope', () => {
  // Round 1 C3 #22. QA Wolf filed it under a global maintainer, but the options
  // follow the scope, not the role (`getValidAutomationTypesForTeam` in
  // ManagePoliciesPage), so the admin reads them: All fleets' policies take only
  // webhooks or tickets, Unassigned's everything but calendar events (a
  // fleet-only feature), a fleet's every type.
  const TYPES = [
    'Software',
    'Patch',
    'Scripts',
    'Profiles',
    'Calendar',
    'Conditional access',
    'Webhooks or tickets',
  ] as const;
  const OFFERED: { scope: 'All fleets' | 'Unassigned' | 'Workstations'; types: readonly string[] }[] = [
    { scope: 'All fleets', types: ['Webhooks or tickets'] },
    { scope: 'Unassigned', types: TYPES.filter((t) => t !== 'Calendar') },
    { scope: 'Workstations', types: TYPES },
  ];

  let policyId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (policyId !== undefined) await deletePolicies(request, [policyId]);
    policyId = undefined;
  });

  test('offers only the automation types the scope supports', async ({
    policiesList,
    request,
    workstationsFleetId,
  }) => {
    // The filter is disabled on a scope with no policies; a global one is
    // listed on All fleets and inherited by every other scope.
    ({ id: policyId } = await createPolicy(request, { name: `pw-policy-filter-${runNonce()}` }));

    for (const { scope, types } of OFFERED) {
      await test.step(scope, async () => {
        const fleetId = scope === 'All fleets' ? undefined : scope === 'Unassigned' ? 0 : workstationsFleetId;
        await policiesList.goto({ fleetId });
        await policiesList.teamDropdown.select(scope);
        await policiesList.automationFilter.click();
        // "All automations" first, so the absences below are read off an open menu.
        await expect(policiesList.automationFilterOption('All automations')).toBeVisible();
        for (const type of TYPES) {
          await expect(policiesList.automationFilterOption(type)).toHaveCount(types.includes(type) ? 1 : 0);
        }
        await policiesList.page.keyboard.press('Escape');
      });
    }
  });
});

test.describe("Premium • Policies • one policy's automations", () => {
  test('install software, run script and continuous, saved together from the row, are stored and reopen', async ({
    dashboard,
    policiesList,
    workstationsFleetId,
    request,
  }) => {
    const n = runNonce();
    const policyName = `pw-policy-automations-${n}`;
    const scriptName = `pw-policy-automations-${n}.sh`;
    const packageName = `fleet-pw-policy-automations-${n}`;
    const policy = await createFleetPolicy(request, workstationsFleetId, {
      name: policyName,
      query: 'SELECT 1;',
      platform: 'linux',
    });
    let scriptId: number | undefined;
    let titleId: number | undefined;

    try {
      scriptId = await uploadScript(request, workstationsFleetId, scriptName, '#!/bin/sh\necho "pw: never runs"\n');
      ({ titleId } = await uploadSoftwarePackageBuffer(
        request,
        workstationsFleetId,
        `${packageName}_1.0.0_all.deb`,
        inertDeb(packageName, '1.0.0'),
      ));

      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select('Workstations');
      // Narrowed first: Workstations lists inherited global policies too, and the list pages at 20.
      await policiesList.search.fill(policyName);
      await expect(policiesList.automationsCell(policyName)).toHaveAccessibleName('Add automation');

      await policiesList.openPolicyAutomations(policyName);
      await expect(policiesList.policyAutomationsModal).toContainText(
        `Manage automations for the ${policyName} policy on Workstations.`,
      );
      await policiesList.policyAutomations.installSoftware(packageName);
      await policiesList.policyAutomations.runScript(scriptName);
      await policiesList.policyAutomations.setContinuous(true);
      await policiesList.savePolicyAutomations();
      await policiesList.toast.expectSuccess('Successfully updated policy automations.');

      // All three stored, on the policy itself.
      const stored = await getFleetPolicy(request, workstationsFleetId, policy.id);
      expect(stored.installSoftwareTitleId).toBe(titleId);
      expect(stored.runScript?.id).toBe(scriptId);
      expect(stored.continuousAutomationsEnabled).toBe(true);

      // The row summarises two automations — Continuous is a setting, not one.
      const cell = policiesList.automationsCell(policyName);
      await expect(cell).toHaveAccessibleName('Edit automations');
      await expect(cell).toHaveText('2 automations');

      // And the modal reopens on what was saved.
      await policiesList.openPolicyAutomations(policyName);
      const fields = policiesList.policyAutomations;
      await expect(fields.checkbox('install_software')).toHaveAttribute('aria-checked', 'true');
      await expect(fields.selectedValue('install_software')).toHaveText(packageName);
      await expect(fields.checkbox('run_script')).toHaveAttribute('aria-checked', 'true');
      await expect(fields.selectedValue('run_script')).toHaveText(scriptName);
      await expect(fields.continuousCheckbox).toHaveAttribute('aria-checked', 'true');
      await policiesList.cancelPolicyAutomations();
    } finally {
      // The policy first: Fleet won't delete a title an install policy points at.
      await deleteFleetPolicies(request, workstationsFleetId, [policy.id]);
      if (titleId !== undefined) await deleteSoftwareTitle(request, workstationsFleetId, titleId);
      if (scriptId !== undefined) await deleteScript(request, scriptId);
    }
  });
});

test.describe('Premium • Policies • automations with no ticket integration', () => {
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

    // The Manage automations button stays disabled until the scope has a policy.
    const { id: policyId } = await createPolicy(request, { name: `pw-policy-no-integration-${runNonce()}` });
    try {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select('All fleets');

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

test.describe("Premium • Policies • a fleet's failing-policies webhook", () => {
  // A throwaway fleet: saving a fleet's policy automations replaces the fleet's
  // whole `webhook_settings` (fleetdm/fleet#54619), so on Workstations this
  // would wipe the host-status webhook `team-host-status-webhook.spec.ts` is
  // writing there in parallel. The test deletes the fleet itself; this hook
  // catches a failed body, and `cleanup.steps.ts` sweeps `pw-*` fleets a dead
  // run left.
  let fleetId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (fleetId !== undefined) await deleteFleet(request, fleetId, { ignoreMissing: true });
    fleetId = undefined;
  });

  test("enabling it at a fleet's scope stores it on that fleet, not in global config", async ({
    policiesList,
    request,
  }) => {
    const n = runNonce();
    const fleetName = `pw-fleet-webhook-${n}`;
    const webhookUrl = 'https://example.com/pw-fleet-policy-webhook';

    const fleet = await createFleet(request, fleetName);
    fleetId = fleet.id;
    // The Manage automations button stays disabled until the scope has a policy.
    await createFleetPolicy(request, fleet.id, {
      name: `pw-fleet-webhook-policy-${n}`,
      query: 'SELECT 1;',
      platform: 'linux',
    });

    // Straight to the fleet's list by id: a menu of similarly named throwaway
    // fleets (another worker's, or batch runs') is where picking by label slips.
    await policiesList.goto({ fleetId: fleet.id });
    await expect(policiesList.teamDropdown.currentValue).toHaveText(fleetName);

    await policiesList.openAutomations();
    await expect(policiesList.automationsModal.getByRole('heading', { name: 'Webhooks or tickets' })).toBeVisible();
    await policiesList.setPolicyAutomations(true);
    await policiesList.selectWebhookWorkflow();
    await policiesList.policyWebhookUrlInput.fill(webhookUrl);
    await policiesList.saveAutomations();
    await policiesList.toast.expectSuccess('Successfully updated policy automations.');

    const stored = (await getFleetWebhookSettings(request, fleet.id)).failing_policies_webhook as
      | FailingPoliciesWebhook
      | undefined;
    expect(stored?.enable_failing_policies_webhook).toBe(true);
    expect(stored?.destination_url).toBe(webhookUrl);
    // Global config never sees this URL. (The global webhook itself may be on:
    // the serial describe above drives it from another worker.)
    const global = (await getAppConfig(request)).webhook_settings?.failing_policies_webhook ?? {};
    expect(global.destination_url).not.toBe(webhookUrl);

    // And the modal reopens on the fleet's webhook.
    await policiesList.openAutomations();
    await expect(policiesList.policyAutomationsToggle).toHaveAttribute('aria-checked', 'true');
    await expect(policiesList.policyWebhookUrlInput).toHaveValue(webhookUrl);

    await deleteFleet(request, fleet.id);
    fleetId = undefined;
  });
});
