/**
 * Policies CRUD lifecycle scoped to a specific fleet on premium. Each
 * scope (All fleets + Workstations) runs as a serial describe so a
 * per-step failure pinpoints which CRUD action regressed.
 *
 * Then fleet isolation, on its own: a Workstations policy is listed under
 * Workstations and not under the VMs fleet. Reading the VMs fleet's list
 * changes nothing on it.
 */
import { test, expect } from '@fixtures';
import { assertActivity, createFleetPolicy, deleteFleetPolicies } from '@helpers/api';
import { VMS_FLEET } from '@helpers/api/static-users';
import { runNonce } from '@helpers/profiles';
import { activityCopy } from '@helpers/activity-copy';
import { fleetIdFor } from '@helpers/team-scope';
import type { PolicyFormValues, SavePolicyValues, TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['All fleets', 'Workstations'];

for (const scope of SCOPES) {
  const slug = scope.replace(/\s+/g, '-').toLowerCase();

  test.describe(`Policies CRUD (${scope})`, () => {
    test.describe.configure({ mode: 'serial' });

    const stamp = Date.now();
    const policyName = `playwright-policy-${slug}-${stamp}`;
    const editedName = `${policyName}-edited`;
    const createSql = 'SELECT 1 AS one;';

    const created: SavePolicyValues = {
      name: policyName,
      description: 'Created by Playwright',
      resolution: 'Created resolution',
    };

    // Edit values diverge from create in every text field + the SQL +
    // platforms, so a stuck field surfaces at the post-save verification.
    const edited: PolicyFormValues = {
      name: editedName,
      description: 'Edited by Playwright',
      resolution: 'Edited resolution',
      platforms: ['Windows', 'Linux'],
      sql: 'SELECT version FROM osquery_info;',
    };

    test('create', async ({ dashboard, policiesList, policyEdit, policyDetails, request }) => {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select(scope);

      await policiesList.addPolicy();
      await policyEdit.setSql(createSql);
      await policyEdit.saveNew(created);
      await assertActivity(request, 'created_policy', (d) => d.policy_name === policyName);

      // saveNew lands us on /policies/:id — verify the details page reflects
      // the values that went through the modal.
      await policyDetails.expectValues(created);

      // The details page surfaces the three primary policy actions.
      await expect(policyDetails.showQueryButton).toBeVisible();
      await expect(policyDetails.runButton).toBeVisible();
      await expect(policyDetails.editButton).toBeVisible();

      // Click "Policies" in the navbar — confirm the new row is present.
      // Re-select the scope (the navbar click preserves the last-used
      // team filter) and search by name (the list is paginated; new
      // policies may not be on page 1).
      await policyDetails.navbar.goToPolicies();
      await policiesList.teamDropdown.select(scope);
      await policiesList.search.fill(policyName);
      await expect(policiesList.table.rowWith(policyName)).toBeVisible();
    });

    test('edit', async ({ policiesList, policyEdit, policyDetails, request, workstationsFleetId }) => {
      await policiesList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await policiesList.teamDropdown.select(scope);
      await policiesList.openPolicy(policyName);
      await policyDetails.clickEdit();
      await expect(policyEdit.nameInput).toHaveValue(policyName);

      await policyEdit.fillAll(edited);
      await policyEdit.saveExisting();
      await assertActivity(request, 'edited_policy', (d) => d.policy_name === editedName);

      await policyEdit.backToPolicy();
      await policyDetails.expectValues(edited);
      expect((await policyDetails.showQuery()).trim()).toContain(edited.sql.trim());

      await policyDetails.navbar.goToPolicies();
      await policiesList.teamDropdown.select(scope);
      await policiesList.search.fill(editedName);
      await expect(policiesList.table.rowWith(editedName)).toBeVisible();
    });

    test('delete', async ({ policiesList, request, workstationsFleetId }) => {
      await policiesList.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
      await policiesList.teamDropdown.select(scope);
      await policiesList.deletePolicy(editedName);

      await expect(policiesList.table.rowOrEmpty()).toBeVisible();
      await expect(policiesList.table.rowWith(editedName)).toHaveCount(0);
      await assertActivity(request, 'deleted_policy', (d) => d.policy_name === editedName);
    });

    test('activity feed shows create → edit → delete', async ({ dashboard }) => {
      await dashboard.goto();
      await dashboard.expectActivities([
        activityCopy.policy.created({ name: policyName, scope }),
        activityCopy.policy.edited({ name: editedName, scope }),
        activityCopy.policy.deleted({ name: editedName, scope }),
      ]);
    });
  });
}

test.describe('Policies — fleet isolation', () => {
  test("a fleet's policy is listed under its fleet and not under another", async ({
    dashboard,
    policiesList,
    request,
    workstationsFleetId,
    vmsFleetId,
  }) => {
    const name = `pw-policy-isolation-${runNonce()}`;
    const policy = await createFleetPolicy(request, workstationsFleetId, { name, query: 'SELECT 1;' });

    try {
      await dashboard.goto();
      await dashboard.navbar.goToPolicies();
      await policiesList.teamDropdown.select('Workstations');
      await policiesList.search.fill(name);
      await expect(policiesList.table.rowWith(name)).toBeVisible();

      await policiesList.teamDropdown.selectByLabel(VMS_FLEET);
      await expect(policiesList.page).toHaveURL(new RegExp(`fleet_id=${vmsFleetId}\\b`));
      await policiesList.search.fill(name);
      await policiesList.table.waitForSettled();
      // The empty state is what proves the VMs list loaded with this search,
      // so the missing row is an answer rather than a page still loading.
      await expect(policiesList.table.emptyState).toBeVisible();
      await expect(policiesList.table.rowWith(name)).toHaveCount(0);
    } finally {
      await deleteFleetPolicies(request, workstationsFleetId, [policy.id]);
    }
  });
});
