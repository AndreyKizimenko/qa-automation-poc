/**
 * Premium • Dashboard • fleet-scoped chart card. The historical chart next to
 * "Hosts enrolled" is the premium-only half of the dashboard: free offers a
 * single dataset and renders a plain "Hosts online" heading, while premium
 * renders a dataset dropdown that also carries "Vulnerability exposure". Every
 * request it issues is scoped to the selected fleet, which is what these cases
 * pin down — the card, its controls, the dataset switch, and an applied filter,
 * each verified against the `/charts/<metric>` request the card actually sends.
 *
 * **Why the VMs fleet.** The chart plots 30 days of history, and only the VMs
 * fleet has hosts that have been checking in for that long — Workstations holds
 * no hosts, so its chart is a field of "No data" cells that can't tell a
 * working query from a broken one.
 *
 * **Nothing here persists.** ChartCard keeps its filter state in component
 * state only ("UI edits are not saved"), so the applied filter is gone on
 * reload — which the last case asserts rather than cleans up.
 *
 * Not covered here: the per-fleet "disable historical reporting" settings that
 * swap the chart for its "Data collection is disabled" state. That is a config
 * write (org settings + fleet settings) and belongs with the self-contained
 * mutation batch, not this one.
 *
 * Grounded in frontend/pages/DashboardPage/cards/ChartCard (DATASETS, the
 * premium-gated `cve` dataset, `Configure chart filters`, the `Filtered` pill)
 * and its ChartFilterModal ("Settings", Labels/Platforms, Apply).
 */
import { test, expect } from '@fixtures';

// The fleet that owns the real QA VMs — see the header for why it, and not
// Workstations, is the scope these cases run under.
const FLEET = 'VMs';

test.describe('Premium • Dashboard • fleet-scoped chart card', () => {
  test('Hosts online renders for a fleet scope, with its controls', async ({
    dashboard,
    vmsFleetId,
  }) => {
    await dashboard.goto();

    const chartRequest = dashboard.page.waitForResponse(
      (res) =>
        res.url().includes('/charts/uptime') &&
        res.url().includes(`fleet_id=${vmsFleetId}`) &&
        res.status() === 200,
    );
    await dashboard.teamDropdown.selectByLabel(FLEET);
    await chartRequest;

    // Premium replaces free's plain "Hosts online" heading with the dataset
    // dropdown, so the heading must not be there.
    await expect(dashboard.chartDatasetValue).toHaveText('Hosts online');
    await expect(dashboard.chartTitle).toHaveCount(0);
    await expect(dashboard.chartInfoIcon).toBeVisible();
    await expect(dashboard.configureChartFiltersButton).toBeVisible();
    await expect(dashboard.chartLegend).toContainText('No data');
    await expect(dashboard.chartLegend).toContainText('More');

    // A disabled dataset renders an explanatory panel in place of the chart, so
    // asserting its absence keeps an instance-wide setting from passing as data.
    await expect(dashboard.dataCollectionDisabledHeading).toHaveCount(0);
    await expect(dashboard.chartCellsWithHosts.first()).toBeVisible();
  });

  test('switching to Vulnerability exposure re-requests the chart for the fleet', async ({
    dashboard,
    vmsFleetId,
  }) => {
    await dashboard.goto();
    await dashboard.teamDropdown.selectByLabel(FLEET);
    await expect(dashboard.chartDatasetValue).toHaveText('Hosts online');

    const cveRequest = dashboard.page.waitForResponse(
      (res) =>
        res.url().includes('/charts/cve') &&
        res.url().includes(`fleet_id=${vmsFleetId}`) &&
        res.status() === 200,
    );
    await dashboard.selectChartDataset('Vulnerability exposure');
    await cveRequest;

    await expect(dashboard.dataCollectionDisabledHeading).toHaveCount(0);
    await expect(dashboard.chartCells.first()).toBeVisible();
    await expect(dashboard.chartInfoIcon).toBeVisible();
    await expect(dashboard.configureChartFiltersButton).toBeVisible();
  });

  test('applying a platform filter narrows the request and flags the chart Filtered', async ({
    dashboard,
    vmsFleetId,
  }) => {
    await dashboard.goto();
    await dashboard.teamDropdown.selectByLabel(FLEET);
    await expect(dashboard.chartDatasetValue).toHaveText('Hosts online');
    // The pill only appears once the filters differ from the card's seeded
    // defaults, so it must be absent before the filter is applied.
    await expect(dashboard.chartFilteredPill).toHaveCount(0);

    const filteredRequest = dashboard.page.waitForResponse(
      (res) =>
        res.url().includes('/charts/uptime') &&
        res.url().includes(`fleet_id=${vmsFleetId}`) &&
        res.url().includes('platforms=darwin') &&
        res.status() === 200,
    );
    await dashboard.openChartFilters();
    await dashboard.selectChartFilterPlatforms(['macOS']);
    await dashboard.applyChartFilters();
    await filteredRequest;

    await expect(dashboard.chartFilteredPill).toBeVisible();

    // Filters live in component state, never in config: a reload is the whole
    // cleanup, and the pill going away is the proof nothing was written.
    await dashboard.page.reload();
    await expect(dashboard.chartDatasetValue).toHaveText('Hosts online');
    await expect(dashboard.chartFilteredPill).toHaveCount(0);
  });
});
