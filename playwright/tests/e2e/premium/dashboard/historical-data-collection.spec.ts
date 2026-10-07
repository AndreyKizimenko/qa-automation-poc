/**
 * Premium • Dashboard • turning a fleet's historical data collection off.
 *
 * The write half of the dashboard's chart card. `fleet-scoped-cards.spec`
 * covers what the card shows while collection is on; this covers the two
 * checkboxes an admin can tick to turn it off, one dataset at a time, and what
 * the card becomes when they do — the "Data collection is disabled" panel with
 * a "Turn on" button leading back to the switch that caused it.
 *
 * Premium-only: the checkboxes live on a fleet's Settings tab and free has no
 * fleets. Free's half of this surface — the deployment-wide switches and the
 * single-dataset chart they drive — is in
 * `tests/e2e/free/dashboard/historical-data-collection.spec.ts`.
 *
 * **This spec creates and deletes its own fleet, which `playwright/CLAUDE.md`
 * otherwise forbids.** That rule exists to protect Workstations, which gitops
 * provisions and nothing may delete. A throwaway fleet that lives only between
 * the top of this test and its `finally` is a different thing, and it is the
 * only safe subject here, because **disabling collection deletes the data
 * already collected** — Fleet's own confirmation says "This cannot be undone".
 * A fleet created seconds ago has no history to lose; every standing fleet
 * does. Do not "simplify" this onto Workstations, VMs or any other fleet the
 * instance keeps.
 *
 * **The deployment-wide switches are read, never written.** Flipping them
 * deletes every fleet's history at once, including
 * the 30 days of VMs-fleet history `fleet-scoped-cards.spec` plots in parallel
 * with this one. So this spec requires global collection to be on and skips if
 * it isn't — which is also the only state in which the per-fleet checkboxes are
 * editable (they grey out with a "Disabled globally" tooltip otherwise).
 *
 * **Polarity.** The fleet checkboxes are phrased as *disables* and the API
 * field is their opposite (`features.historical_data.uptime: true` means "still
 * collecting"); the deployment-wide checkboxes on Advanced options are phrased
 * as *enables*. Read the helper names rather than trusting polarity from
 * memory.
 *
 * Grounded in frontend/pages/admin/ManageFleetsPage/.../TeamSettings
 * (`datasetsBeingDisabled`, which lists only the datasets a save newly turns
 * off), components/ConfirmDataCollectionDisableModal, and
 * DashboardPage/cards/ChartCard/DataCollectionDisabledState (whose sentence
 * names the scope the switch applied to).
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import {
  createFleet,
  deleteFleet,
  getFleetHistoricalData,
  getGlobalHistoricalData,
} from '@helpers/api';
import { TeamSettingsPage } from '@pages';

/**
 * Runs `action` and waits for the chart request it triggers.
 *
 * The card renders from that response, and `/charts/cve` takes upwards of ten
 * seconds on the QA instances — longer than the suite's assertion timeout — so
 * asserting on cells without this races the fetch and fails as an empty chart.
 * `metric` is the API's name for the dataset: `uptime` for "Hosts online",
 * `cve` for "Vulnerability exposure".
 *
 * Only call this for a dataset whose collection is **on**. ChartCard gates the
 * query on collection being enabled, so a disabled dataset issues no request at
 * all and there would be nothing to wait for.
 */
async function withChartResponse(
  page: Page,
  metric: 'uptime' | 'cve',
  fleetId: number,
  action: () => Promise<void>,
): Promise<void> {
  const response = page.waitForResponse(
    (res) =>
      res.url().includes(`/charts/${metric}`) &&
      res.url().includes(`fleet_id=${fleetId}`) &&
      res.status() === 200,
    // The project leaves `actionTimeout` unset, which makes page waits
    // unbounded — without this a chart request that never lands burns the whole
    // test budget instead of failing where it broke.
    { timeout: 60_000 },
  );
  await action();
  await response;
}

