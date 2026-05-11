/**
 * MDM Setup Experience — Bootstrap package lifecycle.
 *
 * Verifying actual delivery onto an enrolled ADE host requires a physical
 * Mac and is left to manual QA. Runs once per scope (Unassigned + Workstations).
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { deleteBootstrapPackage, getBootstrapMetadata } from '@helpers/api';
import type { TeamScope } from '@pages';

const PKG_FILE = 'dummy-bootstrap-package.pkg';
const PKG_PATH = path.resolve(
  __dirname,
  '../../../../../test-data/apple/macos/bootstrap-package',
  PKG_FILE,
);

const PKG_SHA256_B64 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(PKG_PATH))
  .digest('base64');

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Bootstrap package (${scope})`, () => {
    test('upload → list → download → delete', async ({
      dashboard,
      controls,
      setupExperience,
      bootstrapPackage,
      workstationsFleetId,
      request,
    }) => {
      const fleetId = scope === 'Unassigned' ? 0 : workstationsFleetId;
      await deleteBootstrapPackage(request, fleetId);

      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.teamDropdown.select(scope);
      await controls.goToSetupExperience();
      await setupExperience.goToBootstrapPackage();

      await expect(bootstrapPackage.heading).toBeVisible();
      await expect(bootstrapPackage.emptyUploader).toBeVisible();

      await bootstrapPackage.upload(PKG_PATH);
      await expect(bootstrapPackage.listItemName).toHaveText(PKG_FILE);

      const metadata = await getBootstrapMetadata(request, fleetId);
      expect(metadata).not.toBeNull();
      expect(metadata!.name).toBe(PKG_FILE);
      expect(metadata!.sha256).toBe(PKG_SHA256_B64);

      const dl = await bootstrapPackage.download();
      expect(dl.suggestedFilename()).toMatch(/\.pkg$/);

      await bootstrapPackage.delete();

      expect(await getBootstrapMetadata(request, fleetId)).toBeNull();
    });
  });
}
