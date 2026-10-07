/**
 * MDM Setup Experience — Setup Assistant. Singleton automatic-enrollment
 * profile per fleet: Fleet always renders a profile card — a
 * download-only `Default profile` card on a cold fleet, and the
 * admin-uploaded card after `upload()`. The lifecycle:
 *   1. arrive → Default profile card is showing
 *   2. upload custom profile → custom card replaces default
 *   3. download custom profile (FileSaver, .json)
 *   4. delete custom profile → Default profile card returns
 *   5. upload a profile Apple refuses → nothing is stored
 * Runs once per scope (Unassigned + Workstations).
 *
 * Fleet validates a new profile by sending it to Apple's DefineProfile API
 * through one of its ABM tokens (any token, for a fleet no token names) before
 * storing it, so step 5 reaches Apple. A profile with an empty `profile_name` is
 * refused as CONFIG_NAME_REQUIRED; Fleet relays Apple's code in the toast with
 * a "Learn more" link to its own guide, and the default card stays.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import type { TeamScope } from '@pages';

const FIXTURE = path.resolve(
  __dirname,
  '../../../../../test-data/apple/macos/setup-assistant/automatic-enrollment.dep.json',
);

// The valid fixture with its name blanked — the one change Apple refuses.
const UNNAMED_PROFILE = {
  name: 'pw-unnamed.dep.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ ...JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), profile_name: '' })),
};

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Setup Assistant (${scope})`, () => {
    test('default profile → upload replaces it → delete restores it → Apple refuses an unnamed one', async ({
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

      await setupAssistant.uploadExpectingRefusal(UNNAMED_PROFILE);
      await setupAssistant.toast.expectError("Couldn't add. CONFIG_NAME_REQUIRED.");
      await expect(setupAssistant.refusalLearnMoreLink).toHaveAttribute(
        'href',
        'https://fleetdm.com/learn-more-about/dep-profile',
      );
      await expect(setupAssistant.refusalLearnMoreLink).toHaveAttribute('target', '_blank');
      await expect(setupAssistant.defaultCard).toBeVisible();
      await expect(setupAssistant.profileName).toHaveText('Default profile');
    });
  });
}
