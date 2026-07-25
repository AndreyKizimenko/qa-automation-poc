/**
 * Premium • Settings • enroll secrets. Adding an enroll secret to the
 * Workstations fleet creates a new, distinct secret that joins the fleet's
 * list. Verified server-side (authoritative). The fleet's secrets are
 * snapshotted + restored via the API so the shared instance is left unchanged.
 *
 * Grounded in frontend/components/EnrollSecrets (EnrollSecretModal +
 * SecretEditorModal) — the modal is opened via the ?manage_enroll_secrets=1
 * deep link; the editor pre-fills a generated secret; toast "Successfully added
 * enroll secret.".
 */
import { test, expect } from '@fixtures';
import { getTeamEnrollSecrets, setTeamEnrollSecrets, type EnrollSecret } from '@helpers/api';

test.describe('Premium • Settings • enroll secrets', () => {
  let original: EnrollSecret[];

  test.beforeEach(async ({ request, workstationsFleetId }) => {
    original = await getTeamEnrollSecrets(request, workstationsFleetId);
  });

  test.afterEach(async ({ request, workstationsFleetId }) => {
    await setTeamEnrollSecrets(request, workstationsFleetId, original);
  });

  test('add an enroll secret to the Workstations fleet', async ({
    hostsList,
    request,
    workstationsFleetId,
  }) => {
    await hostsList.openEnrollSecrets(workstationsFleetId);
    const added = await hostsList.addEnrollSecret();
    await hostsList.toast.expectSuccess('Successfully added enroll secret.');

    const after = await getTeamEnrollSecrets(request, workstationsFleetId);
    expect(after).toHaveLength(original.length + 1);
    expect(after.map((s) => s.secret)).toContain(added);
  });
});
