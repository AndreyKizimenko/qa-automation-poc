/**
 * MDM Setup Experience — Bootstrap package lifecycle.
 *
 * Verifying actual delivery onto an enrolled ADE host requires a physical
 * Mac and is left to manual QA.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { deleteBootstrapPackage, getBootstrapMetadata } from '@helpers/api';

const PKG_FILE = 'dummy-bootstrap-package.pkg';
const PKG_PATH = path.resolve(
  __dirname,
  '../../../../test-data/apple/macos/bootstrap-package',
  PKG_FILE,
);

// Fleet returns the digest base64-encoded; encode the local hash the same way.
const PKG_SHA256_B64 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(PKG_PATH))
  .digest('base64');

test.describe('MDM • Bootstrap package', () => {
  test('upload → list → download → delete (smoke fleet)', async ({
    dashboard,
    controls,
    setupExperience,
    bootstrapPackage,
    mdmFleet,
    request,
  }) => {
    await deleteBootstrapPackage(request, mdmFleet.id);

    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
    await controls.goToSetupExperience();
    await setupExperience.goToBootstrapPackage();

    await expect(bootstrapPackage.heading).toBeVisible();
    await expect(bootstrapPackage.emptyUploader).toBeVisible();

    await bootstrapPackage.upload(PKG_PATH);
    await expect(bootstrapPackage.listItemName).toHaveText(PKG_FILE);

    // Cross-check Fleet stored the bytes we uploaded.
    const metadata = await getBootstrapMetadata(request, mdmFleet.id);
    expect(metadata).not.toBeNull();
    expect(metadata!.name).toBe(PKG_FILE);
    expect(metadata!.sha256).toBe(PKG_SHA256_B64);

    const dl = await bootstrapPackage.download();
    expect(dl.suggestedFilename()).toMatch(/\.pkg$/);

    await bootstrapPackage.delete();

    expect(await getBootstrapMetadata(request, mdmFleet.id)).toBeNull();
  });
});
