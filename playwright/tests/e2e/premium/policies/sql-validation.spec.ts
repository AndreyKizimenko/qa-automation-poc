/**
 * Premium • Policies • SQL validation. The /policies/new form:
 *   - the platform-compatibility badge reacts to the tables in the query
 *     (invalid table -> No platforms; no tables -> all four; single-platform
 *     table -> that platform; CTE names ignored),
 *   - a syntax error is surfaced inline but Save stays enabled (Fleet lets
 *     teams capture false-positives), and the policy saves and reopens with
 *     its SQL and the error — the one test here that creates a policy, deleted
 *     in an afterEach,
 *   - the "Save policy" modal disables Save until a platform is selected.
 *
 * Grounded in frontend/components/PlatformCompatibility, PolicyForm
 * (disableSaveFormErrors), and SaveNewPolicyModal (disableSave).
 */
import { test, expect } from '@fixtures';
import { deletePolicies } from '@helpers/api';
import { runNonce } from '@helpers/profiles';

test.describe('Premium • Policies • platform compatibility', () => {
  test('an invalid table reports no compatible platforms', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELECT 1 FROM foo WHERE start_time > 1;');
    await expect(policyEdit.platformCompatibility).toContainText(
      'No platforms (check your query for invalid tables or tables that are supported on different platforms)',
    );
    await expect(policyEdit.compatiblePlatforms).toHaveCount(0);
  });

  test('a query with no tables is compatible with all four platforms', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELECT * WHERE 1 = 1;');
    await expect(policyEdit.compatiblePlatforms).toHaveCount(4);
  });

  test('a macOS-only table is compatible with macOS only', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELECT 1 FROM gatekeeper WHERE assessments_enabled = 1;');
    await expect(policyEdit.compatiblePlatforms).toHaveCount(1);
    await expect(policyEdit.compatiblePlatform('macOS')).toBeVisible();
  });

  test('a macadmins extension table is treated as macOS-compatible', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql("SELECT 1 FROM mdm WHERE enrolled = 'true';");
    await expect(policyEdit.compatiblePlatforms).toHaveCount(1);
    await expect(policyEdit.compatiblePlatform('macOS')).toBeVisible();
  });

  test('common-table-expression names are not treated as tables', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    // `defined_cte` is a CTE name, not an osquery table. If it were factored
    // into the compatibility check, the badge would report No platforms;
    // instead only the real table (osquery_info) drives the result.
    await policyEdit.setSql(
      'WITH defined_cte AS (SELECT 1 AS n FROM osquery_info) SELECT n FROM defined_cte;',
    );
    await expect(policyEdit.platformCompatibility).not.toContainText('No platforms');
    await expect(policyEdit.compatiblePlatform('macOS')).toBeVisible();
  });
});

test.describe('Premium • Policies • SQL validation', () => {
  let createdId: number | undefined;

  test.afterEach(async ({ request }) => {
    // A saved global policy is scheduled on every host; this one fails to run
    // anywhere, but it still shouldn't outlive the test.
    if (createdId !== undefined) await deletePolicies(request, [createdId]);
    createdId = undefined;
  });

  // Fleet deliberately saves SQL its parser flags, so a query the validator
  // gets wrong can still be used (the server refuses only an empty query).
  test('a policy with a syntax error saves, and reopens with its SQL and the error', async ({ policyEdit }) => {
    const badSql = 'SELEC 1 FRO osquery_info WHER start_time > 1;';
    const name = `pw-policy-bad-sql-${runNonce()}`;

    await policyEdit.gotoNew();
    await policyEdit.setSql(badSql);
    await expect(policyEdit.sqlSyntaxError).toBeVisible();
    await expect(policyEdit.saveButton).toBeEnabled();

    createdId = await policyEdit.saveNew({ name, description: '', resolution: '' });

    await policyEdit.gotoEdit(createdId);
    await expect(policyEdit.nameInput).toHaveValue(name);
    expect(await policyEdit.sqlText()).toBe(badSql);
    await expect(policyEdit.sqlSyntaxError).toBeVisible();
  });
});

test.describe('Premium • Policies • save gating', () => {
  test('the Save policy modal disables Save until a platform is selected', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELECT 1 FROM osquery_info;');
    await policyEdit.saveButton.click();
    await expect(policyEdit.saveNewModal).toBeVisible();
    await policyEdit.clearNewPolicyPlatforms();
    await expect(policyEdit.saveNewSubmitButton).toBeDisabled();
  });
});
