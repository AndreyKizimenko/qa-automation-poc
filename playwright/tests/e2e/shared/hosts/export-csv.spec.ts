/**
 * Shared • Hosts • Export to CSV.
 *
 * The hosts list "Export hosts" action downloads a CSV of the current view.
 * Verifies the CSV includes the first listed host. Host-independent — offline
 * hosts keep last-checkin records and still appear in the list/export.
 * Tier-agnostic (identical on free and premium), so it runs under both projects;
 * teamDropdown.select is a no-op on free.
 */
import * as fs from 'fs';
import { test, expect } from '@fixtures';

test('Hosts — Export hosts downloads a CSV that includes the listed hosts', async ({ hostsList }) => {
  await hostsList.goto();
  await hostsList.teamDropdown.select('Unassigned');

  const hostName = await hostsList.firstHostName();
  expect(hostName.length).toBeGreaterThan(0);

  const download = await hostsList.exportHosts();
  const csv = fs.readFileSync(await download.path(), 'utf-8');
  expect(csv).toContain(hostName);
});
