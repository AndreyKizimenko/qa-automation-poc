/**
 * Premium • Settings • MDM end-user migration workflow.
 *
 * The section (Settings → Integrations → MDM) renders only with Apple Business
 * Manager configured, true on this instance. Its switch gates the form: the
 * Voluntary / Forced radios are disabled and the webhook URL read-only while
 * it's off, and Save posts all three as `mdm.macos_migration` (global config,
 * premium only; no other spec reads it).
 *
 *  - the webhook URL is validated client-side ("Must be a valid URL."); nothing
 *    is saved.
 *  - a mode and a webhook URL save with the workflow **disabled**, and read back
 *    through the API and after a reload. The workflow is never saved enabled:
 *    enabled, Fleet Desktop starts prompting eligible Macs to migrate. Fleet
 *    validates the mode and URL only when the workflow is enabled, so the
 *    disabled save stores them as given. The snapshot taken first is restored in
 *    an `afterEach`.
 *
 * Grounded in
 * frontend/pages/admin/IntegrationsPage/cards/MdmSettings/.../EndUserMigrationSection.
 */
import { test, expect } from '@fixtures';
import { getMacosMigration, patchAppConfig, type MacosMigration } from '@helpers/api';

test.describe('Premium • Settings • MDM end-user migration', () => {
  // Set only by the test that saves, so the other test's run can't restore over it.
  let saved: MacosMigration | undefined;

  test.afterEach(async ({ request }) => {
    if (!saved) return;
    await patchAppConfig(request, { mdm: { macos_migration: saved } });
    saved = undefined;
  });

  test('the migration webhook URL is validated client-side', async ({ integrationsPage }) => {
    await integrationsPage.gotoMdm();
    await expect(integrationsPage.migrationSection).toBeVisible();

    // Enable the workflow (client-side only — never saved) to unlock the field.
    await integrationsPage.setMigrationEnabled(true);

    await integrationsPage.migrationWebhookUrl.fill('not a url');
    await expect(integrationsPage.migrationSection.getByText('Must be a valid URL.')).toBeVisible();

    await integrationsPage.migrationWebhookUrl.fill('https://example.com/pw-migration');
    await expect(integrationsPage.migrationSection.getByText('Must be a valid URL.')).toHaveCount(0);
  });

  test('a mode and webhook URL save with the workflow disabled, and read back', async ({
    integrationsPage,
    request,
    page,
  }) => {
    const before = await getMacosMigration(request);
    saved = before;
    // Values the stored ones can't already be, so only a working save shows them.
    const mode: 'voluntary' | 'forced' = before.mode === 'forced' ? 'voluntary' : 'forced';
    const webhookUrl = `https://example.com/pw-migration-${Date.now()}`;
    const modeRadio = mode === 'forced' ? integrationsPage.migrationForcedRadio : integrationsPage.migrationVoluntaryRadio;

    await integrationsPage.gotoMdm();

    // Off, the form is locked; on, it opens.
    await integrationsPage.setMigrationEnabled(false);
    await expect(integrationsPage.migrationVoluntaryRadio).toBeDisabled();
    await expect(integrationsPage.migrationForcedRadio).toBeDisabled();
    await expect(integrationsPage.migrationWebhookUrl).not.toBeEditable();
    await integrationsPage.setMigrationEnabled(true);
    await expect(modeRadio).toBeEnabled();
    await expect(integrationsPage.migrationWebhookUrl).toBeEditable();

    await integrationsPage.chooseMigrationMode(mode);
    await integrationsPage.migrationWebhookUrl.fill(webhookUrl);
    await integrationsPage.setMigrationEnabled(false);
    await integrationsPage.saveMigration();
    expect(await getMacosMigration(request)).toEqual({ enable: false, mode, webhook_url: webhookUrl });

    await page.reload();
    await expect(integrationsPage.eulaHeading).toBeVisible();
    await expect(integrationsPage.migrationSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(modeRadio).toBeChecked();
    await expect(integrationsPage.migrationWebhookUrl).toHaveValue(webhookUrl);
  });
});
