/**
 * Premium • Software • Fleet-maintained catalog filters. The three controls
 * over the Add software → Fleet-maintained catalog: the platform filter, the
 * "Hide added apps" slider, and the name search. Read-only — nothing here adds
 * an app.
 *
 * **The item count is not the row count.** Fleet renders one row per app name
 * with a cell per platform, but counts the platform-specific entries, so the
 * catalog reads "1,422 items" over fewer rows and a 3-row "zoom" search reads
 * "5 items". Counts are therefore cross-checked against the API's own count for
 * the same filters; comparing a row count with "N items" would only hold by luck.
 *
 * **Cross-checking beats hard-coding.** The catalog grows with every Fleet
 * release, so the platform counts are compared against
 * `GET /software/fleet_maintained_apps` under the same filters rather than
 * against numbers baked into the spec.
 *
 * **What a platform filter guarantees** is that every row offers that platform:
 * a row whose platform cell shows "---" is an app unavailable there, and none
 * may survive the filter. That replaces the source's per-row loop over every
 * page of results (which paged through 900+ rows one `expect` at a time).
 *
 * Grounded in frontend/pages/SoftwarePage/SoftwareAddPage's
 * SoftwareFleetMaintained table (`platform=` and `available=` request params
 * behind the two filters, `status=available` in the URL).
 */
import { test, expect } from '@fixtures';
import { countFleetMaintainedApps } from '@helpers/api';

// The catalog is identical on every fleet; Unassigned is used because it needs
// no fleet id resolved and holds no fleet-specific state.
const FLEET_ID = 0;

test.describe('Premium • Software • Fleet-maintained filters', () => {
  test('the platform filter narrows the catalog to apps offered on that platform', async ({
    fleetMaintainedApps,
    request,
  }) => {
    await fleetMaintainedApps.goto({ fleetId: FLEET_ID });
    const total = await fleetMaintainedApps.itemCount();
    expect(total).toBe(await countFleetMaintainedApps(request, FLEET_ID));

    await fleetMaintainedApps.selectPlatform('macOS');
    const macCount = await fleetMaintainedApps.itemCount();
    expect(macCount).toBe(await countFleetMaintainedApps(request, FLEET_ID, { platform: 'darwin' }));
    expect(macCount).toBeLessThan(total);
    // Every row on the page must offer macOS; "---" is the unavailable cell.
    await expect(
      fleetMaintainedApps.platformColumnCells('macOS').filter({ hasText: '---' }),
    ).toHaveCount(0);

    await fleetMaintainedApps.selectPlatform('Windows');
    const windowsCount = await fleetMaintainedApps.itemCount();
    expect(windowsCount).toBe(
      await countFleetMaintainedApps(request, FLEET_ID, { platform: 'windows' }),
    );
    expect(windowsCount).toBeLessThan(total);
    expect(windowsCount).not.toBe(macCount);
    await expect(
      fleetMaintainedApps.platformColumnCells('Windows').filter({ hasText: '---' }),
    ).toHaveCount(0);

    await fleetMaintainedApps.selectPlatform('All platforms');
    expect(await fleetMaintainedApps.itemCount()).toBe(total);
  });

  test('"Hide added apps" leaves only entries that can still be added', async ({
    fleetMaintainedApps,
  }) => {
    await fleetMaintainedApps.goto({ fleetId: FLEET_ID });
    const total = await fleetMaintainedApps.itemCount();

    await fleetMaintainedApps.setHideAddedApps(true);
    const available = await fleetMaintainedApps.itemCount();

    // Whatever this fleet has added, the available-only view is the rest of the
    // catalog. The exact difference is deliberately not asserted: the library
    // lifecycle specs add and delete apps on this same scope in parallel, so a
    // count read a second apart is a race, not a regression. The case that
    // proves an added app disappears belongs with the spec that adds one.
    expect(available).toBeLessThanOrEqual(total);

    // The rows that survive all still offer at least one platform to add. A row
    // can carry an already-added platform alongside an available one, so the
    // filter drops *entries*, not rows — which is why this checks for an "Add"
    // button rather than for the absence of the added-app icon.
    await expect(fleetMaintainedApps.rows.first()).toBeVisible();
    await expect(
      fleetMaintainedApps.rows.filter({
        hasNot: fleetMaintainedApps.page.getByRole('button', { name: 'Add', exact: true }),
      }),
    ).toHaveCount(0);

    await fleetMaintainedApps.setHideAddedApps(false);
    expect(await fleetMaintainedApps.itemCount()).toBeGreaterThanOrEqual(available);
  });

  test('searching by name narrows the catalog to matching apps', async ({
    fleetMaintainedApps,
  }) => {
    await fleetMaintainedApps.goto({ fleetId: FLEET_ID });
    const total = await fleetMaintainedApps.itemCount();

    // A stable catalog entry with siblings ("Zoom Rooms", "Zoom Outlook
    // Plugin"), so the search is proven to match on substring rather than to
    // have collapsed to one exact hit.
    const term = 'zoom';
    await fleetMaintainedApps.searchInput.fill(term);

    // The search is debounced and server-side, so poll the rendered names
    // until they all match rather than reading once.
    await expect
      .poll(async () => {
        const names = await fleetMaintainedApps.nameCells.allInnerTexts();
        return names.length > 1 && names.every((n) => n.toLowerCase().includes(term));
      })
      .toBe(true);

    expect(await fleetMaintainedApps.itemCount()).toBeLessThan(total);
  });
});
