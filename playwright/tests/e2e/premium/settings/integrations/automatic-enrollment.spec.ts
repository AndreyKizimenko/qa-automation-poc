/**
 * Premium • Settings • Integrations • Automatic enrollment.
 *
 * Two concerns of the Apple automatic-enrollment / end-user setup flow, which
 * live on different Integrations cards (the "Automatic enrollment" page is a
 * legacy name that now redirects):
 *   - macOS EULA upload/delete — on the MDM card (/settings/integrations/mdm),
 *     rendered only when Apple Business Manager is configured (true here).
 *   - End-user authentication IdP form — on the SSO card's "End users" tab
 *     (/settings/integrations/sso/end-users).
 *
 * The EULA is a single global entity and cleanup.steps.ts does not wipe it, so
 * that test removes any EULA as a precondition and in teardown. The SSO form is
 * exercised client-side only (no save) — saving would PATCH global config.
 * Premium-only.
 */
import { test, expect } from '@fixtures';
import { getEulaMetadata, deleteEulaIfPresent } from '@helpers/api';

// Fleet's EULA endpoint validates the %PDF magic prefix, not full PDF
// structure, so this tiny buffer is accepted while staying far under the
// 26.21MB limit — no committed multi-MB fixture needed.
const EULA_PDF = Buffer.from('%PDF-1.7\nFleet QA automation test EULA.\n%%EOF\n');
const EULA_NAME = 'pw-eula.pdf';

test.describe('Premium • Settings • Automatic enrollment — EULA', () => {
  test.afterEach(async ({ request }) => {
    await deleteEulaIfPresent(request);
  });

  test('upload then delete a macOS EULA', async ({ integrationsPage, request }) => {
    // Start from a known-empty state (an aborted run could have left one).
    await deleteEulaIfPresent(request);

    await integrationsPage.gotoMdm();
    await integrationsPage.uploadEula({
      name: EULA_NAME,
      mimeType: 'application/pdf',
      buffer: EULA_PDF,
    });

    await expect(integrationsPage.eulaName).toHaveText(EULA_NAME);
    expect((await getEulaMetadata(request))?.name).toBe(EULA_NAME);

    await integrationsPage.deleteEula();
    expect(await getEulaMetadata(request)).toBeNull();
  });
});

test.describe('Premium • Settings • Automatic enrollment — end-user authentication (SSO)', () => {
  test('IdP form renders and Save is gated on the required fields', async ({ integrationsPage }) => {
    await integrationsPage.gotoSsoEndUsers();

    await expect(integrationsPage.idpNameField).toBeVisible();
    await expect(integrationsPage.entityIdField).toBeVisible();
    await expect(integrationsPage.metadataUrlField).toBeVisible();
    await expect(integrationsPage.metadataField).toBeVisible();

    // Client-side only — the form is filled but never saved, so no global
    // config is mutated. With every required field set, Save enables; clearing
    // a required field (identity provider name) disables it again.
    await integrationsPage.fillEndUserAuth({
      idpName: 'pw-idp',
      entityId: 'pw-entity-id',
      metadataUrl: 'https://idp.example.com/metadata.xml',
    });
    await expect(integrationsPage.endUserAuthSaveButton).toBeEnabled();

    await integrationsPage.idpNameField.fill('');
    await expect(integrationsPage.endUserAuthSaveButton).toBeDisabled();
  });
});
