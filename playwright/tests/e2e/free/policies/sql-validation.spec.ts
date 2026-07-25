/**
 * Free • Policies • SQL validation. Read-only interactions with the
 * /policies/new form — no policy is created. The platform-compatibility badge,
 * syntax-error surfacing, and no-platform save gating are all tier-agnostic
 * (same PolicyForm component); this covers the free-listed subset.
 *
 * Grounded in frontend/components/PlatformCompatibility, PolicyForm
 * (disableSaveFormErrors), and SaveNewPolicyModal (disableSave).
 */
import { test, expect } from '@fixtures';

test.describe('Free • Policies • platform compatibility', () => {
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
});

test.describe('Free • Policies • SQL validation', () => {
  test('a syntax error is surfaced but Save stays enabled', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELEC 1 FRO osquery_info WHER start_time > 1;');
    await expect(policyEdit.sqlSyntaxError).toBeVisible();
    await expect(policyEdit.saveButton).toBeEnabled();
  });
});

test.describe('Free • Policies • save gating', () => {
  test('the Save policy modal disables Save until a platform is selected', async ({ policyEdit }) => {
    await policyEdit.gotoNew();
    await policyEdit.setSql('SELECT 1 FROM osquery_info;');
    await policyEdit.saveButton.click();
    await expect(policyEdit.saveNewModal).toBeVisible();
    await policyEdit.clearNewPolicyPlatforms();
    await expect(policyEdit.saveNewSubmitButton).toBeDisabled();
  });
});
