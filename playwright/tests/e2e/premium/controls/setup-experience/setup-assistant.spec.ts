/**
 * MDM Setup Experience — Setup Assistant. Singleton automatic-enrollment
 * profile per fleet: upload, download, delete. Runs once per scope
 * (Unassigned + Workstations).
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
    test('upload → download → delete', async ({
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

      await setupAssistant.deleteIfPresent();

      await setupAssistant.upload(FIXTURE);
      await expect(setupAssistant.profileName).toBeVisible();

      const dl = await setupAssistant.download();
      expect(dl.suggestedFilename()).toMatch(/\.json$/);

      await setupAssistant.delete();
    });
  });
}
