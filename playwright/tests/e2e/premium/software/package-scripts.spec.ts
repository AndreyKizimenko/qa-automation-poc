/**
 * Premium • Software • Package scripts and installer download (Unassigned).
 *
 * Three promises Fleet makes about a custom package, each of which a user only
 * ever checks by looking:
 *
 *   1. **The installer it serves is the one that was uploaded.** The Library
 *      accordion's Download mints a one-shot token and streams the file back.
 *      Asserted by hashing the downloaded bytes and comparing against the
 *      fixture on disk *and* against the `hash_sha256` Fleet recorded at upload
 *      — so a mismatch says whether the wrong file was served or the wrong hash
 *      was stored.
 *   2. **Advanced options shows the scripts Fleet will actually run.** The
 *      package is added with a pre-install query and a post-install script
 *      typed into the add form's Advanced options (Fleet generates the install
 *      and uninstall scripts), both stored as typed, and the Edit modal's four
 *      editors are compared field by field against the stored package, rather
 *      than a screenshot of them. Ace drops blank lines from its text layer, so both sides go through
 *      `normalizeScript` before comparison.
 *   3. **Edited scripts are the ones stored.** All four editors rewritten in
 *      the Edit modal and saved through "Save changes?", then read back through
 *      the API (a reopened modal can show stale config). On a per-run
 *      `fleet-pw-*` package uploaded through the API: a save that edits an
 *      installer cancels its pending installs, and nothing else may share the
 *      title under `fullyParallel`.
 *
 * Premium-only — every Add-software path is paywalled on free.
 *
 * Fixture: `fleet-playwright-pkg_1.0.0_amd64.deb`, an inert generated package
 * (see `test-data/linux/software/README.md`). A `.deb` is chosen because Fleet
 * generates both an install and an uninstall script for it and both are short
 * enough to render whole — Ace virtualises long documents, so a big installer's
 * script would only be partly in the DOM. The package name is unique across the
 * suite, which is what keeps a parallel worker from adding a second package to
 * the same title and making the accordion row ambiguous.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { deleteSoftwareTitle, getSoftwarePackage, uploadSoftwarePackageBuffer } from '@helpers/api';
import { inertDeb } from '@helpers/deb';
import { runNonce } from '@helpers/profiles';
import { normalizeScript } from '@pages';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;

const FIXTURE = path.resolve(
  __dirname,
  '../../../../test-data/linux/software/fleet-playwright-pkg_1.0.0_amd64.deb',
);
const FILE_NAME = 'fleet-playwright-pkg_1.0.0_amd64.deb';
const TITLE_NAME = 'fleet-playwright-pkg';

// Typed into the add form. `SELECT 1;` returns a row, so on a host the install
// would go ahead; this package is never installed anywhere.
const ADD_PRE_INSTALL_QUERY = 'SELECT 1;';
const ADD_POST_INSTALL_SCRIPT = '#!/bin/sh\necho "pw: post-install ran"\n';

const sha256 = (buffer: Buffer): string =>
  crypto.createHash('sha256').update(buffer).digest('hex');

test.describe('Premium • Software • Package scripts', () => {
  test('the installer downloads byte-identical and Advanced options shows its stored scripts', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    softwareTitleDetail,
    request,
  }) => {
    // Upload, a download round-trip and four editor reads; 90s caps the whole
    // flow with headroom under worker load.
    test.setTimeout(90_000);

    let titleId = 0;
    try {
      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.clickAddSoftware();
      await softwareCustomPackage.openTab();
      titleId = await softwareCustomPackage.uploadPackage(FIXTURE, {
        preInstallQuery: ADD_PRE_INSTALL_QUERY,
        postInstallScript: ADD_POST_INSTALL_SCRIPT,
      });

      await expect(softwareTitleDetail.displayHeading).toHaveText(TITLE_NAME);
      const pkg = await getSoftwarePackage(request, FLEET_ID, titleId);
      expect(pkg).not.toBeNull();
      // What the add form's Advanced options held is what Fleet stored.
      expect(pkg?.preInstallQuery).toBe(ADD_PRE_INSTALL_QUERY);
      expect(normalizeScript(pkg?.postInstallScript ?? '')).toBe(normalizeScript(ADD_POST_INSTALL_SCRIPT));

      const download = await softwareTitleDetail.installerCard.download();
      expect(download.suggestedFilename).toBe(FILE_NAME);
      const downloaded = sha256(fs.readFileSync(download.path));
      expect(downloaded).toBe(sha256(fs.readFileSync(FIXTURE)));
      expect(downloaded).toBe(pkg?.hashSha256);

      await softwareTitleDetail.installerCard.editSoftwareButton.click();
      const modal = softwareTitleDetail.editSoftwareModal;
      await modal.expectOpen();
      await modal.openAdvancedOptions();

      expect(await modal.scriptText(modal.installScriptEditor)).toBe(
        normalizeScript(pkg?.installScript ?? ''),
      );
      expect(await modal.scriptText(modal.uninstallScriptEditor)).toBe(
        normalizeScript(pkg?.uninstallScript ?? ''),
      );
      expect(await modal.scriptText(modal.preInstallQueryEditor)).toBe(
        normalizeScript(pkg?.preInstallQuery ?? ''),
      );
      expect(await modal.scriptText(modal.postInstallScriptEditor)).toBe(
        normalizeScript(pkg?.postInstallScript ?? ''),
      );

      // A generated .deb install script drives apt against $INSTALLER_PATH and
      // the uninstall script purges the package by the name read off the
      // control file. Pinning those keeps the comparison above from passing on
      // two matching empty strings if Fleet ever stops generating scripts; the
      // other two hold what the add form was given.
      expect(await modal.scriptText(modal.installScriptEditor)).toContain('$INSTALLER_PATH');
      expect(await modal.scriptText(modal.uninstallScriptEditor)).toContain(TITLE_NAME);

      await modal.cancelButton.click();
      await expect(modal.modal).toBeHidden();

      await softwareTitleDetail.installerCard.delete();
      titleId = 0;
    } finally {
      if (titleId) await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });

  test('editing all four Advanced options saves each of them', async ({ softwareTitleDetail, request }) => {
    const packageName = `fleet-pw-pkg-scripts-${runNonce()}`;
    const edited = {
      preInstallQuery: "SELECT 1 FROM os_version WHERE platform = 'ubuntu';",
      installScript: `#!/bin/sh\n# pw: edited install\napt-get install --assume-yes -f "$INSTALLER_PATH"\n`,
      postInstallScript: '#!/bin/sh\necho "pw: edited post-install"\n',
      uninstallScript: `#!/bin/sh\n# pw: edited uninstall\ndpkg --purge ${packageName}\n`,
    };
    const { titleId } = await uploadSoftwarePackageBuffer(
      request,
      FLEET_ID,
      `${packageName}_1.0.0_all.deb`,
      inertDeb(packageName, '1.0.0'),
    );

    try {
      await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
      // The row's own "Edit software" action, as the test above uses; it renders once the row is open.
      await softwareTitleDetail.installerCard.expand();
      await softwareTitleDetail.installerCard.editSoftwareButton.click();
      const modal = softwareTitleDetail.editSoftwareModal;
      await modal.expectOpen();
      await modal.openAdvancedOptions();

      await modal.setScript(modal.preInstallQueryEditor, edited.preInstallQuery);
      await modal.setScript(modal.installScriptEditor, edited.installScript);
      await modal.setScript(modal.postInstallScriptEditor, edited.postInstallScript);
      await modal.setScript(modal.uninstallScriptEditor, edited.uninstallScript);
      await modal.save();
      await softwareTitleDetail.toast.expectSuccess(/Successfully edited/);

      const pkg = await getSoftwarePackage(request, FLEET_ID, titleId);
      expect(pkg?.preInstallQuery).toBe(edited.preInstallQuery);
      expect(normalizeScript(pkg?.installScript ?? '')).toBe(normalizeScript(edited.installScript));
      expect(normalizeScript(pkg?.postInstallScript ?? '')).toBe(normalizeScript(edited.postInstallScript));
      expect(normalizeScript(pkg?.uninstallScript ?? '')).toBe(normalizeScript(edited.uninstallScript));
    } finally {
      await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });
});
