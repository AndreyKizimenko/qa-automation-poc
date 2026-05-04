/**
 * MDM Setup Experience — Install software. Verifies that every supported
 * platform tab renders, and that software added to the smoke fleet via
 * API surfaces as a selectable row in the appropriate platform tab.
 *
 * Software pre-conditions are added via API (custom packages, FMA, VPP,
 * Android) so the test focuses on the setup-experience UI rather than
 * exercising the per-type add flows again — those are covered in
 * `tests/smoke/software/library-software.spec.ts`.
 *
 * Tests run serially within this describe so two cases on the same
 * platform tab (e.g. macOS custom + macOS FMA + macOS VPP) don't race
 * on the shared "Save" button. afterEach deletes the test's title so
 * each case starts from a known list state.
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
import type { InstallSoftwarePlatform } from '@pages';

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
  { kind: 'custom', platform: 'macos', fixture: 'apple/macos/software/gh_2.92.0_macOS_universal.pkg' },
  { kind: 'custom', platform: 'windows', fixture: 'windows/software/npp.8.9.4.Installer.x64.msi' },
  { kind: 'custom', platform: 'linux', fixture: 'linux/software/step-cli_0.30.2-1_amd64.deb' },
  { kind: 'fma', platform: 'macos', slug: 'airtame/darwin' },
  { kind: 'fma', platform: 'windows', slug: '7-zip/windows' },
  { kind: 'vpp', platform: 'macos', appStorePlatform: 'darwin', appStoreId: '1091189122', appName: 'Bear' },
  { kind: 'vpp', platform: 'ios', appStorePlatform: 'ios', appStoreId: '1016366447', appName: 'Bear' },
  { kind: 'vpp', platform: 'ipados', appStorePlatform: 'ipados', appStoreId: '1016366447', appName: 'Bear' },
  { kind: 'android', platform: 'android', applicationId: 'com.openai.chatgpt' },
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

test.describe.configure({ mode: 'serial' });

test.describe('MDM • Setup Experience — Install software', () => {
  test('all 6 platform tabs are visible', async ({
    dashboard,
    controls,
    setupExperience,
    installSoftware,
    mdmFleet,
  }) => {
    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
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
      mdmFleet,
      request,
      page,
    }) => {
      // Bump the timeout for FMA/VPP/Android cases — Fleet's CDN/App Store
      // fetch can take 30+ seconds on the first add of a given app.
      test.setTimeout(180_000);

      let titleId: number;
      switch (c.kind) {
        case 'custom': {
          const fixturePath = path.resolve(__dirname, '../../../../test-data', c.fixture);
          const ref = await uploadSoftwarePackage(request, mdmFleet.id, fixturePath);
          titleId = ref.titleId;
          break;
        }
        case 'fma':
          titleId = (await addFmaToFleet(request, mdmFleet.id, c.slug)).titleId;
          break;
        case 'vpp':
          titleId = (
            await addAppStoreApp(request, mdmFleet.id, {
              appStoreId: c.appStoreId,
              platform: c.appStorePlatform,
            })
          ).titleId;
          break;
        case 'android':
          titleId = (
            await addAppStoreApp(request, mdmFleet.id, {
              appStoreId: c.applicationId,
              platform: 'android',
            })
          ).titleId;
          break;
      }

      const title = await getSoftwareTitle(request, mdmFleet.id, titleId);

      await dashboard.goto({ fleetId: mdmFleet.id });
      await dashboard.navbar.goToControls();
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
      await deleteSoftwareTitle(request, mdmFleet.id, titleId);
    });
  }

  test('macOS tab — pagination enables once more than 10 titles are listed', async ({
    dashboard,
    controls,
    setupExperience,
    installSoftware,
    mdmFleet,
    request,
  }) => {
    test.setTimeout(300_000);

    // The InstallSoftwareTable client-side-paginates with pageSize=10, so
    // 11 macOS titles are enough to enable the Next button.
    const slugs = [
      'airtame/darwin', 'apparency/darwin', 'appcleaner/darwin',
      'bbedit/darwin', 'bitwarden/darwin', 'box-drive/darwin',
      'brave-browser/darwin', 'coteditor/darwin', 'cyberduck/darwin',
      'discord/darwin', 'drawio/darwin',
    ];

    const titleIds: number[] = [];
    try {
      const refs = await Promise.all(
        slugs.map((slug) => addFmaToFleet(request, mdmFleet.id, slug)),
      );
      titleIds.push(...refs.map((r) => r.titleId));

      await dashboard.goto({ fleetId: mdmFleet.id });
      await dashboard.navbar.goToControls();
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
          deleteSoftwareTitle(request, mdmFleet.id, id).catch((err) => {
            console.warn(`[pagination cleanup] failed to delete title ${id}:`, err);
          }),
        ),
      );
    }
  });
});
