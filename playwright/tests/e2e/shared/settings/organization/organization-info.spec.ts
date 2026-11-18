/**
 * Shared • Settings • Organization info: every test that saves the Organization
 * info card, on both tiers (`OrgSettingsPage/cards/Info` has no tier gate).
 *
 * **One file, one test at a time.** Every Save of the card PATCHes `org_info`'s
 * name and support URL as the form loaded them, even when only a logo changed,
 * and then runs each logo change through its own `/logo` call (`Info.tsx`). So
 * two tests saving it at once undo each other: a logo test whose form loaded
 * before the org-name test's Save puts the old name back between that Save and
 * the org-name test's reload. Playwright keeps tests apart only
 * inside one file, so every test that saves this card lives here, and the file
 * runs them in order on one worker. `mode: 'default'`, not `serial`: no test
 * needs another's result, so a failure doesn't skip the rest.
 *
 * The org-name test renames the organization for a few seconds, so a spec in
 * another file that compares the page's name with the config re-reads both
 * until they agree (`shared/settings/apple-mdm.spec.ts`).
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { MyAccountPage } from '@pages';
import { getAppConfig, patchAppConfig, getOrgLogoUrls, restoreOrgLogo, type OrgInfo, type OrgLogoMode } from '@helpers/api';

test.describe.configure({ mode: 'default' });

/**
 * Editing the org name and support URL persists across a reload. The original
 * org_info is snapshotted through the API up front and restored in afterEach,
 * which runs even if the test body fails.
 */
test.describe('Shared • Settings • Organization info', () => {
  let original: OrgInfo;

  test.beforeEach(async ({ request }) => {
    original = (await getAppConfig(request)).org_info ?? {};
  });

  test.afterEach(async ({ request }) => {
    await patchAppConfig(request, {
      org_info: {
        org_name: original.org_name,
        contact_url: original.contact_url ?? '',
      },
    });
  });

  test('org name and support URL persist across reload', async ({ organizationInfo }) => {
    const newName = `PW Org ${Date.now()}`;
    const newUrl = 'https://example.com/pw-support';

    await organizationInfo.goto();
    await organizationInfo.setOrgName(newName);
    await organizationInfo.setSupportUrl(newUrl);
    await organizationInfo.save();

    await organizationInfo.goto();
    await expect(organizationInfo.orgNameInput).toHaveValue(newName);
    await expect(organizationInfo.supportUrlInput).toHaveValue(newUrl);
  });
});

/**
 * Custom logo. The logo is the one piece of branding a free instance can
 * change.
 *
 * Fleet stores one logo per theme and the top nav picks the one matching the
 * viewer's account theme, so theme is a dimension of these tests rather than two
 * near-identical describes. The account theme is client-side (a `dark-mode`
 * class plus a localStorage entry — see `shared/account/theme.spec.ts`), so
 * switching it costs nothing and can't leak into another spec: it lives in this
 * test's own browser context.
 *
 * **No screenshots.** Fleet marks the built-in Fleet avatar with a
 * `default-fleet-logo` class and swaps the `<img src>` for the uploaded logo's
 * serving URL, so "a custom logo is in effect" is readable from the DOM — and,
 * unlike a screenshot, a failure says whether the wrong logo was served or the
 * right one wasn't picked up.
 *
 * **Restores inside the test, never in a hook.** A sibling spec's `afterEach`
 * restore has rolled a mutating test back mid-flight before. `finally` here runs
 * in the test's own lifetime, and it touches only the one mode this case
 * changed: `PATCH /config` rejects a whole snapshotted `org_info` subtree, and
 * clearing a logo needs `DELETE /logo?mode=` anyway — emptying one URL field
 * leaves the deprecated alias pointing at the old one.
 */
const LOGO = path.resolve(
  __dirname,
  '../../../../../test-data/shared/images/fleet-test-logo.png',
);

const THEMES: { mode: OrgLogoMode; theme: 'Light' | 'Dark' }[] = [
  { mode: 'light', theme: 'Light' },
  { mode: 'dark', theme: 'Dark' },
];

test.describe('Settings • Organization logo', () => {
  for (const { mode, theme } of THEMES) {
    test(`a ${mode}-mode logo replaces the default and removing it restores it`, async ({
      organizationInfo,
      page,
      request,
    }) => {
      // Two form saves, each running an org_info PATCH plus a logo upload or
      // delete, with a theme switch and three page loads in between.
      test.setTimeout(90_000);

      const before = await getOrgLogoUrls(request);
      // Uploading overwrites the stored blob for this mode and only the URL can
      // be restored afterwards, so don't run where a real logo is configured.
      test.skip(
        !!before[mode],
        `a ${mode}-mode organization logo is already configured; the upload would overwrite it`,
      );
      const otherMode: OrgLogoMode = mode === 'light' ? 'dark' : 'light';

      try {
        await organizationInfo.goto();

        // Nothing custom yet: the card shows Fleet's own avatar and there is
        // nothing to remove.
        await expect(organizationInfo.logoPreview(mode)).toHaveClass(/default-fleet-logo/);
        await expect(organizationInfo.removeLogoButton(mode)).toBeDisabled();

        await organizationInfo.setLogo(mode, LOGO);
        await organizationInfo.save();

        // Reload rather than trusting the staged preview — until Save lands the
        // card is showing a local blob URL and looks the same either way.
        await organizationInfo.goto();
        const uploaded = await getOrgLogoUrls(request);
        expect(uploaded[mode]).toMatch(/\/logo\?mode=/);
        await expect(organizationInfo.logoPreview(mode)).not.toHaveClass(/default-fleet-logo/);
        await expect(organizationInfo.logoPreview(mode)).toHaveAttribute('src', uploaded[mode]);

        // The other theme's card is untouched: Fleet stores the two separately.
        expect(uploaded[otherMode]).toBe(before[otherMode]);

        // The point of the upload — the nav shows it to anyone on that theme.
        const myAccount = new MyAccountPage(page);
        await myAccount.goto();
        await myAccount.selectTheme(theme);
        if (theme === 'Dark') {
          await expect(page.locator('body')).toHaveClass(/dark-mode/);
        } else {
          await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
        }
        await expect(organizationInfo.navbar.logoImage).toHaveAttribute('src', uploaded[mode]);
        await expect(organizationInfo.navbar.logoImage).not.toHaveClass(/default-fleet-logo/);

        // Remove: back to the built-in avatar, in the card and in the nav.
        await organizationInfo.goto();
        await organizationInfo.removeLogo(mode);
        await organizationInfo.save();

        await organizationInfo.goto();
        expect((await getOrgLogoUrls(request))[mode]).toBe('');
        await expect(organizationInfo.logoPreview(mode)).toHaveClass(/default-fleet-logo/);
        await expect(organizationInfo.removeLogoButton(mode)).toBeDisabled();
        await expect(organizationInfo.navbar.logoImage).toHaveClass(/default-fleet-logo/);
      } finally {
        await restoreOrgLogo(request, mode, before[mode]);
      }
    });
  }
});
