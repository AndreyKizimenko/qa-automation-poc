/**
 * Premium • Command palette • role access.
 *
 * The host picker is deliberately unscoped on the client: it calls the hosts
 * endpoint with no fleet id, because host details resolves a host's fleet from
 * the host record rather than from the URL. That makes the server the only
 * thing standing between a fleet-restricted user and every host in the
 * install, so this spec drives the picker as a fleet-scoped role and checks
 * the boundary from both sides.
 *
 * `team-admin` administers Workstations and VMs. The real macOS VM lives in
 * VMs, so it is in scope; the simulated load fleet sits in Unassigned, which
 * that role holds no role in. Both halves matter: without the in-scope half a
 * picker that returned nothing at all would look like working authorization,
 * and without the admin control an out-of-scope miss could just mean the host
 * was unsearchable.
 *
 * The global maintainer case is the premium half of the role gate on the
 * Controls group and the script commands: free offers them on every page,
 * premium only inside a specific fleet, so the maintainer is checked on both
 * sides of that line — absent at All fleets, present on Workstations. The groups
 * both tiers share for each global role are in the shared role-access spec.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@fixtures';
import { apiUrl, authHeaders } from '@helpers/api';
import { withStaticUser } from '@helpers/auth';
import { CommandPalette, DashboardPage, ReportsListPage } from '@pages';

/** An online host in the Unassigned fleet, which no fleet-scoped role can see. */
async function findUnassignedHost(
  request: APIRequestContext,
): Promise<{ id: number; displayName: string }> {
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: {
      team_id: '0',
      status: 'online',
      per_page: '1',
      order_key: 'display_name',
      order_direction: 'asc',
    },
  });
  await expect(res, 'failed to list Unassigned hosts').toBeOK();
  const { hosts } = await res.json();
  expect(hosts?.length, 'expected an online host in Unassigned').toBeGreaterThan(0);
  return { id: hosts[0].id, displayName: hosts[0].display_name };
}

test.describe('Premium • Command palette • role access', () => {
  test('the host picker finds a host in a fleet the role administers', async ({
    browser,
    liveMacosHost,
  }) => {
    await withStaticUser(browser, 'team-admin', async (page) => {
      const palette = new CommandPalette(page);
      await new DashboardPage(page).goto();

      await palette.open();
      await palette.selectItem('View host');
      await palette.search(liveMacosHost.displayName);

      await expect(palette.row(liveMacosHost.displayName)).toBeVisible();
    });
  });

  test('the host picker hides hosts outside the role\'s fleets', async ({
    browser,
    page,
    palette,
    dashboard,
    request,
  }) => {
    const unassigned = await findUnassignedHost(request);

    // Control: the signed-in admin is global, so the same search must find the
    // host. Without this the assertion below could pass on an unsearchable name.
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('View host');
    await palette.search(unassigned.displayName);
    await expect(palette.row(unassigned.displayName)).toBeVisible();
    await page.keyboard.press('Escape');

    await withStaticUser(browser, 'team-admin', async (scopedPage) => {
      const scopedPalette = new CommandPalette(scopedPage);
      await new DashboardPage(scopedPage).goto();

      await scopedPalette.open();
      await scopedPalette.selectItem('View host');
      await scopedPalette.search(unassigned.displayName);

      await expect(
        scopedPalette.list.getByText(`No hosts match "${unassigned.displayName}".`),
      ).toBeVisible();
      await expect(scopedPalette.row(unassigned.displayName)).toHaveCount(0);
    });
  });

  test('a global maintainer gets the Controls group and Add script only inside a fleet', async ({
    browser,
    workstationsFleetId,
  }) => {
    await withStaticUser(browser, 'global-maintainer', async (page) => {
      const palette = new CommandPalette(page);

      await new DashboardPage(page).goto();
      await palette.open();
      await expect(palette.item('Hosts')).toBeVisible();
      expect(await palette.groupNames(), 'All fleets has no Controls group').not.toContain('Controls');
      await expect(palette.item('Add script')).toHaveCount(0);
      await palette.toggleClosed();

      const reportsList = new ReportsListPage(page);
      await reportsList.goto({ fleetId: workstationsFleetId });
      await reportsList.teamDropdown.select('Workstations');
      await palette.open();

      const controls = palette.group('Controls');
      for (const parent of ['OS updates', 'OS settings', 'Setup experience', 'Scripts', 'Variables']) {
        await expect(
          controls.getByRole('option', { name: parent, exact: true }),
          `${parent} should be in the Controls group on Workstations`,
        ).toBeVisible();
      }
      for (const label of ['Add script', 'Add custom variable']) {
        await expect(palette.item(label), `${label} should be offered on Workstations`).toBeVisible();
      }
    });
  });
});
