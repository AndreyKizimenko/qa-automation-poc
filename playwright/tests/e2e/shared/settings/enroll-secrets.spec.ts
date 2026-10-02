/**
 * Settings • Enroll secrets (global) — an admin adds a secret to the global
 * list from the Hosts page's gear menu, copies it, and deletes it, and the
 * secrets that were already there come through both writes untouched.
 *
 * **This list is what the simulated hosts enroll with.** The osquery-perf
 * daemons re-enroll with the global secret on every restart; delete it and the
 * ~300 simulations stop coming back. On free, gitops re-pins it nightly; on
 * premium nothing would. So the spec is built so that it can only ever remove
 * its own secret:
 *
 * - The secret it adds is a known marker (`pw-enroll-<ms>-…`, 32+ characters),
 *   and every row action finds its row by that value (`EnrollSecretModal`
 *   has no first-row shortcut).
 * - Fleet saves the list it has cached plus or minus one, and the modal shows
 *   "You have no enroll secrets" for a moment before the list arrives; a save
 *   in that moment would replace the whole list. So it waits until the modal
 *   lists as many secrets as the API does before adding.
 * - The `afterEach` is a union restore (`restoreGlobalEnrollSecrets`): the
 *   live list minus the marker, plus any original that has gone missing. Never
 *   a snapshot replace, which would drop anything added since.
 *
 * Shared: the global list, the modal and the endpoint are the same on both
 * tiers. On premium the Hosts page is put on All fleets, the scope whose
 * secrets are the global ones. Reading the clipboard needs the context's
 * clipboard permissions.
 *
 * Grounded in frontend/components/EnrollSecrets and ManageHostsPage
 * (`onSaveSecret` / `onDeleteSecret`).
 */
import { test, expect } from '@fixtures';
import { getGlobalEnrollSecrets, restoreGlobalEnrollSecrets, type EnrollSecret } from '@helpers/api';

const secretsOf = (list: EnrollSecret[]) => list.map((s) => s.secret);

test.describe('Settings • global enroll secrets', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  let original: EnrollSecret[] = [];
  let marker: string | undefined;

  test.beforeEach(async ({ request }) => {
    original = await getGlobalEnrollSecrets(request);
  });

  test.afterEach(async ({ request }) => {
    await restoreGlobalEnrollSecrets(request, { keep: original, remove: marker ? [marker] : [] });
    marker = undefined;
  });

  test('an admin adds, copies and deletes a global enroll secret, and the others stay', async ({
    dashboard,
    hostsList,
    request,
    page,
  }) => {
    expect(original.length, 'the instance has its global enroll secret').toBeGreaterThan(0);
    marker = `pw-enroll-${Date.now()}-${test.info().parallelIndex}-playwright`;

    await dashboard.goto();
    await dashboard.navbar.goToHosts();
    await hostsList.teamDropdown.select('All fleets');
    await hostsList.openEnrollSecretsFromMenu();
    const secrets = hostsList.enrollSecrets;
    await secrets.expectLoaded(original.length);

    await secrets.add(marker);
    await hostsList.toast.expectSuccess('Successfully added enroll secret.');
    await expect(secrets.rowFor(marker)).toHaveCount(1);
    const afterAdd = secretsOf(await getGlobalEnrollSecrets(request));
    expect(afterAdd).toContain(marker);
    expect(afterAdd, 'adding keeps every existing secret').toEqual(expect.arrayContaining(secretsOf(original)));

    await secrets.copy(marker);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(marker);

    await secrets.delete(marker);
    await hostsList.toast.expectSuccess('Successfully deleted enroll secret.');
    await expect(secrets.rowFor(marker)).toHaveCount(0);
    const afterDelete = secretsOf(await getGlobalEnrollSecrets(request));
    expect([...afterDelete].sort(), 'deleting removes only the marker').toEqual(
      [...secretsOf(original)].sort(),
    );
  });
});
