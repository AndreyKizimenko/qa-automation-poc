/**
 * MDM Setup Experience — Setup Assistant. Singleton automatic-enrollment
 * profile per fleet: Fleet always renders a profile card — a
 * download-only `Default profile` card on a cold fleet, and the
 * admin-uploaded card after `upload()`. The lifecycle:
 *   1. arrive → Default profile card is showing
 *   2. upload custom profile → custom card replaces default
 *   3. download custom profile (FileSaver, .json)
 *   4. delete custom profile → Default profile card returns
 * Runs once per scope (Unassigned + Workstations).
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import type { TeamScope } from '@pages';

const FIXTURE = path.resolve(
  __dirname,
  '../../../../../test-data/apple/macos/setup-assistant/automatic-enrollment.dep.json',
);

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Setup Assistant (${scope})`, () => {
    test('default profile → upload replaces it → delete restores it', async ({
      dashboard,
      controls,
      setupExperience,
      setupAssistant,
    }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.teamDropdown.select(scope);
      await controls.goToSetupExperience();
      await setupExperience.goToSetupAssistant();

      // A prior failed run may have left a custom profile behind; reset
      // to the cold-start default-profile state before asserting.
      await setupAssistant.deleteIfCustomPresent();
      await expect(setupAssistant.defaultCard).toBeVisible();
      await expect(setupAssistant.profileName).toHaveText('Default profile');

      await setupAssistant.upload(FIXTURE);
      await expect(setupAssistant.profileName).not.toHaveText('Default profile');

      const dl = await setupAssistant.download();
      expect(dl.suggestedFilename()).toMatch(/\.json$/);

      await setupAssistant.delete();
      await expect(setupAssistant.profileName).toHaveText('Default profile');
    });
  });
}
