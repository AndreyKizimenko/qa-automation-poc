/**
 * Premium • Software • "no teams" views. Under the Unassigned scope, the
 * Software area's Inventory / OS / Vulnerabilities tabs all render data and the
 * scope sticks as you move between them; drilling into a title lands on its
 * detail page, which offers no "Add software" action. Read-only (offline hosts
 * keep their last-checkin software/OS/vuln records).
 *
 * The second describe covers the other end of the same behaviour — the "All
 * fleets" aggregate surviving a walk across the whole navbar, and the one page
 * that cannot honour it.
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

/**
 * "All fleets" is the aggregate every scope-aware page opens on, and it has to
 * survive a walk across the navbar. Controls is the exception, and deliberately
 * so: it configures one fleet at a time, so it has no aggregate entry and falls
 * back to a real fleet rather than rendering an empty scope.
 */
test.describe('Premium • Software • All fleets scope across the navbar', () => {
  test('All fleets sticks from Hosts to Policies, and Controls falls back to a fleet', async ({
    dashboard,
    hostsList,
    softwareTitles,
    reportsList,
    policiesList,
    controls,
  }) => {
    await dashboard.goto();
    await dashboard.teamDropdown.select('All fleets');

    const carriesScope = [
      { label: 'Hosts', go: () => dashboard.navbar.goToHosts(), page: hostsList },
      { label: 'Software', go: () => hostsList.navbar.goToSoftware(), page: softwareTitles },
      { label: 'Reports', go: () => softwareTitles.navbar.goToReports(), page: reportsList },
      { label: 'Policies', go: () => reportsList.navbar.goToPolicies(), page: policiesList },
    ];

    for (const { label, go, page } of carriesScope) {
      await go();
      await expect(page.teamDropdown.currentValue, `${label} kept the scope`).toHaveText(
        'All fleets',
      );
    }

    await policiesList.navbar.goToControls();
    // Controls is per-fleet: it drops the aggregate from the picker entirely
    // and lands on a concrete fleet, with fleet_id in the URL to match.
    await expect(controls.page).toHaveURL(/fleet_id=\d+/);
    await expect(controls.teamDropdown.currentValue).not.toHaveText('All fleets');
    await controls.teamDropdown.trigger.click();
    expect(await controls.teamDropdown.options.allInnerTexts()).not.toContain('All fleets');
  });
});
