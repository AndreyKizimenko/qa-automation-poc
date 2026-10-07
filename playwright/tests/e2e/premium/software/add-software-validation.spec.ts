/**
 * Premium • Software • Add software validation. Negative paths on the Custom
 * package tab: a file Fleet cannot build an install script for is refused in
 * the browser, before any upload starts, and the form stays exactly where it
 * was. Nothing is created, so nothing needs cleaning up — which is why these
 * live here and not inside the add/delete lifecycle in `library.spec.ts`.
 *
 * Fleet refuses the file client-side, in PackageForm's `onFileSelect`:
 * `getDefaultInstallScript` throws on an extension it has no recipe for, and
 * the form raises "Couldn't add." with the reason in the toast's raw-response
 * panel. The file is never staged, so "Add software" stays disabled and the
 * uploader still offers "Choose file" — all three are asserted, because the
 * toast alone would also appear for a server-side rejection that *did* upload.
 *
 * The input carries an `accept` list, but `setInputFiles` bypasses it exactly
 * as a drag-and-drop or a "All files" picker would, which is the path this
 * validation exists to catch.
 *
 * Not repeated here: "Add software is disabled under All fleets, with a
 * tooltip" — `library.spec.ts` already owns that gate (its "Software —
 * add-software gating" describe).
 *
 * Grounded in frontend/pages/SoftwarePage/components/forms/PackageForm
 * (ACCEPTED_EXTENSIONS, ADD_SOFTWARE_ERROR_PREFIX) and its unit tests.
 */
import { test, expect } from '@fixtures';

interface RejectedFile {
  name: string;
  mimeType: string;
  /** The reason Fleet reports in the toast's raw-response panel. */
  reason: string;
}

const REJECTED: RejectedFile[] = [
  // An image picked by mistake.
  { name: 'pw-not-an-installer.png', mimeType: 'image/png', reason: 'unsupported file extension: png' },
  // A plausible-looking macOS installer Fleet deliberately does not accept —
  // it trips the *uninstall*-script branch of the same validation.
  { name: 'pw-not-an-installer.dmg', mimeType: 'application/octet-stream', reason: 'unsupported file extension: dmg' },
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

      await softwareCustomPackage.uploader.expectRejected(file.reason);
      await expect(softwareCustomPackage.uploader.chooseFileButton).toBeVisible();
      await expect(softwareCustomPackage.addSoftwareButton).toBeDisabled();
    });
  }
});
