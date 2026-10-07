/**
 * Premium • Software • Large installers.
 *
 * Two behaviours of the Add software → Custom package form at the size end:
 *
 *   - **Over the limit, the browser refuses before anything is sent.** The form
 *     compares the chosen file against the server's `max_software_package_size`
 *     on selection (`PackageForm.onFileSelect`) and raises "Couldn't add. The
 *     maximum file size is …" — no request is made. The limit is configured per
 *     instance (premium QA's is 10 GiB), so the spec
 *     reads it from the config instead of trusting a number.
 *   - **A large upload shows its progress and finishes.** The upload modal's
 *     progress bar climbs while the file is sent, and the upload ends in the
 *     success toast rather than a timeout.
 *
 * **Test data is generated, never committed.** The over-limit file is sparse:
 * `ftruncate` to one byte past the limit takes no disk and no time, and because
 * the browser rejects it on selection, not one byte of it is ever read. The
 * progress case uploads a real, valid package — ~100 MB of incompressible
 * payload in a `.deb` stored uncompressed — so Fleet accepts it and the test sees
 * the whole path end in success. 100 MB is deliberately modest: premium QA is a
 * 2 GB Render box, and a larger upload is a load test, not a UI test.
 *
 * Uploaded to Workstations, which `cleanup.steps.ts` wipes, and deleted in the
 * test anyway.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import { test, expect } from '@fixtures';
import { buildDeb } from '@helpers/deb';
import { deleteSoftwareTitle, getAppConfig } from '@helpers/api';

/**
 * Fleet's own size formatting (`formatFileSize`): four significant digits in
 * both decimal and binary units, whichever reads shorter.
 */
function formatFileSize(bytes: number): string {
  const format = (base: number, units: string[]) => {
    let size = bytes;
    let i = 0;
    while (size >= base && i < units.length - 1) {
      size /= base;
      i += 1;
    }
    return `${Number(size.toPrecision(4))}${units[i]}`;
  };
  const decimal = format(1000, ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']);
  const binary = format(1024, ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']);
  return binary.length < decimal.length ? binary : decimal;
}

test.describe('Premium • Software • Large installers', () => {
  test('a package over the size limit is refused in the browser, before any upload', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    request,
    page,
  }, testInfo) => {
    const limit = (await getAppConfig(request)).max_software_package_size as number;
    expect(limit, 'the config reports no max_software_package_size').toBeGreaterThan(0);

    const file = testInfo.outputPath('fleet-pw-over-limit.pkg');
    const fd = fs.openSync(file, 'w');
    try {
      fs.ftruncateSync(fd, limit + 1);
    } finally {
      fs.closeSync(fd);
    }

    try {
      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      await softwareTitles.teamDropdown.select('Workstations');
      await softwareTitles.clickAddSoftware();
      await softwareCustomPackage.openTab();

      await softwareCustomPackage.uploader.setFile(file);
      await softwareCustomPackage.toast.expectError(
        `Couldn't add. The maximum file size is ${formatFileSize(limit)}.`,
      );
      // Refused on selection: the form never took the file — it still offers
      // "Choose file" and never names this one — so there is nothing to submit.
      await expect(softwareCustomPackage.uploader.chooseFileButton).toBeVisible();
      await expect(page.getByText('fleet-pw-over-limit.pkg', { exact: true })).toHaveCount(0);
      await expect(softwareCustomPackage.addSoftwareButton).toBeDisabled();
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  test('a large upload shows its progress and ends in success', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    workstationsFleetId,
    request,
  }, testInfo) => {
    // ~100 MB up to the instance and back through Fleet's package parsing.
    test.setTimeout(300_000);

    const name = `fleet-pw-large-${Date.now().toString(36)}`;
    const file = testInfo.outputPath(`${name}_1.0.0_all.deb`);
    fs.writeFileSync(
      file,
      buildDeb({
        name,
        version: '1.0.0',
        arch: 'all',
        // Random bytes don't compress, and storing them uncompressed keeps the
        // package the full ~100 MB on the wire.
        files: [{ path: `/usr/share/${name}/payload.bin`, content: crypto.randomBytes(100 * 1024 * 1024) }],
        compressionLevel: 0,
      }),
    );

    let titleId: number | undefined;
    try {
      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      await softwareTitles.teamDropdown.select('Workstations');
      await softwareTitles.clickAddSoftware();
      await softwareCustomPackage.openTab();

      await softwareCustomPackage.uploader.setFile(file);
      await softwareCustomPackage.addSoftwareButton.click();

      // The bar and its percentage are shown while the file is sent, and they
      // move: a later reading is higher than the first one. The readout leaves
      // with the modal once the upload is done, which reads as 100% — so a fast
      // upload that finishes between two readings still counts as progress.
      // At 0% Fleet renders no readout at all, which reads as 0.
      const modal = softwareCustomPackage.progressModal;
      await expect(modal).toBeVisible();
      await expect(modal.getByTitle('upload progress bar')).toBeVisible();
      const readout = softwareCustomPackage.progressPercent;
      const percent = async (): Promise<number> =>
        readout
          .innerText({ timeout: 1_000 })
          .then((text) => Number(text.replace('%', '')))
          .catch(async () => ((await modal.isVisible()) ? 0 : 100));
      const first = await percent();
      await expect
        .poll(percent, { message: 'upload progress never advanced', timeout: 120_000 })
        .toBeGreaterThan(Math.min(first, 99));

      await expect(modal).toBeHidden({ timeout: 240_000 });
      await softwareCustomPackage.toast.expectSuccess(`${name}_1.0.0_all.deb successfully added.`);
      await softwareCustomPackage.page.waitForURL(/\/software\/titles\/\d+/);
      titleId = Number(new URL(softwareCustomPackage.page.url()).pathname.split('/').pop());
    } finally {
      fs.rmSync(file, { force: true });
      if (titleId) await deleteSoftwareTitle(request, workstationsFleetId, titleId);
    }
  });
});
