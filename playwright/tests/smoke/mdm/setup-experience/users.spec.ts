/**
 * MDM Setup Experience — Users tab. Verifies the EUA + managed-local-account
 * controls render and that each toggle round-trips a save.
 */
import { test, expect } from '@fixtures';

test.describe('MDM • Setup Experience — Users', () => {
  test('renders + EUA and managed local account toggles round-trip', async ({
    dashboard,
    controls,
    setupExperience,
    setupExperienceUsers,
    mdmFleet,
  }) => {
    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
    await controls.goToSetupExperience();
    await setupExperience.goToUsers();

    await expect(setupExperienceUsers.heading).toBeVisible();
    await expect(setupExperienceUsers.eaCheckbox).toBeVisible();
    await expect(setupExperienceUsers.managedLocalCheckbox).toBeVisible();
    await expect(setupExperienceUsers.idpLink).toBeVisible();

    // Capture starting state so each toggle can be restored at the end and the
    // fleet is left how we found it.
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
