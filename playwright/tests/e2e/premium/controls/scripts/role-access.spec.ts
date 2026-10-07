/**
 * Premium • Controls • Scripts • what each role is shown (round 1 C7 #26; round
 * 3, batch E). The Controls area is a 403 for the observers — plain, observer+
 * and a fleet's (`router/index.tsx`, `AuthAnyMaintainerAdminTechnicianRoutes`).
 * Inside it, the script library offers "Add script" and each script's Edit /
 * Download / Delete to every role that reaches it except a technician, who
 * gets the list alone (`ScriptLibrary`, `ScriptListItem`).
 *
 * QA Wolf's flow uploaded a script to a fleet as a global maintainer. The upload
 * takes the admin's form and endpoint (`scripts.spec.ts`), so the role's cell is
 * the control, not a second upload.
 *
 * Every role reads Workstations, where the spec puts one `pw-role-*` script
 * through the API, so a role's missing row actions are read off a row it can see.
 * The script is deleted in an `afterEach`; `cleanup-setup` wipes Workstations'
 * scripts anyway.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { deleteScript, uploadScript, type StaticUserKey } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { AccessDenied, ScriptsLibraryPage } from '@pages';

interface RoleCase {
  key: StaticUserKey;
  /** null: the role is turned away from Controls. */
  manage: boolean | null;
  singleFleet?: boolean;
}

const ROLES: RoleCase[] = [
  { key: 'global-maintainer', manage: true },
  { key: 'global-technician', manage: false },
  { key: 'ws-maintainer', manage: true, singleFleet: true },
  { key: 'global-observer', manage: null },
  { key: 'global-observer-plus', manage: null },
  { key: 'ws-observer', manage: null, singleFleet: true },
];

let scriptId: number | undefined;

test.afterEach(async ({ request }) => {
  if (scriptId !== undefined) await deleteScript(request, scriptId);
  scriptId = undefined;
});

test.describe('Premium • Controls • Scripts • role access', () => {
  for (const role of ROLES) {
    const outcome =
      role.manage === null ? 'is turned away from Controls' : 'is shown the script library controls its role grants';

    test(`${role.key} ${outcome}`, async ({ browser, request, workstationsFleetId }) => {
      const name = `pw-role-script-${runNonce()}.sh`;
      if (role.manage !== null) {
        scriptId = await uploadScript(request, workstationsFleetId, name, '#!/bin/sh\necho pw-role\n');
      }

      await withStaticUser(browser, role.key, async (page) => {
        if (role.manage === null) {
          await new AccessDenied(page).expectAt(`/controls/scripts/library?fleet_id=${workstationsFleetId}`);
          return;
        }

        const scripts = new ScriptsLibraryPage(page);
        await scripts.goto({ fleetId: workstationsFleetId });
        if (!role.singleFleet) await scripts.teamDropdown.select('Workstations');

        const row = scripts.itemByName(name);
        await expect(row).toBeVisible();
        await expect(scripts.addScriptButton).toHaveCount(role.manage ? 1 : 0);
        for (const action of ['Edit', 'Download', 'Delete']) {
          await expect(row.getByRole('button', { name: `${action} ${name}` })).toHaveCount(role.manage ? 1 : 0);
        }
      });
    });
  }
});
