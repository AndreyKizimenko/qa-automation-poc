/**
 * Premium • Software • Script-only package (Unassigned).
 *
 * A `.sh` uploaded through Add software → Custom package is not an installer:
 * Fleet stores the file's contents *as* the install script and calls the result
 * a "Script-only package (macOS & Linux)". This spec is the add → inspect →
 * delete round-trip for that shape, driven through the UI end to end because
 * the upload preview is half of what it verifies.
 *
 * Premium-only — every Add-software path is paywalled on free.
 *
 * Scope: Unassigned only. library.spec already covers add/delete across scopes
 * and package kinds; what's unique here is the script-only *shape* — the sh
 * graphic and "macOS & Linux" subtext on the uploader, the Type line, and the
 * install script Fleet derives from the file rather than generating.
 *
 * Running the package on a host is deliberately out of scope: that's a real
 * execution round-trip and lives with the other host-execution specs.
 *
 * Fixture: `fleet-playwright-script-package.sh`. Fleet titles a script package
 * after its filename minus the extension, so this name is also the title —
 * unique across the suite, which keeps a parallel worker from adding a second
 * package to the same title and making the accordion ambiguous.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import {
  assertActivity,
  deleteSoftwareTitle,
  getSoftwarePackage,
} from '@helpers/api';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;

const FIXTURE = path.resolve(
  __dirname,
  '../../../../test-data/shared/software/fleet-playwright-script-package.sh',
);
const FILE_NAME = 'fleet-playwright-script-package.sh';
const TITLE_NAME = 'fleet-playwright-script-package';

test.describe('Premium • Software • Script-only package', () => {
  test('a .sh is added as a script-only package and removed again', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareCustomPackage,
    softwareTitleDetail,
    request,
    page,
  }) => {
    // Upload plus the activity read can edge past the 60s default under worker
    // load; matches the headroom library.spec gives its add flow.
    test.setTimeout(90_000);

    let titleId = 0;
    try {
      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.clickAddSoftware();
      await softwareCustomPackage.openTab();

      // The uploader tells the user what Fleet made of the file before they
      // commit to it: a shell-script graphic and the platforms it can target.
      await softwareCustomPackage.uploader.setFile(FIXTURE);
      await expect(page.locator('.file-details__name')).toHaveText(FILE_NAME);
      await expect(page.locator('.file-details__description')).toHaveText('macOS & Linux');
      // Fleet picks the graphic from the extension and stamps it with a
      // data-testid; nothing in its role or text distinguishes it.
      await expect(page.locator('.file-details [data-testid="file-sh-graphic"]')).toBeVisible();

      await expect(softwareCustomPackage.addSoftwareButton).toBeEnabled();
      await softwareCustomPackage.addSoftwareButton.click();
      await page.waitForURL(/\/software\/titles\/\d+/, { timeout: 60_000 });
      await softwareCustomPackage.toast.expectSuccess(/successfully added/);

      titleId = Number(page.url().match(/\/software\/titles\/(\d+)/)?.[1]);
      expect(titleId).toBeGreaterThan(0);

      await expect(softwareTitleDetail.displayHeading).toHaveText(TITLE_NAME);
      await expect(softwareTitleDetail.typeValue).toHaveText(
        'Script-only package (macOS & Linux)',
      );
      await expect(softwareTitleDetail.headerPills).toHaveText(['Custom package']);
      await expect(softwareTitleDetail.installerCard.card).toContainText(FILE_NAME);
      await expect(softwareTitleDetail.installerCard.card).toContainText(
        'Added less than a minute ago',
      );

      // The defining property of a script-only package: the uploaded file *is*
      // the install script, and Fleet generates no uninstall counterpart.
      const pkg = await getSoftwarePackage(request, FLEET_ID, titleId);
      expect(pkg?.installScript).toBe(fs.readFileSync(FIXTURE, 'utf8'));
      expect(pkg?.uninstallScript).toBe('');

      await assertActivity(request, 'added_software', (d) => d.software_title === TITLE_NAME);

      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      await softwareLibrary.searchByName(TITLE_NAME);
      await expect(softwareLibrary.table.rowWith(TITLE_NAME)).toBeVisible();

      // Delete through the UI — the accordion row owns the affordance.
      await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
      await softwareTitleDetail.installerCard.delete();
      await assertActivity(request, 'deleted_software', (d) => d.software_title === TITLE_NAME);

      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      // Library's search input is disabled when the table is empty, so a query
      // isn't always possible post-delete. Library only lists installer-managed
      // titles, so a row-count assertion on the name is unambiguous.
      await expect(softwareLibrary.table.rowOrEmpty()).toBeVisible();
      await expect(softwareLibrary.table.rowWith(TITLE_NAME)).toHaveCount(0);
      titleId = 0;
    } finally {
      if (titleId) await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });
});
