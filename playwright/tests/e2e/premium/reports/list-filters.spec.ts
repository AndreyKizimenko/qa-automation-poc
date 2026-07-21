/**
 * Premium • Reports • list filters. Read-only checks on the /reports/manage
 * list: name search narrows the rows, the platform-filter dropdown hides
 * reports that don't target the chosen platform, and a global report surfaces
 * in a team's list marked "Inherited".
 *
 * Each test seeds its own uniquely-named reports via the API and cleans them
 * up, so it is isolated from siblings running in parallel. Grounded in
 * frontend/.../ManageQueriesPage/components/QueriesTable.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching } from '@helpers/api';

const rand = () => Math.random().toString(36).slice(2, 8);

test.describe('Premium • Reports • list filters', () => {
  test('search by name narrows the list', async ({ reportsList, request }) => {
    const marker = `pw-rlist-search-${Date.now()}-${rand()}`;
    await createReport(request, { name: `${marker}-alpha` });
    await createReport(request, { name: `${marker}-beta` });
    try {
      await reportsList.goto();
      await reportsList.teamDropdown.select('All fleets');

      await reportsList.searchByName(`${marker}-alpha`);
      await expect(reportsList.table.rowWith(`${marker}-alpha`)).toBeVisible();
      await expect(reportsList.table.rowWith(`${marker}-beta`)).toHaveCount(0);
    } finally {
      await deleteReportsMatching(request, marker);
    }
  });

  test('platform filter hides reports that do not target the platform', async ({
    reportsList,
    request,
    page,
  }) => {
    const marker = `pw-rlist-plat-${Date.now()}-${rand()}`;
    const macName = `${marker}-mac`;
    const winName = `${marker}-win`;
    await createReport(request, { name: macName, platform: 'darwin' });
    await createReport(request, { name: winName, platform: 'windows' });
    try {
      await reportsList.goto();
      await reportsList.teamDropdown.select('All fleets');
      await reportsList.searchByName(marker);
      await expect(reportsList.table.rowWith(macName)).toBeVisible();
      await expect(reportsList.table.rowWith(winName)).toBeVisible();

      await reportsList.selectPlatform('macOS');
      await expect(page).toHaveURL(/platform=darwin/);
      // macOS report survives the darwin filter; the Windows-only one is gone.
      await expect(reportsList.table.rowWith(macName)).toBeVisible();
      await expect(reportsList.table.rowWith(winName)).toHaveCount(0);
    } finally {
      await deleteReportsMatching(request, marker);
    }
  });

  test('a global report shows as "Inherited" in a team list', async ({
    reportsList,
    request,
    workstationsFleetId,
  }) => {
    const marker = `pw-rlist-inherit-${Date.now()}-${rand()}`;
    await createReport(request, { name: marker });
    try {
      await reportsList.goto({ fleetId: workstationsFleetId });
      await reportsList.teamDropdown.select('Workstations');

      await reportsList.searchByName(marker);
      const row = reportsList.table.rowWith(marker);
      await expect(row).toBeVisible();
      await expect(row.getByText('Inherited')).toBeVisible();
    } finally {
      await deleteReportsMatching(request, marker);
    }
  });
});
