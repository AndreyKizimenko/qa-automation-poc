/**
 * Policies CRUD lifecycle scoped to a specific fleet on premium.
 * Runs once per scope (All fleets + Workstations).
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import type { TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['All fleets', 'Workstations'];

for (const scope of SCOPES) {
  const slug = scope.replace(/\s+/g, '-').toLowerCase();

  test(`Policies — create → edit → delete (${scope})`, async ({
    dashboard,
    policiesList,
    policyEdit,
    request,
  }) => {
    const stamp = Date.now();
    const policyName = `playwright-policy-${slug}-${stamp}`;
    const editedName = `${policyName}-edited`;
    const sql = 'SELECT 1 AS one;';
    const editedSql = 'SELECT version FROM osquery_info;';

    await dashboard.goto();
    await dashboard.navbar.goToPolicies();
    await policiesList.teamDropdown.select(scope);

    await policiesList.addPolicy();
    await policyEdit.setSql(sql);
    const policyId = await policyEdit.saveNew(policyName);
    await assertActivity(request, 'created_policy', (d) => d.policy_name === policyName);

    await policyEdit.gotoEdit(policyId);
    await expect(policyEdit.nameInput).toHaveValue(policyName);
    await policyEdit.nameInput.fill(editedName);
    await policyEdit.setSql(editedSql);
    await policyEdit.saveExisting();
    await assertActivity(request, 'edited_policy', (d) => d.policy_name === editedName);

    await policyEdit.gotoEdit(policyId);
    await expect(policyEdit.nameInput).toHaveValue(editedName);
    expect(await policyEdit.sqlText()).toContain('osquery_info');

    await policiesList.goto();
    await policiesList.teamDropdown.select(scope);
    await policiesList.deletePolicy(editedName);

    await expect(policiesList.table.rowOrEmpty()).toBeVisible();
    await expect(policiesList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_policy', (d) => d.policy_name === editedName);
  });
}
