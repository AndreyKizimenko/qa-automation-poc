/**
 * Premium • Policies • what each role is shown. One test per role over the
 * Policies list (Add policy, Manage automations, row checkboxes, the
 * Automations cell as a button or plain text) and a policy's details page
 * (Run policy, Edit policy), plus the 403 a role gets on `/policies/new`.
 *
 * The cells come from Fleet's gating, not from the QA Wolf flows they replace
 * (round 1 C3 #20, #23, #30, #33, #34, #35), whose checks were mostly stale copy
 * ("Add a policy") or absences on a page nothing proved had rendered:
 *   - `ManagePoliciesPage`: Add policy and row checkboxes for GA, GM, TA, TM;
 *     Manage automations for GA and TA; the Automations cell is a button only
 *     for a role that can open its modal (`PoliciesTableConfig`), and an
 *     inherited row on a fleet's list has a tag and no checkbox.
 *   - `PolicyDetailsPage`: Edit for GA and GM, and for TA and TM on their own
 *     fleet's policies but never an inherited one; Run for every role but the
 *     plain observers.
 *   - the router sends GO, GO+, GT and TO to the 403 page on `/policies/new`.
 *
 * Team flags follow the fleet in the URL (`useTeamIdParam`), so a team role
 * reads Workstations, and every policy is opened from the list, whose links
 * carry the fleet — as a user would. A global role reads All fleets.
 *
 * Every absence is anchored on something the same role is shown on the same
 * screen — the seeded row, its Automations cell, the details page's Show query
 * — so a page that never rendered can't pass as a withheld control.
 *
 * The policies are this spec's own, created through the API per test and
 * deleted in an `afterEach` (a timed-out test skips its `finally`);
 * `cleanup-setup` drains global and Workstations policies anyway. Names are
 * `pw-role-*` and unique per test, and the list is searched down to each.
 *
 * The writes (C3 #31, #32) are one test per team role: a fleet policy saved
 * from the UI, read back with the role as its author. Editing and deleting
 * take the admin's form and endpoints (`policies.spec.ts`), so they aren't
 * repeated per role. A global maintainer's fleet create (C3 #21) runs the
 * admin's code path outright and is cut.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import {
  createFleetPolicy,
  createPolicy,
  deleteFleetPolicies,
  deletePolicies,
  getFleetPolicy,
  listFleetPolicies,
  staticUser,
  type StaticUserKey,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { AccessDenied, PoliciesListPage, PolicyDetailsPage, PolicyEditPage } from '@pages';

interface RoleCase {
  key: StaticUserKey;
  /** Global roles read All fleets; a team role reads its own fleet. */
  scope: 'All fleets' | 'Workstations';
  /** A role on a single fleet gets no fleet picker, only the fleet's name as the page title. */
  singleFleet?: boolean;
  /** Add policy, row checkboxes and an Automations cell that opens its modal. */
  author: boolean;
  manageAutomations: boolean;
  /** Edit policy on a policy of `scope` (never on an inherited one for a team role). */
  edit: boolean;
  run: boolean;
}

const ROLES: RoleCase[] = [
  { key: 'global-maintainer', scope: 'All fleets', author: true, manageAutomations: false, edit: true, run: true },
  { key: 'global-observer', scope: 'All fleets', author: false, manageAutomations: false, edit: false, run: false },
  {
    key: 'global-observer-plus',
    scope: 'All fleets',
    author: false,
    manageAutomations: false,
    edit: false,
    run: true,
  },
  { key: 'global-technician', scope: 'All fleets', author: false, manageAutomations: false, edit: false, run: true },
  { key: 'team-admin', scope: 'Workstations', author: true, manageAutomations: true, edit: true, run: true },
  {
    key: 'ws-maintainer',
    scope: 'Workstations',
    singleFleet: true,
    author: true,
    manageAutomations: false,
    edit: true,
    run: true,
  },
  {
    key: 'ws-observer',
    scope: 'Workstations',
    singleFleet: true,
    author: false,
    manageAutomations: false,
    edit: false,
    run: false,
  },
];

/**
 * What a test created, for the `afterEach` to remove. Per worker, reset per
 * test. A UI-saved policy is tracked by name before it's saved, so one that
 * Fleet stored before the test failed is still found.
 */
let globalIds: number[] = [];
let fleetPolicyNames: { fleetId: number; name: string }[] = [];

test.afterEach(async ({ request }) => {
  await deletePolicies(request, globalIds);
  for (const fleetId of new Set(fleetPolicyNames.map((p) => p.fleetId))) {
    const names = fleetPolicyNames.filter((p) => p.fleetId === fleetId).map((p) => p.name);
    const leftover = (await listFleetPolicies(request, fleetId)).filter((p) => names.includes(p.name));
    await deleteFleetPolicies(request, fleetId, leftover.map((p) => p.id));
  }
  globalIds = [];
  fleetPolicyNames = [];
});

/** Opens the Policies list on the role's scope. */
async function openList(page: Page, role: RoleCase, workstationsFleetId: number): Promise<PoliciesListPage> {
  const list = new PoliciesListPage(page);
  if (role.scope === 'All fleets') {
    await list.goto();
    await list.teamDropdown.select('All fleets');
  } else {
    await list.goto({ fleetId: workstationsFleetId });
    if (role.singleFleet) {
      // One fleet means no picker: the fleet's name is the page title.
      await expect(list.teamDropdown.trigger).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Workstations', level: 1 })).toBeVisible();
    } else {
      await list.teamDropdown.select('Workstations');
    }
  }
  return list;
}

/**
 * The row's own controls: a checkbox and an Automations cell that's a button for
 * a role that can write, neither for one that can't. The Automations cell is
 * read by column either way, so a role without the button is still shown to
 * have the cell.
 */
