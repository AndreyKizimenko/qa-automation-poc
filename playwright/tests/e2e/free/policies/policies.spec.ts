/**
 * Policies CRUD lifecycle on the free tier — no team dropdown.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';

test.describe('Policies', { tag: '@free' }, () => {
  test('create → edit → delete', async ({
    dashboard,
    policiesList,
    policyEdit,
    request,
  }) => {
    const stamp = Date.now();
    const policyName = `playwright-policy-${stamp}`;
    const editedName = `${policyName}-edited`;
    const sql = 'SELECT 1 AS one;';
    const editedSql = 'SELECT version FROM osquery_info;';

    await dashboard.goto();
    await dashboard.navbar.goToPolicies();

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
    await policiesList.deletePolicy(editedName);

    await expect(policiesList.table.rowOrEmpty()).toBeVisible();
    await expect(policiesList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_policy', (d) => d.policy_name === editedName);
  });
});
