/**
 * Shared • Hosts • Edit columns.
 *
 * The "Edit columns" modal toggles which columns the hosts table shows.
 * Verifies hiding then showing the "User email" column removes and restores its
 * header. Host-independent and tier-agnostic — the choice is a per-context
 * localStorage preference — so it runs under both projects (teamDropdown.select
 * is a no-op on free).
 */
import { test, expect } from '@fixtures';

test('Hosts — Edit columns shows and hides the User email column', async ({ hostsList }) => {
  await hostsList.goto();
  await hostsList.teamDropdown.select('Unassigned');

  // "User email" (device_mapping) is hidden in Fleet's default column set.
  const header = hostsList.columnHeader('User email');
  await expect(header).toBeHidden();

  await hostsList.toggleColumn('User email');
  await expect(header).toBeVisible();

  await hostsList.toggleColumn('User email');
  await expect(header).toBeHidden();
});
