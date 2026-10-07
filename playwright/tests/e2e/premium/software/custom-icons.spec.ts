/**
 * Premium • Software • Custom icons (Unassigned).
 *
 * A software title's icon is set from the summary card's Actions → Edit
 * appearance. Premium-only, because the modal is only reachable on a title an
 * installer manages and every Add-software path is paywalled on free (see
 * library.spec's header).
 *
 * Two concerns, one per test, each on its own Fleet-maintained app so they
 * can't trip over each other under `fullyParallel`:
 *   1. the upload → replace → remove lifecycle;
 *   2. the client-side validation gate (`EditIconModal.onFileSelect`), which
 *      rejects a file before any request leaves the browser.
 *
 * **Why the assertions are what they are, and not screenshots.** Fleet renders a custom icon by fetching the blob and swapping in an
 * `<img class="software-icon__software-img">`; the built-in fallback renders a
 * different element entirely. So the presence of that element *is* the
 * user-visible "custom icon in effect" signal, and `icon_url` flipping to an
 * `/api/…` path is the write behind it. Together they say what a screenshot
 * said, and they say which half broke.
 *
 * Icon fixtures are generated, not downloaded — see
 * `test-data/shared/images/README.md` for the recipe and what each one violates.
 *
 * FMA choice: `anydesk` / `archaeology` are small, fast to add, and used by no
 * other spec. `install-software.spec` claims eleven macOS slugs for its
 * pagination case and `library.spec` claims `airtame`; adding one of those here
 * would hand two specs the same title on the same fleet.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { addFmaToFleet, deleteSoftwareTitle, getSoftwareTitle } from '@helpers/api';
import { apiUrl, authHeaders } from '@helpers/api/core';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;

const IMAGES = path.resolve(__dirname, '../../../../test-data/shared/images');
const icon = (name: string): string => path.join(IMAGES, name);

const SIZE_ERROR = "Couldn't edit. Icon must be 100KB or less.";
const DIMENSION_ERROR =
  "Couldn't edit. Icon must be square, between 120x120px and 1024x1024px.";

/** The stored `icon_url`: `/api/…` once a custom icon is attached, else null. */
async function storedIconUrl(
  request: Parameters<typeof getSoftwareTitle>[0],
  titleId: number,
): Promise<string | null> {
  const res = await request.get(apiUrl(`software/titles/${titleId}`), {
    headers: authHeaders(),
    params: { fleet_id: String(FLEET_ID) },
  });
  await expect(res, `Failed to fetch software title ${titleId}`).toBeOK();
  return (await res.json()).software_title?.icon_url ?? null;
}

