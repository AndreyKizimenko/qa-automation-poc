import { test, expect } from '@fixtures';
import { measureNav, measureSearch } from '@helpers/perf';

test.describe('Software load times', () => {
  test('Software page', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Software page', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────
  test('Sort by name ascending', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort name ascending', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId, sort: { key: 'name', direction: 'asc' } });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort by name descending', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort name descending', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId, sort: { key: 'name', direction: 'desc' } });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort by host count ascending', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort hosts ascending', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'asc' } });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort by host count descending', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort hosts descending', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'desc' } });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Filters ─────────────────────────────────────────────────────────────────
  test('Vulnerable filter', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Vulnerable filter', async () => {
      await softwareTitles.goto({ fleetId: loadtestFleetId, vulnerable: true });
      await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────────
  test('Search software', async ({ softwareTitles, loadtestFleetId, page }, testInfo) => {
    await softwareTitles.goto({ fleetId: loadtestFleetId });

    // Capture the first software's name to search for
    const itemName = (await softwareTitles.table.firstRowPrimaryLink.innerText()).trim();

    await measureSearch(
      page, testInfo, 'Search software',
      softwareTitles.search, itemName,
      async () => { await expect(softwareTitles.table.rowWith(itemName).first()).toBeVisible(); },
    );
  });

  // ── Show versions ON ────────────────────────────────────────────────────────
  test('Show versions - page load', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - page load', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - sort name ascending', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - sort name asc', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId, sort: { key: 'name', direction: 'asc' } });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - sort name descending', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - sort name desc', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId, sort: { key: 'name', direction: 'desc' } });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - sort hosts ascending', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - sort hosts asc', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'asc' } });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - sort hosts descending', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - sort hosts desc', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId, sort: { key: 'hosts_count', direction: 'desc' } });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - vulnerable filter', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Versions - vulnerable', async () => {
      await softwareVersions.goto({ fleetId: loadtestFleetId, vulnerable: true });
      await expect(softwareVersions.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Versions - search', async ({ softwareVersions, loadtestFleetId, page }, testInfo) => {
    await softwareVersions.goto({ fleetId: loadtestFleetId });
    const itemName = (await softwareVersions.table.firstRowPrimaryLink.innerText()).trim();

    await measureSearch(
      page, testInfo, 'Versions - search',
      softwareVersions.search, itemName,
      async () => { await expect(softwareVersions.table.rowWith(itemName).first()).toBeVisible(); },
    );
  });
});
