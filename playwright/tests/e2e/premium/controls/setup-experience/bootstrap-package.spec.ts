/**
 * MDM Setup Experience — Bootstrap package lifecycle, and its "Install Fleet's
 * agent (fleetd) manually" advanced option.
 *
 * Verifying actual delivery onto an enrolled ADE host requires a physical
 * Mac and is left to manual QA. The lifecycle runs once per scope (Unassigned +
 * Workstations).
 *
 * **Install fleetd manually** tells Fleet the bootstrap package installs a
 * custom fleetd, so Fleet installs none, and its own setup software and setup
 * script go with it. Fleet enables the option only on a fleet with a package
 * and no macOS setup software or setup script, and while it's on, refuses both
 * and disables their cards (`BootstrapAdvancedOptions.tsx`,
 * `InstallSoftwareForm.tsx`, `SetupExperienceScriptUploader.tsx`; server checks
 * in `ee/server/service/teams.go` and `setup_experience.go`). That test runs on a
 * throwaway `pw-*` fleet: on Workstations or Unassigned it would disable the
 * install-software and run-script specs running beside it. Its `afterEach`
 * deletes the fleet, and `deleteFleet` deletes the fleet's bootstrap package
 * first, which a fleet delete leaves behind. The macOS package that makes the
 * Install software rows render is deleted with the fleet.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import {
  createFleet,
  deleteBootstrapPackage,
  deleteFleet,
  findFleetByName,
  getBootstrapMetadata,
  getMacosSetupSettings,
  patchSetupExperience,
  setSetupExperienceSoftware,
  uploadBootstrapPackage,
  uploadSoftwarePackage,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';
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

// Any macOS package will do: it only has to give Install software a row.
const MACOS_PKG_PATH = path.resolve(
  __dirname,
  '../../../../../test-data/apple/macos/software/fleet-playwright-install-1.0.0.pkg',
);

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

test.describe('MDM • Bootstrap package — install fleetd manually (throwaway fleet)', () => {
  const fleetName = `pw-manual-agent-${runNonce()}`;

  test.afterEach(async ({ request }) => {
    const fleet = await findFleetByName(request, fleetName);
    if (fleet) await deleteFleet(request, fleet.id, { ignoreMissing: true });
  });

  test('needs a package; while on, macOS setup software and the setup script are disabled and refused', async ({
    controls,
    setupExperience,
    bootstrapPackage,
    installSoftware,
    runScript,
    request,
    page,
  }) => {
    test.setTimeout(90_000);
    const fleet = await createFleet(request, fleetName);

    // Scoped by URL: the fleet's name is per-run, so it isn't picked from the
    // dropdown (see `TeamDropdown.selectByLabel`). The subnav keeps the fleet.
    await bootstrapPackage.goto({ fleetId: fleet.id });
    await expect(controls.teamDropdown.currentValue).toHaveText(fleet.name);

    // Without a package the option is disabled, and Fleet refuses it.
    await bootstrapPackage.openAdvancedOptions();
    await expect(bootstrapPackage.manualAgentInstallCheckbox).toBeDisabled();
    const noPackage = await patchSetupExperience(request, fleet.id, { macos_manual_agent_install: true });
    expect(noPackage.status()).toBe(422);
    expect(await noPackage.text()).toContain('first specify a macos_bootstrap_package');

    await uploadBootstrapPackage(request, fleet.id, PKG_PATH);
    await page.reload();
    await expect(bootstrapPackage.listItemName).toHaveText(PKG_FILE);
    await bootstrapPackage.openAdvancedOptions();
    await bootstrapPackage.manualAgentInstallCheckbox.setChecked(true);
    await bootstrapPackage.saveAdvancedOptions();
    expect((await getMacosSetupSettings(request, fleet.id)).manualAgentInstall).toBe(true);

    // Install software lists the fleet's macOS package, but nothing on the macOS
    // tab can be selected or saved — and Fleet refuses the selection outright.
    const pkg = await uploadSoftwarePackage(request, fleet.id, MACOS_PKG_PATH);
    await setupExperience.goToInstallSoftware();
    await installSoftware.switchPlatform('macos');
    await installSoftware.expectListed(pkg.name);
    await expect(installSoftware.rowCheckbox(pkg.name)).toBeDisabled();
    await expect(installSoftware.cancelSetupIfSoftwareFailsCheckbox).toBeDisabled();
    await expect(installSoftware.saveButton).toBeDisabled();
    const selected = await setSetupExperienceSoftware(request, fleet.id, 'macos', [pkg.titleId]);
    expect(selected.status()).toBe(422);
    expect(await selected.text()).toContain('first disable macos_manual_agent_install');

    await setupExperience.goToRunScript();
    await expect(runScript.emptyUploadButton).toBeDisabled();

    // Off again, the package can be selected for setup.
    await setupExperience.goToBootstrapPackage();
    await bootstrapPackage.openAdvancedOptions();
    await bootstrapPackage.manualAgentInstallCheckbox.setChecked(false);
    await bootstrapPackage.saveAdvancedOptions();
    expect((await getMacosSetupSettings(request, fleet.id)).manualAgentInstall).toBe(false);
    await setupExperience.goToInstallSoftware();
    await installSoftware.switchPlatform('macos');
    await expect(installSoftware.rowCheckbox(pkg.name)).toBeEnabled();
    await expect(installSoftware.saveButton).toBeEnabled();

    await deleteFleet(request, fleet.id);
  });
});
