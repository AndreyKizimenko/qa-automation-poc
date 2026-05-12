import { test, expect } from '@fixtures';
import { measureNav } from '@helpers/perf';

test.describe('Host Details load times', () => {
  // ── Details page full load ──────────────────────────────────────────────────
  test('Host details page', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await measureNav(page, testInfo, 'Host details page', async () => {
      await hostDetails.goto(firstHostId);
      await expect(hostDetails.vitalsDiskSpace).toBeVisible();
      await expect(hostDetails.vitalsOperatingSystem).toBeVisible();
      // Wait for the Activity card to finish loading — either a real entry
      // or the "No activity" empty state means the async fetch resolved.
      await expect(hostDetails.firstActivityTimestamp.or(hostDetails.activityEmptyState)).toBeVisible();
    });
  });

  // ── Software tab ────────────────────────────────────────────────────────────
  test('Software inventory', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await hostDetails.goto(firstHostId);

    await measureNav(page, testInfo, 'Software inventory', async () => {
      await hostDetails.openSoftwareTab();
      await expect(hostDetails.table.firstRowWithLink).toBeVisible();
    });
  });

  test('Software - Vulnerable filter', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await hostDetails.goto(firstHostId);
    await hostDetails.openSoftwareTab();

    await measureNav(page, testInfo, 'Vulnerable filter', async () => {
      await hostDetails.applyVulnerableFilter();
      await expect(hostDetails.table.rowOrEmpty()).toBeVisible();
    });
  });

  test('Software - Library view', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await hostDetails.goto(firstHostId);
    await hostDetails.openSoftwareTab();

    await measureNav(page, testInfo, 'Library view', async () => {
      await hostDetails.libraryTab.click();
      await expect(hostDetails.table.rowOrEmpty()).toBeVisible();
    });
  });

  // ── Reports tab ─────────────────────────────────────────────────────────────
  test('Reports tab', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await hostDetails.goto(firstHostId);

    await measureNav(page, testInfo, 'Reports tab', async () => {
      await hostDetails.reportsTab.click();
      // Reports tab shows "N reports" count once data loads
      await expect(page.getByText(/\d+ reports?/)).toBeVisible();
    });
  });

  // ── Policies tab ────────────────────────────────────────────────────────────
  test('Policies tab', { tag: '@loadtest' }, async ({ firstHostId, hostDetails, page }, testInfo) => {
    await hostDetails.goto(firstHostId);

    await measureNav(page, testInfo, 'Policies tab', async () => {
      await hostDetails.policiesTab.click();
      await expect(hostDetails.table.rowOrEmpty()).toBeVisible();
    });
  });
});
