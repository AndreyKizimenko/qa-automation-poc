/**
 * Premium • Software • "no teams" views. Under the Unassigned scope, the
 * Software area's Inventory / OS / Vulnerabilities tabs all render data and the
 * scope sticks as you move between them; drilling into a title lands on its
 * detail page, which offers no "Add software" action. Read-only (offline hosts
 * keep their last-checkin software/OS/vuln records).
 */
import { test, expect } from '@fixtures';

test.describe('Premium • Software • no-teams views (Unassigned)', () => {
  test('Unassigned scope persists across Inventory, OS, and Vulnerabilities', async ({ softwareTitles }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();

    await softwareTitles.gotoOsTab();
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();

    await softwareTitles.gotoVulnerabilitiesTab();
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();
  });

  test('drilling into a title shows its detail page with no "Add software" action', async ({
    softwareTitles,
    page,
  }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');

    await softwareTitles.clickFirstSoftwareTitle();
    await expect(page).toHaveURL(/\/software\/titles\/\d+/);
    // "Add software" is a list-page action; the title detail must not offer it.
    await expect(page.getByRole('button', { name: 'Add software' })).toHaveCount(0);
  });
});
