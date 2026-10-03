/**
 * Shared • Policies • AI Autofill. In the Save policy modal, "Autofill" beside
 * Description and Resolution asks Fleet to explain the policy's SQL: Fleet
 * (`POST /autofill/policy`, no license check) forwards the SQL to fleetdm.com,
 * which answers with an LLM-written description and resolution, and the modal
 * fills both fields from that one answer.
 *
 * The call is real, not stubbed: a stub would only prove the React handler
 * copies a response into two textareas, while the live call proves the whole
 * chain the customer depends on. The wording is an LLM's, so the test asserts
 * only that each field fills. If fleetdm.com is down this goes red, which is a
 * customer-visible outage, not a test bug. Nothing is saved: the modal is
 * cancelled.
 *
 * Needs Generative AI on (Settings › Advanced › Features), which is Fleet's
 * default and how both instances run; the test checks it first so a disabled
 * setting fails as that, not as an empty field. Both tiers render the same
 * buttons (`SaveNewPolicyModal`), so the spec is shared.
 */
import { test, expect } from '@fixtures';
import { getAppConfig } from '@helpers/api';

// Fleet gives fleetdm.com 30 s before it answers 422; an answer usually takes ~3 s.
const AUTOFILL_TIMEOUT = 35_000;

test.describe('Shared • Policies • AI Autofill', () => {
  test('Autofill writes a description and a resolution for the SQL', async ({
    dashboard,
    policiesList,
    policyEdit,
    request,
  }) => {
    test.setTimeout(90_000);
    const { server_settings: serverSettings } = await getAppConfig(request);
    expect(serverSettings?.ai_features_disabled, 'Generative AI is on (Settings › Advanced › Features)').toBe(false);

    await dashboard.goto();
    await dashboard.navbar.goToPolicies();
    await policiesList.teamDropdown.select('All fleets');
    await policiesList.addPolicy();
    await policyEdit.setSql('SELECT name, version FROM os_version;');

    await policyEdit.saveButton.click();
    await expect(policyEdit.saveNewModal).toBeVisible();
    await expect(policyEdit.saveNewDescriptionInput).toHaveValue('');
    await expect(policyEdit.saveNewResolutionInput).toHaveValue('');

    // The first click fetches the answer and fills Description; the second
    // fills Resolution from the same answer.
    await policyEdit.autofillButton('Description').click();
    await expect(policyEdit.saveNewDescriptionInput).not.toHaveValue('', { timeout: AUTOFILL_TIMEOUT });
    await policyEdit.autofillButton('Resolution').click();
    await expect(policyEdit.saveNewResolutionInput).not.toHaveValue('', { timeout: AUTOFILL_TIMEOUT });

    await policyEdit.saveNewCancelButton.click();
    await expect(policyEdit.saveNewModal).toBeHidden();
  });
});
