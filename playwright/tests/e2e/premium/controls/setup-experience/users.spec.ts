/**
 * MDM Setup Experience — Users tab. Verifies the local-account + IdP
 * controls render, and that the end-user authentication settings and the
 * hidden-admin toggle round-trip a save: read back through the API and after
 * a reload. Runs once per scope (Unassigned + Workstations).
 *
 * End-user authentication carries "Lock end user info" with it. Ticking
 * "Require IdP authentication" ticks Lock in the form (`UsersForm.tsx`,
 * `onEndUserAuthChange`), and Lock only renders while IdP is on; unticking IdP
 * saves Lock off too, which is what lets end users edit their macOS Account
 * Name and Full Name again. The server enforces the same pairing: Lock without
 * IdP is refused, and an IdP change that doesn't name Lock sets Lock to match.
 *
 * The round trip ends with IdP off and the hidden admin back where it started.
 * IdP off is the resting state `resetMacosSetupToggles` restores in cleanup; a
 * test that dies with IdP on is put back by its `afterEach`. Turning IdP on
 * queues Fleet's ABM profile job for the scope, which is why the IdP, Lock and
 * hidden-admin saves share one test rather than racing each other on the same
 * fleet.
 *
 * "Preview end user experience" is a link to Fleet's guide, opened in a new
 * tab; its address and target are what's asserted, not the external page.
 */
import { test, expect } from '@fixtures';
import { getMacosSetupSettings, resetMacosSetupToggles } from '@helpers/api';
import { fleetIdFor } from '@helpers/team-scope';

const SCOPES = ['Unassigned', 'Workstations'] as const;

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Users (${scope})`, () => {
    // Set by the round-trip test once it saves, so only that test's own
    // leftover is undone here — the sibling test never saves.
    let savedEndUserAuth = false;

    test.afterEach(async ({ request, workstationsFleetId }) => {
      if (!savedEndUserAuth) return;
      savedEndUserAuth = false;
      await resetMacosSetupToggles(request, fleetIdFor(scope, workstationsFleetId));
    });

    test('renders + IdP, Lock end user info and hidden-admin settings round-trip', async ({
      dashboard,
      controls,
      setupExperience,
      setupExperienceUsers,
      workstationsFleetId,
      request,
      page,
    }) => {
      const fleetId = fleetIdFor(scope, workstationsFleetId);

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
      await expect(setupExperienceUsers.previewLink).toHaveAttribute(
        'href',
        'https://fleetdm.com/learn-more-about/setup-experience/end-user-authentication',
      );
      await expect(setupExperienceUsers.previewLink).toHaveAttribute('target', '_blank');

      const hiddenAdminStarted = await setupExperienceUsers.createHiddenAdminCheckbox.isChecked();

      // IdP on: the form ticks Lock with it, and both are stored.
      await setupExperienceUsers.requireIdpCheckbox.setChecked(true);
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeChecked();
      savedEndUserAuth = true;
      await setupExperienceUsers.save();
      expect(await getMacosSetupSettings(request, fleetId)).toMatchObject({
        endUserAuthentication: true,
        lockEndUserInfo: true,
      });

      await page.reload();
      await controls.teamDropdown.select(scope);
      await expect(setupExperienceUsers.requireIdpCheckbox).toBeChecked();
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeChecked();

      await setupExperienceUsers.createHiddenAdminCheckbox.click();
      await setupExperienceUsers.save();
      await expect(setupExperienceUsers.createHiddenAdminCheckbox).toBeChecked({ checked: !hiddenAdminStarted });
      expect((await getMacosSetupSettings(request, fleetId)).managedLocalAccount).toBe(!hiddenAdminStarted);

      // IdP off: Lock leaves the form, and is stored off with it — end users can
      // edit their Account Name and Full Name again.
      await setupExperienceUsers.requireIdpCheckbox.setChecked(false);
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeHidden();
      await setupExperienceUsers.createHiddenAdminCheckbox.click();
      await setupExperienceUsers.save();
      expect(await getMacosSetupSettings(request, fleetId)).toMatchObject({
        endUserAuthentication: false,
        lockEndUserInfo: false,
        managedLocalAccount: hiddenAdminStarted,
      });
      savedEndUserAuth = false;

      await page.reload();
      await controls.teamDropdown.select(scope);
      await expect(setupExperienceUsers.requireIdpCheckbox).not.toBeChecked();
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeHidden();
      await expect(setupExperienceUsers.createHiddenAdminCheckbox).toBeChecked({ checked: hiddenAdminStarted });
    });

    test('Lock end user info renders only when Require IdP is enabled', async ({
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

      // The managed-account "Lock end user info" toggle is gated client-side
      // on Require IdP. Drive the toggle WITHOUT saving: the show/hide
      // dependency is the behavior under test, and not saving keeps this
      // deterministic and leaves the scope's server config untouched.
      if (await setupExperienceUsers.requireIdpCheckbox.isChecked()) {
        await setupExperienceUsers.requireIdpCheckbox.click();
      }
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeHidden();

      await setupExperienceUsers.requireIdpCheckbox.click();
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeVisible();

      await setupExperienceUsers.requireIdpCheckbox.click();
      await expect(setupExperienceUsers.lockEndUserInfoCheckbox).toBeHidden();
    });
  });
}
