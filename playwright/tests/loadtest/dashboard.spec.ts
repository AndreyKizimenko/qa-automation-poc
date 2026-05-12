import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Dashboard load times', () => {
  test('Platform cards', { tag: '@loadtest' }, async ({ dashboard, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Platform cards', async () => {
      await dashboard.goto({ fleetId: loadtestFleetId });
      await expect(dashboard.firstCard).toBeVisible();
    });
  });

  test('Software block', { tag: '@loadtest' }, async ({ dashboard, loadtestFleetId, page }, testInfo) => {
    await dashboard.goto({ fleetId: loadtestFleetId });
    await measureNav(page, testInfo, 'Software block', async () => {
      // Wait for the software table to have data, not just the heading
      await expect(dashboard.softwareHeading).toBeVisible();
      await expect(dashboard.firstSoftwareRow).toBeVisible();
      await expect(dashboard.firstSoftwareNameCell).not.toBeEmpty();
    });
  });

  // The Activity card is only rendered on the All-fleets dashboard view, so
  // this test deliberately omits fleetId.
  test('Activity block', { tag: '@loadtest' }, async ({ dashboard, page }, testInfo) => {
    await dashboard.goto();
    await measureNav(page, testInfo, 'Activity block', async () => {
      await expect(dashboard.firstActivityItem).toBeVisible();
    });
  });

  test('Filter by macOS', { tag: '@loadtest' }, async ({ dashboard, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'macOS', async () => {
      await dashboard.goto({ fleetId: loadtestFleetId, platform: 'mac' });
      await expect(dashboard.firstCard).toBeVisible();
    });
  });

  test('Filter by Windows', { tag: '@loadtest' }, async ({ dashboard, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Windows', async () => {
      await dashboard.goto({ fleetId: loadtestFleetId, platform: 'windows' });
      await expect(dashboard.firstCard).toBeVisible();
    });
  });

  test('Filter by Linux', { tag: '@loadtest' }, async ({ dashboard, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Linux', async () => {
      await dashboard.goto({ fleetId: loadtestFleetId, platform: 'linux' });
      await expect(dashboard.firstCard).toBeVisible();
    });
  });
});