test.describe('Premium • Software • Custom icons', () => {
  test('upload, replace and remove a custom icon', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    request,
  }) => {
    // Seeding the app makes Fleet fetch the installer from its CDN, and the
    // flow then drives four modal round-trips; 90s caps the whole test with
    // headroom rather than budgeting each step.
    test.setTimeout(90_000);

    const { titleId } = await addFmaToFleet(request, FLEET_ID, 'anydesk/darwin');
    try {
      const { name: titleName } = await getSoftwareTitle(request, FLEET_ID, titleId);

      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      // The Library tab is disabled under "All fleets", which is where premium
      // lands — pick the scope before reaching for it.
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.gotoLibraryTab();
      await softwareLibrary.searchByName(titleName);
      await softwareLibrary.table.rowWith(titleName).getByRole('link').first().click();

      await expect(softwareTitleDetail.displayHeading).toBeVisible();
      await expect(softwareTitleDetail.customIcon).toHaveCount(0);
      expect(await storedIconUrl(request, titleId)).toBeNull();

      // Upload.
      await softwareTitleDetail.openEditAppearance();
      await softwareTitleDetail.editAppearanceModal.setIcon(icon('fleet-test-icon-valid.png'));
      await expect(softwareTitleDetail.editAppearanceModal.fileName).toHaveText(
        'fleet-test-icon-valid.png',
      );
      await expect(softwareTitleDetail.editAppearanceModal.fileDescription).toHaveText(
        'Software icon • 256x256 px',
      );
      // Both preview panes render the staged icon before anything is saved —
      // the Fleet-admin view and the end-user Self-service view.
      await expect(softwareTitleDetail.editAppearanceModal.iconPreview).toBeVisible();
      await softwareTitleDetail.editAppearanceModal.showPreview('Self service');
      await expect(softwareTitleDetail.editAppearanceModal.selfServiceIconPreview).toBeVisible();

      await softwareTitleDetail.editAppearanceModal.save(`Successfully edited ${titleName}.`);

      await expect(softwareTitleDetail.customIcon).toBeVisible();
      expect(await storedIconUrl(request, titleId)).toMatch(/^\/api\//);

      // The titles list renders the same icon, which is what makes a custom
      // icon useful — it identifies the title everywhere it's listed.
      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      await softwareLibrary.searchByName(titleName);
      await expect(
        softwareLibrary.table.rowWith(titleName).locator('.software-icon__software-img'),
      ).toBeVisible();

      // Replace. Reopening shows the stored icon as the staged file, so this
      // exercises FileDetails' pencil input rather than the empty uploader.
      await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
      await softwareTitleDetail.openEditAppearance();
      expect(await softwareTitleDetail.editAppearanceModal.hasStagedIcon()).toBe(true);
      await softwareTitleDetail.editAppearanceModal.setIcon(icon('fleet-test-logo.png'));
      await expect(softwareTitleDetail.editAppearanceModal.fileName).toHaveText(
        'fleet-test-logo.png',
      );
      await softwareTitleDetail.editAppearanceModal.save(`Successfully edited ${titleName}.`);
      await expect(softwareTitleDetail.customIcon).toBeVisible();

      // Remove — back to Fleet's matched fallback icon.
      await softwareTitleDetail.openEditAppearance();
      await softwareTitleDetail.editAppearanceModal.removeIcon();
      await softwareTitleDetail.editAppearanceModal.save(
        `Successfully removed icon from ${titleName}.`,
      );

      await expect(softwareTitleDetail.customIcon).toHaveCount(0);
      expect(await storedIconUrl(request, titleId)).toBeNull();
    } finally {
      await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });

  test('only square PNGs of the right size and dimensions are accepted', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    request,
  }) => {
    test.setTimeout(90_000);

    const { titleId } = await addFmaToFleet(request, FLEET_ID, 'archaeology/darwin');
    try {
      const { name: titleName } = await getSoftwareTitle(request, FLEET_ID, titleId);

      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      // The Library tab is disabled under "All fleets", which is where premium
      // lands — pick the scope before reaching for it.
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.gotoLibraryTab();
      await softwareLibrary.searchByName(titleName);
      await softwareLibrary.table.rowWith(titleName).getByRole('link').first().click();

      await softwareTitleDetail.openEditAppearance();
      const modal = softwareTitleDetail.editAppearanceModal;

      // Each rejection raises its own toast. Success toasts auto-dismiss but
      // error toasts don't, so clear the corner between attempts — otherwise
      // the next assertion can match the previous attempt's card.
      const rejections: [string, string][] = [
        ['fleet-test-icon-oversize.png', SIZE_ERROR],
        ['fleet-test-icon-not-square.png', DIMENSION_ERROR],
        ['fleet-test-icon-too-large.png', DIMENSION_ERROR],
        ['fleet-test-icon-too-small.png', DIMENSION_ERROR],
      ];
      for (const [fixture, message] of rejections) {
        await modal.expectIconRejected(icon(fixture), message);
        // A rejected file is never staged: the empty uploader stays put.
        await expect(modal.chooseFileButton).toBeVisible();
        expect(await modal.hasStagedIcon()).toBe(false);
        await modal.toast.dismissAll();
      }

      // A file inside every limit stages cleanly and leaves no toast behind.
      await modal.setIcon(icon('fleet-test-icon-valid.png'));
      await expect(modal.fileName).toHaveText('fleet-test-icon-valid.png');
      await expect(modal.toast.error).toHaveCount(0);

      await modal.save(`Successfully edited ${titleName}.`);
      expect(await storedIconUrl(request, titleId)).toMatch(/^\/api\//);
    } finally {
      await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });
});