async function expectRowControls(list: PoliciesListPage, name: string, author: boolean): Promise<void> {
  const row = await list.narrowTo(name);
  const automations = await list.table.cellByColumn(row, 'Automations');
  await expect(automations).toBeVisible();
  if (author) {
    await expect(row.getByRole('checkbox')).toHaveCount(1);
    await expect(list.automationsCell(name)).toBeVisible();
  } else {
    await expect(row.getByRole('checkbox')).toHaveCount(0);
    await expect(automations.getByRole('button')).toHaveCount(0);
  }
}

/** Opens `name` from the list and checks its Run and Edit against the role. */
async function expectDetails(
  page: Page,
  list: PoliciesListPage,
  name: string,
  expected: { run: boolean; edit: boolean },
): Promise<void> {
  const details = new PolicyDetailsPage(page);
  await list.openPolicy(name);
  await expect(details.nameHeading).toContainText(name);
  await expect(details.showQueryButton).toBeVisible();
  await expect(details.runButton).toHaveCount(expected.run ? 1 : 0);
  await expect(details.editButton).toHaveCount(expected.edit ? 1 : 0);
}

test.describe('Premium • Policies • role access', () => {
  for (const role of ROLES) {
    test(`${role.key} is shown the policy controls its role grants`, async ({
      browser,
      request,
      workstationsFleetId,
    }) => {
      const stamp = runNonce();
      const globalName = `pw-role-pol-global-${role.key}-${stamp}`;
      const global = await createPolicy(request, { name: globalName });
      globalIds.push(global.id);

      let ownName = globalName;
      if (role.scope === 'Workstations') {
        ownName = `pw-role-pol-ws-${role.key}-${stamp}`;
        fleetPolicyNames.push({ fleetId: workstationsFleetId, name: ownName });
        await createFleetPolicy(request, workstationsFleetId, { name: ownName, query: 'SELECT 1;' });
      }

      await withStaticUser(browser, role.key, async (page) => {
        const list = await openList(page, role, workstationsFleetId);

        await expectRowControls(list, ownName, role.author);
        // Both header controls are judged once the seeded row has rendered.
        await expect(list.addPolicyButton).toHaveCount(role.author ? 1 : 0);
        await expect(list.manageAutomationsButton).toHaveCount(role.manageAutomations ? 1 : 0);

        if (role.manageAutomations) {
          // A team admin may open its fleet's automations; the save itself is
          // B's `policy-automations.spec.ts` (as admin, on a throwaway fleet).
          await list.openAutomations();
          await expect(list.automationsModal.getByText('Webhook', { exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(list.automationsModal).toBeHidden();
        }

        if (role.scope === 'Workstations') {
          // A global policy seen from a fleet: tagged, never selectable, and
          // never editable by a team role — whatever it may do to its own.
          const inherited = await list.narrowTo(globalName);
          await expect(inherited.getByText('Inherited', { exact: true })).toBeVisible();
          await expect(inherited.getByRole('checkbox')).toHaveCount(0);
          await expectDetails(page, list, globalName, { run: role.run, edit: false });
          await openList(page, role, workstationsFleetId);
          await list.narrowTo(ownName);
        }

        await expectDetails(page, list, ownName, { run: role.run, edit: role.edit });

        if (!role.author) {
          const fleetQuery = role.scope === 'Workstations' ? `?fleet_id=${workstationsFleetId}` : '';
          await new AccessDenied(page).expectAt(`/policies/new${fleetQuery}`);
        }
      });
    });
  }

  // TODO(fleetdm/fleet#54624): a global observer+ gets no Run policy on an
  // Unassigned policy. `useTeamIdParam` computes `isObserverPlus` as
  // `!!currentTeam?.id && …`, and Unassigned's id is 0, while Fleet's role table
  // says observer+ runs every policy. Un-skip once the fix ships.
  test.skip('global-observer-plus is offered Run policy on an Unassigned policy', async ({ browser, request }) => {
    const name = `pw-role-pol-unassigned-${runNonce()}`;
    fleetPolicyNames.push({ fleetId: 0, name });
    await createFleetPolicy(request, 0, { name, query: 'SELECT 1;' });

    await withStaticUser(browser, 'global-observer-plus', async (page) => {
      const list = new PoliciesListPage(page);
      await list.goto({ fleetId: 0 });
      await list.teamDropdown.select('Unassigned');
      await list.narrowTo(name);
      await expectDetails(page, list, name, { run: true, edit: false });
    });
  });

  for (const key of ['team-admin', 'ws-maintainer'] as const) {
    test(`${key} creates a Workstations policy from the UI`, async ({ browser, request, workstationsFleetId }) => {
      const name = `pw-role-pol-create-${key}-${runNonce()}`;
      const role = ROLES.find((r) => r.key === key)!;
      fleetPolicyNames.push({ fleetId: workstationsFleetId, name });

      const id = await withStaticUser(browser, key, async (page) => {
        const list = await openList(page, role, workstationsFleetId);
        const edit = new PolicyEditPage(page);
        await list.addPolicy();
        await edit.setSql('SELECT 1;');
        return edit.saveNew({ name, description: '', resolution: '' });
      });

      // Saved on the fleet, and by the role rather than by anyone with more reach.
      const stored = await getFleetPolicy(request, workstationsFleetId, id);
      expect(stored.name).toBe(name);
      expect(stored.teamId).toBe(workstationsFleetId);
      expect(stored.authorEmail).toBe(staticUser(key).email);
      expect((await listFleetPolicies(request, workstationsFleetId)).map((p) => p.id)).toContain(id);
    });
  }
});
