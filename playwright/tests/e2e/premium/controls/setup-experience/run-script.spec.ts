/**
 * MDM Setup Experience — Run script. Singleton per fleet.
 *
 * Verifying the script actually runs on an enrolled ADE host requires a
 * physical Mac and is left to manual QA. Runs once per scope (Unassigned +
 * Workstations).
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import type { TeamScope } from '@pages';

const SCRIPT_FILE = 'fleet-test-script.sh';
const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../../test-data/apple/macos/scripts',
  SCRIPT_FILE,
);

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Run script (${scope})`, () => {
    test('upload → list → delete', async ({
      dashboard,
      controls,
      setupExperience,
      runScript,
    }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.teamDropdown.select(scope);
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
}
