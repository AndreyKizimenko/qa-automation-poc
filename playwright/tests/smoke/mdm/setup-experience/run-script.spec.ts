/**
 * MDM Setup Experience — Run script. Singleton per fleet.
 *
 * Verifying the script actually runs on an enrolled ADE host requires a
 * physical Mac and is left to manual QA.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';

const SCRIPT_FILE = 'fleet-test-script.sh';
const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../test-data/apple/macos/scripts',
  SCRIPT_FILE,
);

test.describe('MDM • Setup Experience — Run script', () => {
  test('upload → list → delete (smoke fleet)', async ({
    dashboard,
    controls,
    setupExperience,
    runScript,
    mdmFleet,
  }) => {
    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
    await controls.goToSetupExperience();
    await setupExperience.goToRunScript();

    await expect(runScript.heading).toBeVisible();

    if (await runScript.listItem.isVisible().catch(() => false)) {
      await runScript.delete();
    }
    await expect(runScript.emptyUploadButton).toBeVisible();

    await runScript.upload(SCRIPT_PATH);
    await expect(runScript.listItemName).toContainText(SCRIPT_FILE);

    await runScript.delete();
  });
});
