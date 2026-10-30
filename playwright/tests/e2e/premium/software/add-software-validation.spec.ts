/**
 * Premium • Software • Add software validation. Negative paths on the Custom
 * package tab: a file Fleet cannot build default scripts for is refused in the
 * browser, before any upload starts, and the form stays exactly where it was.
 * Nothing is created, so nothing needs cleaning up — which is why these live
 * here and not inside the add/delete lifecycle in `library.spec.ts`.
 *
 * Fleet refuses the file client-side, in PackageForm's `onFileSelect`: it looks
 * up a default install script, then a default uninstall script, by extension,
 * and either lookup throws for an extension it has no recipe for. Both make the
 * uploader show "File type isn't supported" in place of its title, with no
 * toast. The cases cover both lookups: `.png` and `.dmg` stop at the install
 * script, while `.zip` gets an empty install script and stops at the uninstall
 * one. The file is never staged, so the uploader still offers "Choose file" and
 * "Add software" stays disabled. All three are asserted: the error says why,
 * the other two show the form has nothing to submit.
 *
 * The input carries an `accept` list, but `setInputFiles` hands it a file that
 * list would hide, as a picker set to "All files" does (and as Chrome's does for
 * a bare `.gz`, which it files under `application/gzip`). That picked-file path
 * is the one PackageForm's check exists for: a *dropped* file meets the
 * uploader's own `accept` check first, which shows the same words.
 *
 * Not repeated here: "Add software is disabled under All fleets, with a
 * tooltip" — `library.spec.ts` already owns that gate (its "Software —
 * add-software gating" describe).
 *
 * Grounded in frontend/pages/SoftwarePage/components/forms/PackageForm
 * (ACCEPTED_EXTENSIONS, UNSUPPORTED_FILE_TYPE_ERROR) and its unit tests, and
 * frontend/utilities/software_{install,uninstall}_scripts.ts.
 */
import { test, expect } from '@fixtures';

const FILE_TYPE_NOT_SUPPORTED = "File type isn't supported";

const REJECTED: { name: string; mimeType: string }[] = [
  // An image picked by mistake: no install script.
  { name: 'pw-not-an-installer.png', mimeType: 'image/png' },
  // A disk image, the way most macOS apps ship, which Fleet doesn't take as a
  // package: no install script.
  { name: 'pw-not-an-installer.dmg', mimeType: 'application/octet-stream' },
  // An archive: an empty install script, but no uninstall script.
  { name: 'pw-not-an-installer.zip', mimeType: 'application/zip' },
];

// Unassigned: the add form needs a fleet scope, and this one needs no id
// resolved. Nothing is uploaded, so the scope holds no state either way.
const FLEET_ID = 0;

test.describe('Premium • Software • Add software validation', () => {
  for (const file of REJECTED) {
    const extension = file.name.split('.').pop();

    test(`a .${extension} is refused before anything is uploaded`, async ({
      softwareCustomPackage,
    }) => {
      await softwareCustomPackage.goto({ fleetId: FLEET_ID });
      await expect(softwareCustomPackage.addSoftwareButton).toBeDisabled();

      await softwareCustomPackage.uploader.setFile({
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from('not a real installer'),
      });

      await softwareCustomPackage.uploader.expectInlineError(FILE_TYPE_NOT_SUPPORTED);
      await expect(softwareCustomPackage.uploader.chooseFileButton).toBeVisible();
      await expect(softwareCustomPackage.addSoftwareButton).toBeDisabled();
    });
  }
});
