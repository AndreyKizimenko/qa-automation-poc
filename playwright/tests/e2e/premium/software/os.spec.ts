/**
 * Premium • Software • OS tab. Scope: Unassigned (all hosts on this instance
 * are unassigned; offline hosts keep their last-checkin OS records).
 *
 * Covers the OS-tab platform filter (narrows the list to a single platform)
 * and the per-row "View all hosts" hand-off (lands on the Hosts list filtered
 * by that OS). Both are host-data reads — no online host required.
 */
import { test, expect } from '@fixtures';

// macOS/Windows OS names embed the platform word, so a row-content check is
// deterministic. Linux is omitted here — its rows are distro-named (Ubuntu,
// Fedora, …), not "Linux".
const PLATFORMS = [
  { label: 'macOS', value: 'darwin', token: 'macOS' },
  { label: 'Windows', value: 'windows', token: 'Windows' },
] as const;

for (const { label, value, token } of PLATFORMS) {
  test(`OS tab — platform filter narrows the list to ${label}`, async ({
    softwareTitles,
    softwareOs,
    page,
  }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
    await softwareTitles.gotoOsTab();

    await softwareOs.selectPlatform(label);
    await expect(page).toHaveURL(new RegExp(`platform=${value}`));

    // The OS list keeps the previous rows while the filtered fetch is in
    // flight (react-query keepPreviousData), so assert on a retrying locator:
    // once settled, no row's Name lacks the platform word.
    const rows = softwareOs.table.table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasNotText: token })).toHaveCount(0);
  });
}

test('OS tab — "View all hosts" lands on the Hosts list filtered by that OS', async ({
  softwareTitles,
  softwareOs,
  hostsList,
}) => {
  await softwareTitles.goto();
  await softwareTitles.teamDropdown.select('Unassigned');
  await softwareTitles.gotoOsTab();

  // The OS row labels Windows as "Microsoft Windows …"; the Hosts filter pill
  // drops the "Microsoft " prefix (and appends a build number), so normalize
  // to the shared substring.
  const osName = (await softwareOs.firstOsName()).replace('Microsoft ', '');
  await softwareOs.viewHostsForFirstOs();

  await expect(hostsList.filterPill).toBeVisible();
  await expect(hostsList.filterPill).toContainText(osName);
});
