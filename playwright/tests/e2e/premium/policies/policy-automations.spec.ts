/**
 * Premium • Policies • automations, both ways the policies list sets them:
 *
 *   - **Scope-wide** — the "Manage automations" button's modal enables the
 *     global failing-policies webhook with a destination URL; the change
 *     persists (verified server-side). This mutates GLOBAL config
 *     (webhook_settings.failing_policies_webhook): the original is snapshotted
 *     and restored via the config helper, and a global policy is seeded so the
 *     button is enabled (it's disabled until the scope has ≥1 policy).
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
import { inertDeb } from '@helpers/deb';
import { runNonce } from '@helpers/profiles';
import {
  createFleetPolicy,
  createPolicy,
  deleteFleetPolicies,
  deletePolicies,
  deleteScript,
  deleteSoftwareTitle,
  getAppConfig,
  getFleetPolicy,
  patchAppConfig,
  uploadScript,
  uploadSoftwarePackageBuffer,
  type FailingPoliciesWebhook,
} from '@helpers/api';

test.describe('Premium • Policies • automations', () => {
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