/**
 * Removes the throwaway fleet, retrying on a schedule until Fleet accepts the
 * delete. The cleanup projects sweep `pw-*` fleets only at a run's edges, so a
 * stray one would sit in every other spec's fleet dropdown until then — and the
 * QA instance's gateway serves the occasional 502, so one attempt isn't enough
 * of a guarantee.
 */
async function deleteFleetWithRetry(request: APIRequestContext, id: number): Promise<void> {
  await expect
    .poll(() => deleteFleet(request, id, { ignoreMissing: true }).then(() => true, () => false), {
      timeout: 30_000,
      message: `throwaway fleet ${id} could not be deleted and is still on the instance`,
    })
    .toBe(true);
}

test.describe('Premium • Dashboard • historical data collection', () => {
  // Tracked outside the test as well as inside it: Playwright aborts a timed-out
  // test before its `finally` runs, but still gives hooks their own budget, so
  // this is what stops a timeout stranding a fleet on the instance.
  let throwawayFleetId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (throwawayFleetId !== undefined) await deleteFleetWithRetry(request, throwawayFleetId);
  });

  test('each fleet switch empties its own chart dataset, and re-enabling restores both', async ({
    dashboard,
    page,
    request,
  }) => {
    // Three fleet-settings saves, two of them behind a confirmation, four
    // dashboard loads, and three waits on `/charts/cve`, which takes upwards of
    // ten seconds a call.
    test.setTimeout(180_000);

    const globalHistorical = await getGlobalHistoricalData(request);
    test.skip(
      !globalHistorical.uptime || !globalHistorical.vulnerabilities,
      'historical collection is disabled deployment-wide, which greys out the per-fleet switches',
    );

    const teamSettings = new TeamSettingsPage(page);
    // Created before the first page load so the fleet dropdown, which reads the
    // team list once at app boot, already lists it. The parallel index keeps
    // the name unique when `--repeat-each` starts several copies in the same
    // millisecond — Fleet rejects a duplicate fleet name.
    const fleet = await createFleet(
      request,
      `pw-historical-data-${Date.now()}-${test.info().parallelIndex}`,
    );
    throwawayFleetId = fleet.id;

    try {
      // A fleet this new has no hosts and no history, so its chart is a grid of
      // "No data" cells. The grid's presence, not its values, is the signal
      // that the dataset is still being collected.
      await withChartResponse(page, 'uptime', fleet.id, () =>
        dashboard.goto({ fleetId: fleet.id }),
      );
      await dashboard.teamDropdown.selectByLabel(fleet.name);
      await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
      await expect(dashboard.chartCells.first()).toBeVisible();

      await withChartResponse(page, 'cve', fleet.id, () =>
        dashboard.selectChartDataset('Vulnerability exposure'),
      );
      await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
      await expect(dashboard.chartCells.first()).toBeVisible();

      // Hosts online off, vulnerability exposure untouched.
      await teamSettings.goto(fleet.id);
      await expect(teamSettings.retentionSectionHeading).toBeVisible();
      await teamSettings.setHistoricalDataDisabled('hostsOnline', true);
      await teamSettings.toast.dismissAll();
      await teamSettings.save();

      // The confirmation names the fleet and lists only what this save deletes
      // — the proof that a per-fleet switch, not the deployment-wide one, is
      // about to be written.
      await expect(teamSettings.confirmDisableModal).toContainText(`fleet "${fleet.name}"`);
      await expect(teamSettings.confirmDisableDatasets).toHaveText(['Hosts online']);
      await teamSettings.confirmDisable();

      expect(await getFleetHistoricalData(request, fleet.id)).toEqual({
        uptime: false,
        vulnerabilities: true,
      });

      // One dataset collapses, the other keeps charting: the switches are
      // independent, which toggling both at once could never show.
      await dashboard.goto({ fleetId: fleet.id });
      await dashboard.teamDropdown.selectByLabel(fleet.name);
      await dashboard.selectChartDataset('Hosts online');
      await expect(dashboard.dataCollectionDisabledHeading).toBeVisible();
      await expect(dashboard.dataCollectionDisabledPanel).toContainText(
        'to see data for this fleet',
      );
      await expect(dashboard.chartCells).toHaveCount(0);

      await withChartResponse(page, 'cve', fleet.id, () =>
        dashboard.selectChartDataset('Vulnerability exposure'),
      );
      await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
      await expect(dashboard.chartCells.first()).toBeVisible();

      // "Turn on" is the card's way back — it routes to the fleet's settings,
      // where the switch that emptied the card lives.
      await dashboard.selectChartDataset('Hosts online');
      await dashboard.chartTurnOnButton.click();
      await expect(page).toHaveURL(
        new RegExp(`/settings/fleets/settings\\?fleet_id=${fleet.id}`),
      );
      await expect(teamSettings.retentionSectionHeading).toBeVisible();
      await expect(teamSettings.disableHostsOnlineCheckbox).toHaveAttribute(
        'aria-checked',
        'true',
      );

      // Vulnerability exposure off as well. Hosts online is already off, so the
      // confirmation lists only the dataset this save newly disables.
      await teamSettings.setHistoricalDataDisabled('vulnerabilities', true);
      await teamSettings.toast.dismissAll();
      await teamSettings.save();
      await expect(teamSettings.confirmDisableDatasets).toHaveText([
        'Vulnerability exposure',
      ]);
      await teamSettings.confirmDisable();

      expect(await getFleetHistoricalData(request, fleet.id)).toEqual({
        uptime: false,
        vulnerabilities: false,
      });

      // Neither dataset issues a chart request now, so both panels render
      // straight from the fleet's config.
      await dashboard.goto({ fleetId: fleet.id });
      await dashboard.teamDropdown.selectByLabel(fleet.name);
      for (const dataset of ['Hosts online', 'Vulnerability exposure'] as const) {
        await dashboard.selectChartDataset(dataset);
        await expect(dashboard.dataCollectionDisabledHeading).toBeVisible();
        await expect(dashboard.chartCells).toHaveCount(0);
      }

      // Re-enabling needs no confirmation — nothing is deleted on the way back.
      await dashboard.chartTurnOnButton.click();
      await expect(teamSettings.retentionSectionHeading).toBeVisible();
      await teamSettings.setHistoricalDataDisabled('hostsOnline', false);
      await teamSettings.setHistoricalDataDisabled('vulnerabilities', false);
      await teamSettings.toast.dismissAll();
      await teamSettings.save();
      await teamSettings.toast.expectSuccess('Successfully updated settings.');
      await expect(teamSettings.confirmDisableModal).toHaveCount(0);

      expect(await getFleetHistoricalData(request, fleet.id)).toEqual({
        uptime: true,
        vulnerabilities: true,
      });

      // Both charts come back. Each dashboard entry is a fresh page load, which
      // is what makes this meaningful: ChartCard holds every dataset for five
      // minutes, so a chart "restored" without reloading could be the copy
      // fetched before anything was turned off.
      await withChartResponse(page, 'uptime', fleet.id, () =>
        dashboard.goto({ fleetId: fleet.id }),
      );
      await dashboard.teamDropdown.selectByLabel(fleet.name);
      await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
      await expect(dashboard.chartCells.first()).toBeVisible();

      await withChartResponse(page, 'cve', fleet.id, () =>
        dashboard.selectChartDataset('Vulnerability exposure'),
      );
      await expect(dashboard.dataCollectionDisabledPanel).toHaveCount(0);
      await expect(dashboard.chartCells.first()).toBeVisible();
    } finally {
      // In the finally so a failure mid-flow still leaves no fleet behind.
      await deleteFleetWithRetry(request, fleet.id);
      throwawayFleetId = undefined;
    }
  });
});
