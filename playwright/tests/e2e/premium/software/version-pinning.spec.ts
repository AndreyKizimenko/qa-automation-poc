/**
 * Premium • Software • Version pinning (QA fleet).
 *
 * The Versions modal decides which build of a Fleet-maintained app a fleet
 * installs. Fleet offers exactly four answers and this spec walks all of them:
 *
 *   | target       | radio                            | stored as | accordion badge |
 *   |---|---|---|---|
 *   | latest       | "Automatically update to latest" | `''`      | Latest |
 *   | newest exact | "Pin to 1.2.3"                   | `1.2.3`   | Pinned |
 *   | older exact  | "Pin to 1.2.2"                   | `1.2.2`   | Pinned |
 *   | major        | "Pin to major version (1)"       | `^1`      | Major version |
 *
 * Premium + Fleet-maintained only (`canManageVersions` in `SoftwareSummaryCard`);
 * a custom package has no Versions item at all.
 *
 * **Why the QA fleet, and why nothing is seeded here.** Fleet caches installer
 * builds *per fleet* (`software_installers.global_or_team_id`), and adding an
 * app caches exactly one — so a spec that seeds its own app can never reach the
 * "older exact" row. What fills that list is Fleet's hourly
 * `maintained_apps_auto_update` cron: for every app in latest/caret mode it
 * downloads the newest published build and keeps the previous one. An app that
 * *stays* on a fleet therefore grows a version history on its own. That shelf is
 * provisioned by `gitops/premium-fleetqa/fleets/qa.yml` — ten frequently-updated
 * apps on macOS and Windows, parked on the QA fleet because `setup/cleanup.steps.ts`
 * wipes installable software on Unassigned and Workstations and touches no other
 * fleet. Read that file's header before changing anything here.
 *
 * **Restore the pin or the shelf stops growing.** An exact pin makes the cron
 * skip the title entirely ("a literal pin never advances and never pre-caches",
 * `ee/server/service/maintained_apps_auto_update.go`), so a run that walks away
 * from a pinned title freezes that app's version history for everyone. Both
 * tests clear the pin in a `finally`, and both assert at the start that they
 * inherited an unpinned title.
 *
 * Each case asserts three layers, because they fail independently: the radio the
 * modal reopens on, the badge on the Library accordion row, and the
 * `pinned_version` Fleet stored.
 *
 * Serial, not parallel: both tests mutate the same durable shelf and may land on
 * the same title, since the older-version case takes whichever app has
 * accumulated the most builds.
 */
import { test, expect } from '@fixtures';
import {
  getSoftwarePackage,
  listFleetMaintainedTitles,
  setPinnedVersion,
  type FleetMaintainedTitle,
} from '@helpers/api';
import {
  pinTargetApiValue,
  type DashboardPage,
  type PinTarget,
  type SoftwareLibraryPage,
  type SoftwareTitlesPage,
} from '@pages';

const SCOPE = 'QA';

/**
 * The app the pin-shape walk drives. Named rather than resolved so a failure
 * names one app, and macOS because the shelf's macOS entries are the ones every
 * other premium software spec already reasons about.
 *
 * The Library's "Type" cell is what separates it from the Windows title of the
 * same name — the shelf carries both, and a name-only row lookup is ambiguous.
 */
const PIN_SHAPES_APP = { name: 'Postman', platform: 'darwin' } as const;

const TYPE_CELL: Record<string, string> = {
  darwin: 'Application (macOS)',
  windows: 'Application (Windows)',
};

/** Fails with the recreation path rather than a bare "undefined" further down. */
function requireTitle(
  titles: FleetMaintainedTitle[],
  app: { name: string; platform: string },
): FleetMaintainedTitle {
  const found = titles.find((t) => t.name === app.name && t.platform === app.platform);
  if (!found) {
    throw new Error(
      `"${app.name}" (${app.platform}) is missing from the QA fleet's Fleet-maintained shelf. ` +
        `Re-apply gitops/premium-fleetqa/fleets/qa.yml — see that file and the gitops README.`,
    );
  }
  return found;
}

