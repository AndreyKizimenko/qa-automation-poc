import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Software OS load times', () => {
  test('OS page', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'OS page', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Platform filters ────────────────────────────────────────────────────────
  test('Platform filter - macOS', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Platform - macOS', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId, platform: 'darwin' });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Platform filter - Windows', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Platform - Windows', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId, platform: 'windows' });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Platform filter - Linux', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Platform - Linux', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId, platform: 'linux' });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────
  test('Sort hosts ascending', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort hosts ascending', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'asc' } });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort hosts descending', async ({ softwareOs, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort hosts descending', async () => {
      await softwareOs.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'desc' } });
      await expect(softwareOs.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── View hosts for top OS ───────────────────────────────────────────────────
  // Clicks the OS row's hover-only "View all hosts" button so the
  // measurement covers the hosts-list load, not the OS detail page (which
  // depends on vulnerability data that the loadtest fleet may lack).
  test('View hosts for top OS', async ({ softwareOs, hostsList, loadtestFleetId, page }, testInfo) => {
    await softwareOs.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'desc' } });

    await measureNav(page, testInfo, 'Top OS hosts page', async () => {
      await softwareOs.viewHostsForFirstOs();
      await expect(hostsList.table.firstRowWithLink).toBeVisible();
    });
  });
});
