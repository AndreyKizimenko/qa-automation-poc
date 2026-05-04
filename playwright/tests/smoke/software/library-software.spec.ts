/**
 * Software library lifecycle (UI-only) on the smoke fleet, covering all
 * supported add-flows: Custom packages (macOS .pkg, Windows .msi, Linux
 * .deb), Fleet-Maintained Apps (macOS + Windows), App Store VPP (Apple),
 * and Managed Google Play (Android).
 *
 * For each entry the flow is: add via UI → confirm on the title detail
 * page → confirm under the "Available for install" filter →
 * type-specific catalog check (FMA: row shows green checkmark; VPP: app
 * drops out of the catalog list) → delete via the installer card →
 * confirm gone from "Available for install" → type-specific catalog
 * check reverts (FMA: "Add" button restored; VPP: app re-listed).
 *
 * Tests run in parallel; each case targets a distinct software title so
 * they don't race against each other on the shared smoke fleet.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import type { VppPlatformLabel } from '@pages';

interface CustomPackageCase {
  kind: 'custom';
  os: 'macOS' | 'Windows' | 'Linux';
  fixture: string;
}

interface FmaCase {
  kind: 'fma';
  platform: 'macOS' | 'Windows';
  appName: string;
}

interface VppCase {
  kind: 'vpp';
  appName: string;
  platform: VppPlatformLabel;
}

interface AndroidCase {
  kind: 'android';
  applicationId: string;
}

type SoftwareCase = CustomPackageCase | FmaCase | VppCase | AndroidCase;

const CASES: SoftwareCase[] = [
  { kind: 'custom', os: 'macOS', fixture: 'apple/macos/software/gh_2.92.0_macOS_universal.pkg' },
  { kind: 'custom', os: 'Windows', fixture: 'windows/software/npp.8.9.4.Installer.x64.msi' },
  { kind: 'custom', os: 'Linux', fixture: 'linux/software/step-cli_0.30.2-1_amd64.deb' },
  { kind: 'fma', platform: 'macOS', appName: 'Airtame' },
  { kind: 'fma', platform: 'Windows', appName: '7-Zip' },
  { kind: 'vpp', platform: 'iOS', appName: 'Bear' },
  { kind: 'android', applicationId: 'com.openai.chatgpt' },
];

const caseLabel = (c: SoftwareCase): string => {
  switch (c.kind) {
    case 'custom':
      return `Custom package — ${c.os}`;
    case 'fma':
      return `FMA — ${c.appName} (${c.platform})`;
    case 'vpp':
      return `VPP — ${c.appName} (${c.platform})`;
    case 'android':
      return `Android — ${c.applicationId}`;
  }
};

test.describe('Software • Library lifecycle', () => {
  for (const c of CASES) {
    test(`${caseLabel(c)} — add → list → preview → delete`, async ({
      dashboard,
      softwareTitles,
      softwareTitleDetail,
      softwareCustomPackage,
      fleetMaintainedApps,
      fleetMaintainedAppDetail,
      softwareAppStoreVpp,
      softwareAppStoreAndroid,
      softwareFleet,
      page,
    }) => {
      await dashboard.goto({ fleetId: softwareFleet.id });
      await dashboard.navbar.goToSoftware();

      switch (c.kind) {
        case 'custom': {
          const fixturePath = path.resolve(__dirname, '../../../test-data', c.fixture);
          await softwareCustomPackage.goto({ fleetId: softwareFleet.id });
          await softwareCustomPackage.uploadPackage(fixturePath);
          break;
        }
        case 'fma':
          await fleetMaintainedApps.goto({ fleetId: softwareFleet.id });
          await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
          await fleetMaintainedApps.clickAdd(c.appName, c.platform);
          await fleetMaintainedAppDetail.confirmAdd();
          // FMA confirmAdd lands on /software/titles/:id once Fleet's CDN fetch finishes.
          await page.waitForURL(/\/software\/titles\/\d+/);
          break;
        case 'vpp':
          await softwareAppStoreVpp.goto({ fleetId: softwareFleet.id });
          await softwareAppStoreVpp.expectListed(c.appName, c.platform);
          await softwareAppStoreVpp.addApp(c.appName, c.platform);
          break;
        case 'android':
          await softwareAppStoreAndroid.goto({ fleetId: softwareFleet.id });
          await softwareAppStoreAndroid.addApp(c.applicationId);
          break;
      }

      await expect(softwareTitleDetail.installerCard.card).toBeVisible();
      const titleName = await softwareTitleDetail.displayName();
      expect(titleName.length).toBeGreaterThan(0);

      await softwareTitles.goto({ fleetId: softwareFleet.id, availableForInstall: true });
      await softwareTitles.searchByName(titleName);
      await expect(softwareTitles.table.rowWith(titleName)).toBeVisible();

      if (c.kind === 'fma') {
        await fleetMaintainedApps.goto({ fleetId: softwareFleet.id });
        await fleetMaintainedApps.expectAddedFor(c.appName, c.platform);
      } else if (c.kind === 'vpp') {
        await softwareAppStoreVpp.goto({ fleetId: softwareFleet.id });
        await softwareAppStoreVpp.expectNotListed(c.appName, c.platform);
      }

      await softwareTitles.goto({ fleetId: softwareFleet.id, availableForInstall: true });
      await softwareTitles.searchByName(titleName);
      await softwareTitles.clickSoftwareTitle(titleName);
      await softwareTitleDetail.installerCard.delete();

      await softwareTitles.goto({ fleetId: softwareFleet.id, availableForInstall: true });
      await softwareTitles.search.fill(titleName);
      await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();
      await expect(softwareTitles.table.rowWith(titleName)).toHaveCount(0);

      if (c.kind === 'fma') {
        await fleetMaintainedApps.goto({ fleetId: softwareFleet.id });
        await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
      } else if (c.kind === 'vpp') {
        await softwareAppStoreVpp.goto({ fleetId: softwareFleet.id });
        await softwareAppStoreVpp.expectListed(c.appName, c.platform);
      }
    });
  }
});
