/**
 * MDM Setup Experience — Setup Assistant. Singleton automatic-enrollment
 * profile per fleet: upload, download, delete.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';

const FIXTURE = path.resolve(
  __dirname,
  '../../../../test-data/apple/macos/setup-assistant/automatic-enrollment.dep.json',
);

test.describe('MDM • Setup Experience — Setup Assistant', () => {
  test('upload → download → delete (smoke fleet)', async ({
    dashboard,
    controls,
    setupExperience,
    setupAssistant,
    mdmFleet,
  }) => {
    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
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
