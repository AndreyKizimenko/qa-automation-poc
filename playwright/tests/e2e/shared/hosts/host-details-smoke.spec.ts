/**
 * Shared • Hosts • Host details reads against a real device.
 *
 * Three independent concerns on `/hosts/:id/details`:
 *   - Refetch re-collects the host's vitals and the header reports it.
 *   - The "Local user accounts" card filters by username.
 *   - The Agent vitals tooltip reports the host's osquery/Orbit versions.
 *
 * Runs against the real macOS VM (`liveMacosHost`), not the osquery-perf load
 * fleet: these assert on genuine reported vitals — real local user accounts and
 * real agent versions — which the simulations only approximate. All three behave
 * identically on both tiers, so this runs shared rather than duplicated per tier.
 * C2 #7/#10/#17/#19/#22.
 */
import { test, expect } from '@fixtures';
import { getHostDetailUpdatedAt } from '@helpers/api';

/**
 * A username no other username on the host contains, so filtering by it leaves
 * exactly one row (the card filters by substring).
 */
const unambiguousUsername = (usernames: string[]): string | undefined =>
  usernames.find((name) => !usernames.some((other) => other !== name && other.includes(name)));

test('Host details — refetch re-collects the host vitals', async ({
  hostDetails,
  liveMacosHost,
  request,
}) => {
  const before = await getHostDetailUpdatedAt(request, liveMacosHost.id);

  await hostDetails.goto(liveMacosHost.id);
  await hostDetails.refetch();

  // The round trip waits on the host's distributed interval, so allow well over
  // one poll cycle for the header to catch up.
  await expect(hostDetails.lastFetched).toContainText('Last fetched less than a minute ago', {
    timeout: 60_000,
  });

  // Fleet stored a newer set of vitals — proves the refresh came from the
  // refetch and not from a background detail cycle that was already recent.
  await expect
    .poll(() => getHostDetailUpdatedAt(request, liveMacosHost.id), { timeout: 30_000 })
    .not.toBe(before);
});

test('Host details — local user accounts card filters by username', async ({
  hostDetails,
  liveMacosHost,
}) => {
  const username = unambiguousUsername(liveMacosHost.usernames);
  expect(
    username,
    `no distinctly-named local user among ${liveMacosHost.usernames.join(', ') || '(none)'}`,
  ).toBeDefined();

  await hostDetails.goto(liveMacosHost.id);
  await expect(hostDetails.usersHeading).toBeVisible();
  await expect(hostDetails.usersRows.first()).toBeVisible();

  await hostDetails.searchUsers(username!);

  await expect(hostDetails.usersRows).toHaveCount(1);
  await expect(hostDetails.userRow(username!)).toBeVisible();
});

test('Host details — Agent tooltip reports osquery and Orbit versions', async ({
  hostDetails,
  liveMacosHost,
  page,
}) => {
  await hostDetails.goto(liveMacosHost.id);

  // The visible Agent value is the fleetd (Orbit) version; osquery's is in the tooltip.
  await expect(hostDetails.vitals.value('Agent')).toContainText(liveMacosHost.orbitVersion!);

  await hostDetails.hoverAgentVersion();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText(`osquery: ${liveMacosHost.osqueryVersion}`);
  await expect(tooltip).toContainText(`Orbit: ${liveMacosHost.orbitVersion}`);
});
