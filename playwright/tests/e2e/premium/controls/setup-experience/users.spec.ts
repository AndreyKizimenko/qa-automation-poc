/**
 * MDM Setup Experience — Users tab. Verifies the local-account + IdP
 * controls render and that the two toggles ("Require IdP authentication"
 * and "Create hidden admin") each round-trip a save. Runs once per scope
 * (Unassigned + Workstations).
 */
import { test, expect } from '@fixtures';
import type { TeamScope } from '@pages';

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Users (${scope})`, () => {
    test('renders + IdP and hidden-admin toggles round-trip', async ({
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
      // Local-account type radios are styled custom controls over hidden native
      // <input type=radio>, so assert they're present (not visible). The IdP +
      // managed toggles render as visible ARIA checkboxes.
      await expect(setupExperienceUsers.localAccountAdminRadio).toBeAttached();
      await expect(setupExperienceUsers.localAccountStandardRadio).toBeAttached();
      await expect(setupExperienceUsers.localAccountSkipRadio).toBeAttached();
      await expect(setupExperienceUsers.createHiddenAdminCheckbox).toBeVisible();
      await expect(setupExperienceUsers.requireIdpCheckbox).toBeVisible();
      await expect(setupExperienceUsers.idpLink).toBeVisible();

      const idpStarted = await setupExperienceUsers.requireIdpCheckbox.isChecked();
      const hiddenAdminStarted = await setupExperienceUsers.createHiddenAdminCheckbox.isChecked();

      await setupExperienceUsers.requireIdpCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.requireIdpCheckbox).toBeChecked({ checked: !idpStarted });

      await setupExperienceUsers.createHiddenAdminCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.createHiddenAdminCheckbox).toBeChecked({ checked: !hiddenAdminStarted });

      await setupExperienceUsers.requireIdpCheckbox.click();
      await setupExperienceUsers.createHiddenAdminCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.requireIdpCheckbox).toBeChecked({ checked: idpStarted });
      await expect(setupExperienceUsers.createHiddenAdminCheckbox).toBeChecked({ checked: hiddenAdminStarted });
    });
  });
}
