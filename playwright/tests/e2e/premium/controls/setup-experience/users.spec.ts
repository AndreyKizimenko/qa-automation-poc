/**
 * MDM Setup Experience — Users tab. Verifies the EUA + managed-local-account
 * controls render and that each toggle round-trips a save. Runs once per
 * scope (Unassigned + Workstations).
 */
import { test, expect } from '@fixtures';
import type { TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Users (${scope})`, () => {
    test('renders + EUA and managed local account toggles round-trip', async ({
      dashboard,
      controls,
      setupExperience,
      setupExperienceUsers,
    }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.teamDropdown.select(scope);
      await controls.goToSetupExperience();
      await setupExperience.goToUsers();

      await expect(setupExperienceUsers.heading).toBeVisible();
      await expect(setupExperienceUsers.eaCheckbox).toBeVisible();
      await expect(setupExperienceUsers.managedLocalCheckbox).toBeVisible();
      await expect(setupExperienceUsers.idpLink).toBeVisible();

      const eaStarted = await setupExperienceUsers.eaCheckbox.isChecked();
      const managedStarted = await setupExperienceUsers.managedLocalCheckbox.isChecked();

      await setupExperienceUsers.eaCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.eaCheckbox).toBeChecked({ checked: !eaStarted });

      await setupExperienceUsers.managedLocalCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.managedLocalCheckbox).toBeChecked({ checked: !managedStarted });

      await setupExperienceUsers.eaCheckbox.click();
      await setupExperienceUsers.managedLocalCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.eaCheckbox).toBeChecked({ checked: eaStarted });
      await expect(setupExperienceUsers.managedLocalCheckbox).toBeChecked({ checked: managedStarted });
    });
  });
}
