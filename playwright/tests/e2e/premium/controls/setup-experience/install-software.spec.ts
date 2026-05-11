/**
 * MDM Setup Experience — Install software.
 *
 * Software pre-conditions are added via API and the UI assertions cover the
 * setup-experience-specific selection/save flow. Runs once per scope
 * (Unassigned + Workstations).
 *
 * Picks software titles that don't overlap with `tests/e2e/premium/software/
 * library.spec.ts` (dummy custom packages, 1Password FMA, Canva VPP,
 * AllTrails Android) so cross-spec parallel runs don't race on the same
 * software entity.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import {
  uploadSoftwarePackage,
  addFmaToFleet,
  addAppStoreApp,
  deleteSoftwareTitle,
  getSoftwareTitle,
  type AppStorePlatform,
} from '@helpers/api';
import type { InstallSoftwarePlatform, TeamScope } from '@pages';

interface CustomCase {
  kind: 'custom';
  platform: InstallSoftwarePlatform;
  fixture: string;
}

interface FmaCase {
  kind: 'fma';
  platform: InstallSoftwarePlatform;
  slug: string;
}

interface VppCase {
  kind: 'vpp';
  platform: InstallSoftwarePlatform;
  appStorePlatform: AppStorePlatform;
  appStoreId: string;
  appName: string;
}

interface AndroidCase {
  kind: 'android';
  platform: 'android';
  applicationId: string;
}

type SoftwareCase = CustomCase | FmaCase | VppCase | AndroidCase;

const CASES: SoftwareCase[] = [
  { kind: 'custom', platform: 'macos', fixture: 'apple/macos/setup-experience/playwright-setup-exp.pkg' },
  { kind: 'custom', platform: 'windows', fixture: 'windows/setup-experience/playwright-setup-exp.msi' },
  { kind: 'custom', platform: 'linux', fixture: 'linux/setup-experience/playwright-setup-exp.deb' },
  { kind: 'fma', platform: 'macos', slug: '1password/darwin' },
  { kind: 'fma', platform: 'windows', slug: '1password/windows' },
  { kind: 'vpp', platform: 'macos', appStorePlatform: 'darwin', appStoreId: '897446215', appName: 'Canva' },
  { kind: 'vpp', platform: 'ios', appStorePlatform: 'ios', appStoreId: '897446215', appName: 'Canva' },
  { kind: 'vpp', platform: 'ipados', appStorePlatform: 'ipados', appStoreId: '897446215', appName: 'Canva' },
  { kind: 'android', platform: 'android', applicationId: 'com.alltrails.alltrails' },
];

const caseLabel = (c: SoftwareCase): string => {
  switch (c.kind) {
    case 'custom':
      return `Custom package — ${c.platform}`;
    case 'fma':
      return `FMA — ${c.slug}`;
    case 'vpp':
      return `VPP — ${c.appName} (${c.platform})`;
    case 'android':
      return `Android — ${c.applicationId}`;
  }
};

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`MDM • Setup Experience — Install software (${scope})`, () => {
    // Within one scope, the cases share the install-software platform tab
    // chrome (save button, list state). Run them in order so two cases on
    // the same platform tab can't collide on a shared "Save".
    test.describe.configure({ mode: 'serial' });

    test('all 6 platform tabs are visible', async ({
      dashboard,
      controls,
      setupExperience,
      installSoftware,
    }) => {
      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.teamDropdown.select(scope);
      await controls.goToSetupExperience();
      await setupExperience.goToInstallSoftware();
      await installSoftware.expectAllPlatformTabs();
    });

    for (const c of CASES) {
      test(`${caseLabel(c)} — appears in ${c.platform} tab and saves selection`, async ({
        dashboard,
        controls,
        setupExperience,
        installSoftware,
        workstationsFleetId,
        request,
        page,
      }) => {
        const fleetId = scope === 'Unassigned' ? 0 : workstationsFleetId;
        // Fleet's CDN / App Store fetch can take 30+ seconds on the first
        // add of a given app.
        test.setTimeout(180_000);

        let titleId: number;
        switch (c.kind) {
          case 'custom': {
            const fixturePath = path.resolve(__dirname, '../../../../../test-data', c.fixture);
            const ref = await uploadSoftwarePackage(request, fleetId, fixturePath);
            titleId = ref.titleId;
            break;
          }
          case 'fma':
            titleId = (await addFmaToFleet(request, fleetId, c.slug)).titleId;
            break;
          case 'vpp':
            titleId = (
              await addAppStoreApp(request, fleetId, {
                appStoreId: c.appStoreId,
                platform: c.appStorePlatform,
              })
            ).titleId;
            break;
          case 'android':
            titleId = (
              await addAppStoreApp(request, fleetId, {
                appStoreId: c.applicationId,
                platform: 'android',
              })
            ).titleId;
            break;
        }

        const title = await getSoftwareTitle(request, fleetId, titleId);

        await dashboard.goto();
        await dashboard.navbar.goToControls();
        await controls.teamDropdown.select(scope);
        await controls.goToSetupExperience();
        await setupExperience.goToInstallSoftware();

        await installSoftware.switchPlatform(c.platform);
        await installSoftware.expectListed(title.name);
        await installSoftware.expectNotSelected(title.name);

        await installSoftware.toggleSelection(title.name);
        await installSoftware.save();

        await page.reload();
        await installSoftware.expectSelected(title.name);

        // Fleet refuses to delete a title that's still selected for setup
        // experience install — toggle off + save before the API delete.
        await installSoftware.toggleSelection(title.name);
        await installSoftware.save();
        await deleteSoftwareTitle(request, fleetId, titleId);
      });
    }

    test('macOS tab — pagination enables once more than 10 titles are listed', async ({
      dashboard,
      controls,
      setupExperience,
      installSoftware,
      workstationsFleetId,
      request,
    }) => {
      const fleetId = scope === 'Unassigned' ? 0 : workstationsFleetId;
      test.setTimeout(300_000);

      // 11 macOS FMA slugs — none overlapping the single-case test above
      // (1password) or the library spec macOS FMA case (airtame).
      const slugs = [
        '010-editor/darwin', 'apparency/darwin', 'appcleaner/darwin',
        'bbedit/darwin', 'bitwarden/darwin', 'box-drive/darwin',
        'brave-browser/darwin', 'coteditor/darwin', 'cyberduck/darwin',
        'discord/darwin', 'drawio/darwin',
      ];

      const titleIds: number[] = [];
      try {
        const refs = await Promise.all(
          slugs.map((slug) => addFmaToFleet(request, fleetId, slug)),
        );
        titleIds.push(...refs.map((r) => r.titleId));

        await dashboard.goto();
        await dashboard.navbar.goToControls();
        await controls.teamDropdown.select(scope);
        await controls.goToSetupExperience();
        await setupExperience.goToInstallSoftware();
        await installSoftware.switchPlatform('macos');

        await expect(installSoftware.nextButton).toBeEnabled();

        const page1FirstName = await installSoftware.firstRowName();
        await installSoftware.nextButton.click();
        await expect.poll(() => installSoftware.firstRowName()).not.toBe(page1FirstName);

        await installSoftware.previousButton.click();
        await expect.poll(() => installSoftware.firstRowName()).toBe(page1FirstName);
      } finally {
        await Promise.all(
          titleIds.map((id) =>
            deleteSoftwareTitle(request, fleetId, id).catch((err) => {
              console.warn(`[pagination cleanup] failed to delete title ${id}:`, err);
            }),
          ),
        );
      }
    });
  });
}
