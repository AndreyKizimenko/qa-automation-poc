/**
 * Policies CRUD lifecycle scoped to a specific fleet on premium. Each
 * scope (All fleets + Workstations) runs as a serial describe so a
 * per-step failure pinpoints which CRUD action regressed.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
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
      // Fleet renders policy activity as "<actor> created a policy <name> ...",
      // "edited the policy <name> ...", "deleted the policy <name> ...".
      // The suffix is "globally." (All fleets) or "on the <fleet> fleet."
      const suffix = scope === 'All fleets' ? 'globally' : `on the ${scope} fleet`;
      await dashboard.expectActivities([
        new RegExp(`created a policy ${policyName} ${suffix}\\.`),
        new RegExp(`edited the policy ${editedName} ${suffix}\\.`),
        new RegExp(`deleted the policy ${editedName} ${suffix}\\.`),
      ]);
    });
  });
}
