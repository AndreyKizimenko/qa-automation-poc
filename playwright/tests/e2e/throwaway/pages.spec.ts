/**
 * Throwaway • Pages • every main page of the free UI opens on the throwaway instance.
 *
 * The release checklist's Update flow ends with "navigate through the dashboard, hosts, controls,
 * reports, policies and settings pages and confirm they work". Each row opens one page through its
 * page object's `goto()`, which waits for an element only the loaded page shows, and the automatic
 * `pageHealth` monitor fails the test on any uncaught page error, console error or 5xx the page
 * caused. On the Update flow's run the pages open over data made on the release before the upgrade.
 *
 * The other throwaway specs assert what the pages show; these assert only that they open cleanly, so a
 * page none of them reads (Software, Controls, Users) still gets a look. Read-only.
 */
import { test } from '@fixtures';

test.describe('Throwaway • Pages', () => {
  test('Dashboard', async ({ dashboard }) => {
    await dashboard.goto();
  });

  test('Hosts', async ({ hostsList }) => {
    await hostsList.goto();
  });

  test('Controls › Scripts', async ({ scriptsLibrary }) => {
    await scriptsLibrary.goto();
  });

  test('Software', async ({ softwareTitles }) => {
    await softwareTitles.goto();
  });

  test('Reports', async ({ reportsList }) => {
    await reportsList.goto();
  });

  test('Policies', async ({ policiesList }) => {
    await policiesList.goto();
  });

  test('Labels', async ({ labelsPage }) => {
    await labelsPage.goto();
  });

  test('Settings › Organization info', async ({ organizationInfo }) => {
    await organizationInfo.goto();
  });

  test('Settings › Users', async ({ usersPage }) => {
    await usersPage.goto();
  });
});
