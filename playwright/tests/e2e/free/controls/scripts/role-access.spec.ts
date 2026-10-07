/**
 * Free • Controls • Scripts • what each role is shown — the free half of
 * `premium/controls/scripts/role-access.spec.ts`. Free has
 * scripts, and the same route guard: a global maintainer gets the library with
 * "Add script" and each script's Edit / Download / Delete; a global observer
 * gets the 403 page on Controls.
 *
 * The maintainer reads a `pw-role-*` script the spec puts in the (only) library
 * through the API, deleted in an `afterEach`; `cleanup-setup` wipes Unassigned's
 * scripts anyway. Nothing is uploaded through the UI, and nothing runs: on free
 * the real VMs share that library's scope.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { deleteScript, uploadScript } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { AccessDenied, ScriptsLibraryPage } from '@pages';

let scriptId: number | undefined;

test.afterEach(async ({ request }) => {
  if (scriptId !== undefined) await deleteScript(request, scriptId);
  scriptId = undefined;
});

test.describe('Free • Controls • Scripts • role access', () => {
  test('global-maintainer is shown the script library controls its role grants', async ({ browser, request }) => {
    const name = `pw-role-script-${runNonce()}.sh`;
    scriptId = await uploadScript(request, 0, name, '#!/bin/sh\necho pw-role\n');

    await withStaticUser(browser, 'global-maintainer', async (page) => {
      const scripts = new ScriptsLibraryPage(page);
      await scripts.goto();

      const row = scripts.itemByName(name);
      await expect(row).toBeVisible();
      await expect(scripts.addScriptButton).toBeVisible();
      for (const action of ['Edit', 'Download', 'Delete']) {
        await expect(row.getByRole('button', { name: `${action} ${name}` })).toBeVisible();
      }
    });
  });

  test('global-observer is turned away from Controls', async ({ browser }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      await new AccessDenied(page).expectAt('/controls/scripts/library');
    });
  });
});
