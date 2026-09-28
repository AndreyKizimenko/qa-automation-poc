/**
 * Free • Dashboard • historical data collection.
 *
 * Free's half of the surface `premium/dashboard/historical-data-collection.spec`
 * covers. Free has no fleets, so the per-fleet checkboxes cannot exist here —
 * but the deployment-wide "Activity & data retention" switches and the chart
 * card they drive both do, in a cut-down form that is worth pinning:
 *
 *  - the chart card renders a single dataset, so Fleet swaps the premium
 *    dataset dropdown for a plain "Hosts online" heading;
 *  - Advanced options offers "Hosts online historical reporting" but not
 *    "Vulnerability exposure historical reporting", which is premium-gated in
 *    `ActivityDataRetentionSection`;
 *  - free's dashboard has no fleet dropdown at all, so "all fleets" is the only
 *    scope a switch can apply to.
 *
 * **Read-only, deliberately.** The only switch free exposes is the
 * deployment-wide one, and turning it off *deletes the history already
 * collected* — Fleet's confirmation says "This cannot be undone" — for the
 * whole instance, permanently. There is no per-fleet throwaway scope to fall
 * back on here the way the premium spec has one, so these cases assert the
 * switch's state and the chart it drives rather than flipping it. Turning it
 * off and on again would leave the free instance's chart a field of "No data"
 * for 30 days.
 *
 * The polarity differs from the premium fleet page: here the checkbox is an
 * *enable* ("Hosts online historical reporting", ticked = still collecting),
 * there it is a *disable*. Both share the `disableHostsActive` accessible name,
 * so trust the assertion's expected value over the locator's name.
 */
import { test, expect } from '@fixtures';
import { getGlobalHistoricalData } from '@helpers/api';

test.describe('Free • Dashboard • historical data collection', () => {
  test('the chart card offers one dataset and charts it', async ({ dashboard, request }) => {
    const globalHistorical = await getGlobalHistoricalData(request);
    test.skip(
      !globalHistorical.uptime,
      'hosts online collection is disabled deployment-wide, so the card renders its disabled state',
    );

    await dashboard.goto();

    // A single dataset means a heading rather than the premium dropdown, and
    // no fleet dropdown means the card is never scoped to anything narrower.
    await expect(dashboard.chartTitle).toHaveText('Hosts online');
    await expect(dashboard.chartDatasetValue).toHaveCount(0);
    await expect(dashboard.teamDropdown.trigger).toHaveCount(0);

    await expect(dashboard.chartInfoIcon).toBeVisible();
    await expect(dashboard.configureChartFiltersButton).toBeVisible();

    // Cells for hours that actually reported: a grid of "No data" cells alone
    // can't tell a working query from a broken one.
    await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
    await expect(dashboard.chartCellsWithHosts.first()).toBeVisible();
  });

  test('Activity & data retention offers the hosts online switch and not the premium one', async ({
    organizationAdvanced,
    request,
  }) => {
    const globalHistorical = await getGlobalHistoricalData(request);

    await organizationAdvanced.goto();
    await expect(organizationAdvanced.retentionSectionHeading).toBeVisible();

    // Ticked means "still collecting" on this page, so the checkbox state is
    // read straight off the config rather than assumed.
    await expect(organizationAdvanced.hostsOnlineHistoricalCheckbox).toHaveAttribute(
      'aria-checked',
      String(globalHistorical.uptime),
    );
    await expect(organizationAdvanced.hostsOnlineHistoricalCheckbox).toHaveAttribute(
      'aria-disabled',
      'false',
    );

    await expect(organizationAdvanced.vulnerabilitiesHistoricalCheckbox).toHaveCount(0);
    await expect(
      organizationAdvanced.page.getByText('Vulnerability exposure historical reporting'),
    ).toHaveCount(0);
  });
});