test.describe('Premium • Software • Version pinning', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * Dashboard → Software → QA → Library → the one row for this title. The shelf
   * carries the same app on macOS and Windows under one name, so the row is
   * pinned by its visible "Type" cell as well.
   */
  async function openLibraryTitle(
    dashboard: DashboardPage,
    softwareTitles: SoftwareTitlesPage,
    softwareLibrary: SoftwareLibraryPage,
    title: FleetMaintainedTitle,
  ): Promise<void> {
    await dashboard.goto();
    await dashboard.navbar.goToSoftware();
    // The Library tab is disabled under "All fleets", which is where premium
    // lands — pick the scope before reaching for it.
    await softwareTitles.teamDropdown.selectByLabel(SCOPE);
    await softwareTitles.gotoLibraryTab();
    await softwareLibrary.searchByName(title.name);
    await softwareLibrary.table
      .rowWith(title.name)
      .filter({ hasText: TYPE_CELL[title.platform] })
      .getByRole('link')
      .first()
      .click();
  }

  test('pinning to latest, an exact version and a major version each take effect', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    request,
    qaFleetId,
  }) => {
    // Three pin round-trips, each reopening the modal and re-reading the row.
    test.setTimeout(90_000);

    const titles = await listFleetMaintainedTitles(request, qaFleetId);
    const title = requireTitle(titles, PIN_SHAPES_APP);
    expect(title.versions.length, 'Fleet has no cached build for the shelf app').toBeGreaterThan(0);

    const card = softwareTitleDetail.installerCard;
    const versionsModal = softwareTitleDetail.versionsModal;

    const before = await getSoftwarePackage(request, qaFleetId, title.titleId);
    expect(
      before?.pinnedVersion,
      `"${title.name}" arrived pinned — an earlier run died before restoring it, and the pin ` +
        `stops Fleet caching new builds for the whole shelf`,
    ).toBe('');

    try {
      // Newest first, as the modal lists them; the major pin always tracks the
      // newest version's major.
      const newest = title.versions[0];
      const newestMajor = newest.split('.')[0];

      await openLibraryTitle(dashboard, softwareTitles, softwareLibrary, title);
      await expect(softwareTitleDetail.displayHeading).toBeVisible();
      const displayName = await softwareTitleDetail.displayName();

      // An unpinned app tracks latest, so the row is badged "Latest".
      await expect(card.latestBadge).toBeVisible();

      await softwareTitleDetail.openVersions();
      expect(await versionsModal.optionLabels()).toEqual([
        'Automatically update to latest',
        ...title.versions.map((v) => `Pin to ${v}`),
        `Pin to major version (${newestMajor})`,
      ]);
      await versionsModal.cancel();

      const cases: PinTarget[] = [
        { kind: 'exact', version: newest },
        { kind: 'major', major: newestMajor },
        { kind: 'latest' },
      ];

      for (const target of cases) {
        await softwareTitleDetail.openVersions();
        await versionsModal.select(target);
        await versionsModal.save(displayName);

        // Exactly one row carries a pin-state badge, and it's the one matching
        // the target — the three shapes are mutually exclusive, which is the
        // bug a per-badge count catches and a "is it visible" check doesn't.
        await expect(card.latestBadge).toHaveCount(target.kind === 'latest' ? 1 : 0);
        await expect(card.pinnedBadge).toHaveCount(target.kind === 'exact' ? 1 : 0);
        await expect(card.majorVersionBadge).toHaveCount(target.kind === 'major' ? 1 : 0);

        // Reopening shows the saved selection, which is what the next admin to
        // open the modal sees; Save is disabled because nothing has changed.
        await softwareTitleDetail.openVersions();
        await expect(versionsModal.radio(target)).toBeChecked();
        await expect(versionsModal.saveButton).toBeDisabled();
        await versionsModal.cancel();

        const stored = await getSoftwarePackage(request, qaFleetId, title.titleId);
        expect(stored?.pinnedVersion).toBe(pinTargetApiValue(target));
      }
    } finally {
      await setPinnedVersion(request, qaFleetId, title.titleId, '');
    }
  });

  test('pinning to an older version stores that build, not the newest', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    request,
    qaFleetId,
  }) => {
    const titles = await listFleetMaintainedTitles(request, qaFleetId);
    expect(titles.length, 'the QA fleet has no Fleet-maintained apps').toBeGreaterThan(0);

    // Whichever shelf app has accumulated the most builds; ties break on the
    // API's name ordering, so the choice is stable within a run.
    const title = titles.reduce((best, t) => (t.versions.length > best.versions.length ? t : best));

    // Every app arrives with one cached build and gains a second only when
    // upstream ships an update and Fleet's hourly cron pulls it. Nothing a test
    // can arrange, so this stays a precondition rather than a failure.
    test.skip(
      title.versions.length < 2,
      'no app on the QA shelf has cached a second version yet',
    );

    const card = softwareTitleDetail.installerCard;
    const versionsModal = softwareTitleDetail.versionsModal;
    const older = title.versions[1];

    const before = await getSoftwarePackage(request, qaFleetId, title.titleId);
    expect(
      before?.pinnedVersion,
      `"${title.name}" arrived pinned — an earlier run died before restoring it`,
    ).toBe('');

    try {
      await openLibraryTitle(dashboard, softwareTitles, softwareLibrary, title);
      await expect(softwareTitleDetail.displayHeading).toBeVisible();
      const displayName = await softwareTitleDetail.displayName();

      await softwareTitleDetail.openVersions();
      await versionsModal.select({ kind: 'exact', version: older });
      await versionsModal.save(displayName);

      await expect(card.pinnedBadge).toHaveCount(1);
      await expect(card.latestBadge).toHaveCount(0);
      await expect(card.majorVersionBadge).toHaveCount(0);

      await softwareTitleDetail.openVersions();
      await expect(versionsModal.radio({ kind: 'exact', version: older })).toBeChecked();
      // The newest build is still offered — pinning back a version doesn't drop
      // it from the cache, which is what makes the pin reversible.
      await expect(versionsModal.radio({ kind: 'exact', version: title.versions[0] })).not.toBeChecked();
      await versionsModal.cancel();

      const stored = await getSoftwarePackage(request, qaFleetId, title.titleId);
      expect(stored?.pinnedVersion).toBe(older);
      // The active installer follows the pin, so the library serves the older
      // build from here on.
      expect(stored?.version).toBe(older);
    } finally {
      await setPinnedVersion(request, qaFleetId, title.titleId, '');
    }
  });
});
