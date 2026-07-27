/**
 * Shared • Hosts • Host details reads that need an online host.
 *
 * Three independent concerns on `/hosts/:id/details`:
 *   - Refetch re-collects the host's vitals and the header reports it.
 *   - The "Local user accounts" card filters by username.
 *   - The Agent vitals tooltip reports the host's osquery/Orbit versions.
 *
 * All three behave identically on both tiers, so this runs shared rather than
 * duplicated per tier. Each test resolves its own host by API: the QA instances
 * are stocked by an osquery-perf load fleet whose hosts report different vitals
 * from one another, so a spec must ask for a host that reports what it asserts
 * on instead of trusting an arbitrary pick.
 */
import { test, expect } from '@fixtures';
import { findOnlineHost, getHostDetailUpdatedAt } from '@helpers/api';

/**
 * A username no other username on the host contains, so filtering by it leaves
 * exactly one row (the card filters by substring).
 */
const unambiguousUsername = (usernames: string[]): string | undefined =>
  usernames.find((name) => !usernames.some((other) => other !== name && other.includes(name)));

test('Host details — refetch re-collects the host vitals', async ({ hostDetails, request }) => {
  const host = await findOnlineHost(request, 'darwin');
  expect(host, 'expected an online macOS host').not.toBeNull();

  const before = await getHostDetailUpdatedAt(request, host!.id);

  await hostDetails.goto(host!.id);
  await hostDetails.refetch();

  // The round trip waits on the host's distributed interval, so allow well over
  // one poll cycle for the header to catch up.
  await expect(hostDetails.lastFetched).toContainText('Last fetched less than a minute ago', {
    timeout: 60_000,
  });

  // Fleet stored a newer set of vitals — proves the refresh came from the
  // refetch and not from a background detail cycle that was already recent.
  await expect
    .poll(() => getHostDetailUpdatedAt(request, host!.id), { timeout: 15_000 })
    .not.toBe(before);
});

test('Host details — local user accounts card filters by username', async ({
  hostDetails,
  request,
}) => {
  const host = await findOnlineHost(request, 'darwin', { withUsers: true });
  expect(host, 'expected an online macOS host reporting local user accounts').not.toBeNull();

  const username = unambiguousUsername(host!.usernames);
  expect(username, `no distinctly-named user among ${host!.usernames.join(', ')}`).toBeDefined();

  await hostDetails.goto(host!.id);
  await expect(hostDetails.usersHeading).toBeVisible();
  await expect(hostDetails.usersRows.first()).toBeVisible();

  await hostDetails.searchUsers(username!);

  await expect(hostDetails.usersRows).toHaveCount(1);
  await expect(hostDetails.userRow(username!)).toBeVisible();
});

test('Host details — Agent tooltip reports osquery and Orbit versions', async ({
  hostDetails,
  page,
  request,
}) => {
  // Only fleetd hosts render the tooltip; a vanilla-osquery host shows a bare
  // osquery version with nothing to hover.
  const host = await findOnlineHost(request, 'darwin', { withOrbit: true });
  expect(host, 'expected an online macOS host reporting an Orbit version').not.toBeNull();

  await hostDetails.goto(host!.id);

  // The visible Agent value is the fleetd (Orbit) version; osquery's is in the tooltip.
  await expect(hostDetails.vitals.value('Agent')).toContainText(host!.orbitVersion!);

  await hostDetails.hoverAgentVersion();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText(`osquery: ${host!.osqueryVersion}`);
  await expect(tooltip).toContainText(`Orbit: ${host!.orbitVersion}`);
});
