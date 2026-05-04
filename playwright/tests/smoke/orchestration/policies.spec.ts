/**
 * Policies CRUD lifecycle (UI-only) on the smoke fleet.
 *
 * One end-to-end flow per run: create a new policy, navigate back into
 * edit mode, change the name + SQL, save, then delete from the list.
 * Each run uses a timestamped name so retries against a non-fresh fleet
 * don't collide.
 */
import { test, expect } from '@fixtures';

test('Policies — create → edit → delete', async ({
  dashboard,
  policiesList,
  policyEdit,
  softwareFleet,
}) => {
  const stamp = Date.now();
  const policyName = `playwright-policy-${stamp}`;
  const editedName = `${policyName}-edited`;
  const sql = 'SELECT 1 AS one;';
  const editedSql = 'SELECT version FROM osquery_info;';

  await dashboard.goto({ fleetId: softwareFleet.id });
  await dashboard.navbar.goToPolicies();

  await policiesList.addPolicy();
  await policyEdit.setSql(sql);
  const policyId = await policyEdit.saveNew(policyName);

  await policyEdit.gotoEdit(policyId, { fleetId: softwareFleet.id });
  await expect(policyEdit.nameInput).toHaveValue(policyName);
  await policyEdit.nameInput.fill(editedName);
  await policyEdit.setSql(editedSql);
  await policyEdit.saveExisting();

  await policyEdit.gotoEdit(policyId, { fleetId: softwareFleet.id });
  await expect(policyEdit.nameInput).toHaveValue(editedName);
  expect(await policyEdit.sqlText()).toContain('osquery_info');

  await policiesList.goto({ fleetId: softwareFleet.id });
  await policiesList.deletePolicy(editedName);

  await expect(policiesList.table.rowOrEmpty()).toBeVisible();
  await expect(policiesList.table.rowWith(editedName)).toHaveCount(0);
});
