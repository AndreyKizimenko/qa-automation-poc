import { test, expect } from '@fixtures';
import { measureNav, measureSearch } from '@helpers/perf';

test.describe('Vulnerabilities load times', () => {
  test('Vulnerabilities page', async ({ vulnerabilitiesList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Vulnerabilities page', async () => {
      await vulnerabilitiesList.goto({ fleetId: loadtestFleetId });
      await expect(vulnerabilitiesList.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Filters ─────────────────────────────────────────────────────────────────
  test('Exploited vulnerabilities filter', async ({ vulnerabilitiesList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Exploited filter', async () => {
      await vulnerabilitiesList.goto({ fleetId: loadtestFleetId, exploit: true });
      await expect(vulnerabilitiesList.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────
  test('Sort severity ascending', async ({ vulnerabilitiesList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Severity ascending', async () => {
      await vulnerabilitiesList.goto({ fleetId: loadtestFleetId, sort: { key: 'cvss_score', direction: 'asc' } });
      await expect(vulnerabilitiesList.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Sort severity descending', async ({ vulnerabilitiesList, loadtestFleetId, page }, testInfo) => {
    await measureNav(page, testInfo, 'Severity descending', async () => {
      await vulnerabilitiesList.goto({ fleetId: loadtestFleetId, sort: { key: 'cvss_score', direction: 'desc' } });
      await expect(vulnerabilitiesList.table.firstRowWithLink).toBeVisible();
    });
  });

  // ── Search ───────────────────────────────────────────────────────────────────
  test('Search CVE', async ({ vulnerabilitiesList, loadtestFleetId, page }, testInfo) => {
    await vulnerabilitiesList.goto({ fleetId: loadtestFleetId });
    const cveName = await vulnerabilitiesList.firstCveName();

    await measureSearch(
      page, testInfo, 'Search CVE',
      vulnerabilitiesList.search, cveName,
      async () => { await expect(vulnerabilitiesList.table.rowWith(cveName).first()).toBeVisible(); },
    );
  });
});
