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
  // The round trip against the real VM is bounded by the host's poll cadence and
  // measures 70-120s, on top of waiting out any refetch already in flight.
  test.setTimeout(300_000);

  const before = await getHostDetailUpdatedAt(request, liveMacosHost.id);

  await hostDetails.goto(liveMacosHost.id);
  await hostDetails.refetch();

  // Fleet took the request: the header button reports the collection in flight.
  await expect(hostDetails.refetchingButton).toBeVisible();

  // Fleet stored a newer set of vitals — proves the refresh came from the
  // refetch and not from a background detail cycle that was already recent.
  await expect
    .poll(() => getHostDetailUpdatedAt(request, liveMacosHost.id), { timeout: 180_000 })
    .not.toBe(before);

  // `HostDetailsPage` polls for the result for 60s, then gives up with "You'll
  // see an update when the host responds" and leaves the open page on the old
  // time, so the header is only meaningful on a fresh load. Fleet renders the
  // relative time through date-fns with `addSuffix`, which phrases a timestamp
  // the browser clock hasn't reached yet as "in less than a minute" and one it
  // has as "less than a minute ago" — the vitals are fresh either way.
  await hostDetails.goto(liveMacosHost.id);
  await expect(hostDetails.lastFetched).toContainText(/Last fetched (in )?less than a minute/);
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
