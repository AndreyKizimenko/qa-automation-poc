/**
 * Premium • Software • Custom display name (Unassigned).
 *
 * "Display name" lives in the same Edit-appearance modal as the custom icon and
 * shares its Save, but it's a separate write with its own toasts, so it gets its
 * own spec and its own Fleet-maintained app (see custom-icons.spec's header for
 * why each software spec claims a distinct slug).
 *
 * Premium-only: the modal is only reachable on a title an installer manages, and
 * every Add-software path is paywalled on free.
 *
 * The override is title-level — set it and Fleet renders that name on the detail
 * page and everywhere the title is listed; clear it and the package's own name
 * comes back. The name is stamped with `Date.now()` so a rerun can't find a
 * stale row from a previous run and call it a pass.
 */
import { test, expect } from '@fixtures';
import { addFmaToFleet, deleteSoftwareTitle, getSoftwareTitle } from '@helpers/api';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;

test.describe('Premium • Software • Custom display name', () => {
  test('setting and clearing a display name changes how the title is listed', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    request,
  }) => {
    // Seeding the app makes Fleet fetch the installer from its CDN, and the
    // flow then drives two modal round-trips plus two list reads.
    test.setTimeout(90_000);

    const { titleId } = await addFmaToFleet(request, FLEET_ID, 'clockify/darwin');
    try {
      const { name: titleName } = await getSoftwareTitle(request, FLEET_ID, titleId);
      const displayName = `PW Display Name ${Date.now()}`;

      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      // The Library tab is disabled under "All fleets", which is where premium
      // lands — pick the scope before reaching for it.
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.gotoLibraryTab();
      await softwareLibrary.searchByName(titleName);
      await softwareLibrary.table.rowWith(titleName).getByRole('link').first().click();

      // Fleet normalises a handful of well-known package names for display, so
      // the rendered heading is the baseline to compare against — not the raw
      // title name the API returns.
      await expect(softwareTitleDetail.displayHeading).toBeVisible();
      const originalHeading = await softwareTitleDetail.displayName();

      await softwareTitleDetail.openEditAppearance();
      const modal = softwareTitleDetail.editAppearanceModal;
      await modal.setDisplayName(displayName);

      // Both preview panes track the field live, before anything is saved —
      // the Fleet-admin view and the end-user Self-service view.
      await expect(modal.fleetPreview).toContainText(displayName);
      await modal.showPreview('Self service');
      await expect(modal.selfServicePreview).toContainText(displayName);

      await modal.save(`Successfully renamed ${titleName} to ${displayName}.`);

      await expect(softwareTitleDetail.displayHeading).toHaveText(displayName);

      // The override has to reach the list too — that's the point of setting it.
      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      await softwareLibrary.searchByName(displayName);
      await expect(softwareLibrary.table.rowWith(displayName)).toBeVisible();

      // Clearing the field drops the override rather than saving an empty name.
      await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
      await softwareTitleDetail.openEditAppearance();
      await expect(modal.displayNameInput).toHaveValue(displayName);
      await modal.setDisplayName('');
      await modal.save(`Successfully removed custom name for ${displayName}.`);

      await expect(softwareTitleDetail.displayHeading).toHaveText(originalHeading);
    } finally {
      await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });
});
