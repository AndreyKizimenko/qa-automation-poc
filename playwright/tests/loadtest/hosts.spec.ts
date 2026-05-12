import { test, expect } from '@fixtures';
import { measureNav, measureSearch } from '@helpers/perf';

test.describe('Hosts load times', () => {
  test('Hosts list', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Hosts list', async () => {
      await hostsList.goto({ fleetId: loadtestFleetId });
      await expect(hostsList.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Online status filter', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Online status filter', async () => {
      await hostsList.statusFilter.selectByName('Online');
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Platform filter - macOS', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Platform filter - macOS', async () => {
      await hostsList.labelFilter.selectPlatform('macOS');
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Platform filter - Windows', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Platform filter - Windows', async () => {
      await hostsList.labelFilter.selectPlatform('Windows');
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Platform filter - Linux', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Platform filter - Linux', async () => {
      await hostsList.labelFilter.selectPlatform('Linux');
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Label filter - first available', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });

    await measureNav(page, testInfo, 'Label filter', async () => {
      await hostsList.labelFilter.selectFirstCustomLabel();
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Search host by name', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await hostsList.goto({ fleetId: loadtestFleetId });
    const firstHostName = await hostsList.firstHostName();

    await measureSearch(
      page, testInfo, 'Search host by name',
      hostsList.search, firstHostName,
      async () => { await expect(hostsList.table.rowWith(firstHostName).first()).toBeVisible(); },
    );
  });

  test('Sort by Host name ascending', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort name ascending', async () => {
      await hostsList.goto({ fleetId: loadtestFleetId, sort: { key: 'display_name', direction: 'asc' } });
      await expect(hostsList.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort by Host name descending', { tag: '@loadtest' }, async ({ hostsList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Sort name descending', async () => {
      await hostsList.goto({ fleetId: loadtestFleetId, sort: { key: 'display_name', direction: 'desc' } });
      await expect(hostsList.table.firstRowWithLink).toBeVisible();
    });
  });
});
