/**
 * Premium • Settings • Integrations • Automatic enrollment — macOS EULA.
 *
 * Uploads a EULA PDF on the MDM integrations card (shown to end users during
 * Apple automatic enrollment), verifies it landed via the UI and the API, then
 * deletes it. The EULA is a single global entity and cleanup.steps.ts does not
 * wipe it, so the test removes any EULA as a precondition and in teardown.
 *
 * Requires Apple Business Manager configured (true on this instance) — the
 * EULA section only renders then. Premium-only.
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
