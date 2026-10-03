/**
 * Premium • Software • "no teams" views. Under the Unassigned scope, the
 * Software area's Inventory / OS / Vulnerabilities tabs all render data and the
 * scope sticks as you move between them; drilling into a title lands on its
 * detail page, which offers no "Add software" action, and a package added to
 * Unassigned is offered in the Library of a host there. Read-only otherwise
 * (offline hosts keep their last-checkin software/OS/vuln records).
 *
 * The second describe covers the same behaviour across the navbar: the "All
 * fleets" aggregate and the Unassigned scope each surviving a walk between the
 * pages that offer them, and the pages that cannot honour them.
 */
import { test, expect } from '@fixtures';
import { deleteSoftwareTitle, findSimulations, hostsOfferedTitle, uploadSoftwarePackageBuffer } from '@helpers/api';
import { inertDeb } from '@helpers/deb';
import { runNonce } from '@helpers/profiles';

test.describe('Premium • Software • no-teams views (Unassigned)', () => {
  test('Unassigned scope persists across Inventory, OS, and Vulnerabilities', async ({ softwareTitles }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();

    await softwareTitles.gotoOsTab();
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();

    await softwareTitles.gotoVulnerabilitiesTab();
    await expect(softwareTitles.teamDropdown.currentValue).toHaveText('Unassigned');
    await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();
  });

  test('drilling into a title shows its detail page with no "Add software" action', async ({
    softwareTitles,
    page,
  }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('Unassigned');

    await softwareTitles.clickFirstSoftwareTitle();
    await expect(page).toHaveURL(/\/software\/titles\/\d+/);
    // "Add software" is a list-page action; the title detail must not offer it.
    await expect(page.getByRole('button', { name: 'Add software' })).toHaveCount(0);
  });

  /**
   * A package added to Unassigned is offered in the Library of a host there:
   * "no fleet" is its own branch of Fleet's offer query (`team_id IS NULL`),
   * beside every fleet's, and `software-label-targets` covers only a fleet's.
   * Premium's Unassigned holds no real VM, so the host is a Linux simulation
   * (`findSimulations` linux 5), only read. The package is a per-run inert
   * `fleet-pw-*` `.deb`, never installed, deleted in the `finally`; cleanup
   * wipes Unassigned's software too. Round 1 C6 #27.
   */
  test("a package added to Unassigned is offered in an Unassigned host's Library", async ({
    hostDetails,
    request,
  }) => {
    const [hostId] = await findSimulations(request, 'linux', 1, 5);
    expect(hostId, 'an online Linux simulation on Unassigned').toBeDefined();

    const name = `fleet-pw-unassigned-${runNonce()}`;
    const { titleId } = await uploadSoftwarePackageBuffer(request, 0, `${name}_1.0.0_all.deb`, inertDeb(name, '1.0.0'));
    try {
      expect(await hostsOfferedTitle(request, [hostId], titleId), 'offered to the host').toEqual([hostId]);

      await hostDetails.goto(hostId);
      await hostDetails.openLibrary(name);
    } finally {
      await deleteSoftwareTitle(request, 0, titleId);
    }
  });
});

/**
 * "All fleets" is the aggregate every scope-aware page opens on, and it has to
 * survive a walk across the navbar. Controls is the exception, and deliberately
 * so: it configures one fleet at a time, so it has no aggregate entry and falls
 * back to a real fleet rather than rendering an empty scope.
 */
test.describe('Premium • Software • All fleets scope across the navbar', () => {
  test('All fleets sticks from Hosts to Policies, and Controls falls back to a fleet', async ({
    dashboard,
    hostsList,
    softwareTitles,
    reportsList,
    policiesList,
    controls,
  }) => {
    await dashboard.goto();
    await dashboard.teamDropdown.select('All fleets');

    const carriesScope = [
      { label: 'Hosts', go: () => dashboard.navbar.goToHosts(), page: hostsList },
      { label: 'Software', go: () => hostsList.navbar.goToSoftware(), page: softwareTitles },
      { label: 'Reports', go: () => softwareTitles.navbar.goToReports(), page: reportsList },
      { label: 'Policies', go: () => reportsList.navbar.goToPolicies(), page: policiesList },
    ];

    for (const { label, go, page } of carriesScope) {
      await go();
      await expect(page.teamDropdown.currentValue, `${label} kept the scope`).toHaveText(
        'All fleets',
      );
    }

    await policiesList.navbar.goToControls();
    // Controls is per-fleet: it drops the aggregate from the picker entirely
    // and lands on a concrete fleet, with fleet_id in the URL to match.
    await expect(controls.page).toHaveURL(/fleet_id=\d+/);
    await expect(controls.teamDropdown.currentValue).not.toHaveText('All fleets');
    await controls.teamDropdown.trigger.click();
    // The open menu must list a real fleet before its missing aggregate means anything.
    await expect(controls.teamDropdown.options.filter({ hasText: /^Workstations$/ })).toBeVisible();
    await expect(controls.teamDropdown.options.filter({ hasText: /^All fleets$/ })).toHaveCount(0);
  });
});

/**
 * Unassigned is offered on Hosts, Controls, Software and Policies, and not on
 * Reports (`ManageQueriesPage` sets `includeNoTeam: false`), so Reports is
 * where the walk ends: it falls back to the aggregate.
 */
test.describe('Premium • Software • Unassigned scope across the navbar', () => {
  test('Unassigned sticks across Hosts, Controls, Software and Policies, and Reports falls back to All fleets', async ({
    dashboard,
    hostsList,
    controls,
    softwareTitles,
    policiesList,
    reportsList,
  }) => {
    await dashboard.goto();
    await dashboard.navbar.goToHosts();
    await hostsList.teamDropdown.select('Unassigned');

    const carriesScope = [
      { label: 'Controls', go: () => hostsList.navbar.goToControls(), page: controls },
      { label: 'Software', go: () => controls.navbar.goToSoftware(), page: softwareTitles },
      { label: 'Policies', go: () => softwareTitles.navbar.goToPolicies(), page: policiesList },
      { label: 'Hosts', go: () => policiesList.navbar.goToHosts(), page: hostsList },
    ];

    for (const { label, go, page } of carriesScope) {
      await go();
      await expect(page.teamDropdown.currentValue, `${label} kept the scope`).toHaveText('Unassigned');
    }

    await hostsList.navbar.goToReports();
    await expect(reportsList.teamDropdown.currentValue).toHaveText('All fleets');
    await reportsList.teamDropdown.trigger.click();
    await expect(reportsList.teamDropdown.options.filter({ hasText: /^Workstations$/ })).toBeVisible();
    await expect(reportsList.teamDropdown.options.filter({ hasText: /^Unassigned$/ })).toHaveCount(0);
  });
});
