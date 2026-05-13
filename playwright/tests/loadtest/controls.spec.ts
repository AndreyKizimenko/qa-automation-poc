import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Controls load times', () => {
  // ── OS Updates ──────────────────────────────────────────────────────────────
  test('OS Updates', async ({ osUpdates, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'OS Updates', async () => {
      await osUpdates.goto({ fleetId: loadtestFleetId });
    });
  });

  test('OS Updates - View hosts for top OS', async ({ osUpdates, hostsList, loadtestFleetId, page }, testInfo) => {
    await osUpdates.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'OS Updates - top OS hosts', async () => {
      await osUpdates.viewHostsForFirstOs();
      await expect(hostsList.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── OS Settings ─────────────────────────────────────────────────────────────
  test('OS Settings - Top status hosts', async ({ osSettings, hostsList, loadtestFleetId, page }, testInfo) => {
    await osSettings.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'OS Settings - status hosts', async () => {
      await osSettings.clickStatusWithMostHosts();
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Configuration profiles', async ({ configurationProfiles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Configuration profiles', async () => {
      await configurationProfiles.goto({ fleetId: loadtestFleetId });
    });
  });

  test('Certificates', async ({ certificates, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Certificates', async () => {
      await certificates.goto({ fleetId: loadtestFleetId });
    });
  });

  // ── Setup Experience ────────────────────────────────────────────────────────
  test('Install software - macOS', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - macOS', async () => {
      await installSoftware.goto('macos', { fleetId: loadtestFleetId });
    });
  });

  test('Install software - Windows', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - Windows', async () => {
      await installSoftware.goto('windows', { fleetId: loadtestFleetId });
    });
  });

  test('Install software - Linux', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - Linux', async () => {
      await installSoftware.goto('linux', { fleetId: loadtestFleetId });
    });
  });

  test('Install software - iOS', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - iOS', async () => {
      await installSoftware.goto('ios', { fleetId: loadtestFleetId });
    });
  });

  test('Install software - iPadOS', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - iPadOS', async () => {
      await installSoftware.goto('ipados', { fleetId: loadtestFleetId });
    });
  });

  test('Install software - Android', async ({ installSoftware, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Install software - Android', async () => {
      await installSoftware.goto('android', { fleetId: loadtestFleetId });
    });
  });

  // ── Scripts ─────────────────────────────────────────────────────────────────
  test('Scripts - Library', async ({ scriptsLibrary, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Scripts - Library', async () => {
      await scriptsLibrary.goto({ fleetId: loadtestFleetId });
    });
  });

  test('Scripts - Batch progress', async ({ scriptsBatchProgress, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Scripts - Batch progress', async () => {
      await scriptsBatchProgress.goto({ fleetId: loadtestFleetId });
      await scriptsBatchProgress.openFinishedTab();
      await expect(scriptsBatchProgress.list.firstItem.or(scriptsBatchProgress.list.emptyState)).toBeVisible();
    });
  });

  // ── Variables ───────────────────────────────────────────────────────────────
  test('Variables', async ({ variables, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Variables', async () => {
      await variables.goto({ fleetId: loadtestFleetId });
    });
  });
});
