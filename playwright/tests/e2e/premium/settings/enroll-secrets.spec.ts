/**
 * Premium • Settings • enroll secrets on a fleet. An admin adds a secret to the
 * Workstations fleet, copies it and deletes it; the add creates a new, distinct
 * secret beside the fleet's others, and the delete removes only that one.
 * Verified server-side after each write. The fleet's secrets are snapshotted
 * and restored through the API: nothing enrolls with Workstations' secrets, so
 * a snapshot replace is safe here (the global list's spec can't do that).
 *
 * The modal is opened via the `?fleet_id=…&manage_enroll_secrets=1` deep link;
 * the editor pre-fills a generated secret, which the test keeps. Row actions
 * find the row by the secret's value (`EnrollSecretModal`), and the test waits
 * for the modal to list the fleet's secrets before adding, since Fleet saves
 * its cached list plus one.
 *
 * Grounded in frontend/components/EnrollSecrets (EnrollSecretModal +
 * SecretEditorModal + DeleteSecretModal); toasts "Successfully added enroll
 * secret." / "Successfully deleted enroll secret.".
 */
import { test, expect } from '@fixtures';
import { getTeamEnrollSecrets, setTeamEnrollSecrets, type EnrollSecret } from '@helpers/api';

test.describe('Premium • Settings • enroll secrets', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  let original: EnrollSecret[];

  test.beforeEach(async ({ request, workstationsFleetId }) => {
    original = await getTeamEnrollSecrets(request, workstationsFleetId);
  });

  test.afterEach(async ({ request, workstationsFleetId }) => {
    await setTeamEnrollSecrets(request, workstationsFleetId, original);
  });

  test('add, copy and delete an enroll secret on the Workstations fleet', async ({
    hostsList,
    request,
    workstationsFleetId,
    page,
  }) => {
    const secrets = hostsList.enrollSecrets;
    await secrets.goto(workstationsFleetId);
    await secrets.expectLoaded(original.length);

    const added = await secrets.addGenerated();
    await hostsList.toast.expectSuccess('Successfully added enroll secret.');

    const after = await getTeamEnrollSecrets(request, workstationsFleetId);
    expect(after).toHaveLength(original.length + 1);
    expect(after.map((s) => s.secret)).toContain(added);

    await secrets.copy(added);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(added);

    await secrets.delete(added);
    await hostsList.toast.expectSuccess('Successfully deleted enroll secret.');
    await expect(secrets.rowFor(added)).toHaveCount(0);
    const afterDelete = await getTeamEnrollSecrets(request, workstationsFleetId);
    expect(afterDelete.map((s) => s.secret).sort()).toEqual(original.map((s) => s.secret).sort());
  });
});
