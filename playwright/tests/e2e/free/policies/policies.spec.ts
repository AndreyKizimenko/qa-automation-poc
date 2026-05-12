/**
 * Policies CRUD lifecycle on the free tier — no team dropdown. Each
 * lifecycle step is a serial sub-test; create + edit verify every field
 * on `/policies/:id` and reconfirm the row appears in the list.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import type { PolicyFormValues, SavePolicyValues } from '@pages';

test.describe('Policies CRUD', { tag: '@free' }, () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const policyName = `playwright-policy-${stamp}`;
  const editedName = `${policyName}-edited`;
  const createSql = 'SELECT 1 AS one;';

  const created: SavePolicyValues = {
    name: policyName,
    description: 'Created by Playwright',
    resolution: 'Created resolution',
  };

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

    await policiesList.addPolicy();
    await policyEdit.setSql(createSql);
    await policyEdit.saveNew(created);
    await assertActivity(request, 'created_policy', (d) => d.policy_name === policyName);

    await policyDetails.expectValues(created);

    await policyDetails.navbar.goToPolicies();
    await policiesList.search.fill(policyName);
    await expect(policiesList.table.rowWith(policyName)).toBeVisible();
  });

  test('edit', async ({ policiesList, policyEdit, policyDetails, request }) => {
    await policiesList.goto();
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
    await policiesList.search.fill(editedName);
    await expect(policiesList.table.rowWith(editedName)).toBeVisible();
  });

  test('delete', async ({ policiesList, request }) => {
    await policiesList.goto();
    await policiesList.deletePolicy(editedName);

    await expect(policiesList.table.rowOrEmpty()).toBeVisible();
    await expect(policiesList.table.rowWith(editedName)).toHaveCount(0);
    await assertActivity(request, 'deleted_policy', (d) => d.policy_name === editedName);
  });

  test('activity feed shows create → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      new RegExp(`created a policy ${policyName} globally\\.`),
      new RegExp(`edited the policy ${editedName} globally\\.`),
      new RegExp(`deleted the policy ${editedName} globally\\.`),
    ]);
  });
});
