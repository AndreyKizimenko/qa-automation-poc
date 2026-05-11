/**
 * Software library lifecycle — premium-only (all four Add Software paths
 * are paywalled on free). Runs once per scope (Unassigned + Workstations).
 *
 * Each case: add → confirm on detail → confirm in "Available for install"
 * → type-specific catalog state check → delete via installer card →
 * confirm gone → catalog state reverts. Distinct software titles per case
 * so parallel runs don't race; the outer scope loop reuses the same
 * titles because each test cleans up its own state.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import type { TeamScope, VppPlatformLabel } from '@pages';

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

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  test.describe(`Software • Library lifecycle (${scope})`, () => {
    for (const c of CASES) {
      // Custom packages and FMA go through Fleet's installer pipeline
      // (`added_software` / `deleted_software`). VPP and Android use the
      // app-store path with a separate activity pair.
      const isAppStore = c.kind === 'vpp' || c.kind === 'android';
      const addActivity = isAppStore ? 'added_app_store_app' : 'added_software';
      const deleteActivity = isAppStore ? 'deleted_app_store_app' : 'deleted_software';

      test(`${caseLabel(c)} — add → list → preview → delete`, async ({
        dashboard,
        softwareTitles,
        softwareTitleDetail,
        softwareCustomPackage,
        fleetMaintainedApps,
        fleetMaintainedAppDetail,
        softwareAppStoreVpp,
        softwareAppStoreAndroid,
        workstationsFleetId,
        request,
        page,
      }) => {
        const fleetId = scope === 'Unassigned' ? 0 : workstationsFleetId;

        await dashboard.goto();
        await dashboard.navbar.goToSoftware();
        await softwareTitles.teamDropdown.select(scope);

        switch (c.kind) {
          case 'custom': {
            const fixturePath = path.resolve(__dirname, '../../../../test-data', c.fixture);
            await softwareCustomPackage.goto({ fleetId });
            await softwareCustomPackage.uploadPackage(fixturePath);
            break;
          }
          case 'fma':
            await fleetMaintainedApps.goto();
            await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
            await fleetMaintainedApps.clickAdd(c.appName, c.platform);
            await fleetMaintainedAppDetail.confirmAdd();
            await page.waitForURL(/\/software\/titles\/\d+/);
            break;
          case 'vpp':
            await softwareAppStoreVpp.goto({ fleetId });
            await softwareAppStoreVpp.expectListed(c.appName, c.platform);
            await softwareAppStoreVpp.addApp(c.appName, c.platform);
            break;
          case 'android':
            await softwareAppStoreAndroid.goto({ fleetId });
            await softwareAppStoreAndroid.addApp(c.applicationId);
            break;
        }

        await expect(softwareTitleDetail.installerCard.card).toBeVisible();
        const titleName = await softwareTitleDetail.displayName();
        expect(titleName.length).toBeGreaterThan(0);
        await assertActivity(request, addActivity, (d) => d.software_title === titleName);

        const titleId = Number(page.url().match(/\/software\/titles\/(\d+)/)?.[1]);
        expect(titleId).toBeGreaterThan(0);

        await softwareTitles.goto({ fleetId, availableForInstall: true });
        await softwareTitles.searchByName(titleName);
        await expect(softwareTitles.table.rowWith(titleName)).toBeVisible();

        if (c.kind === 'fma') {
          await fleetMaintainedApps.goto();
          await fleetMaintainedApps.expectAddedFor(c.appName, c.platform);
        } else if (c.kind === 'vpp') {
          await softwareAppStoreVpp.goto({ fleetId });
          await softwareAppStoreVpp.expectNotListed(c.appName, c.platform);
        }

        await page.goto(`/software/titles/${titleId}?fleet_id=${fleetId}`);
        await softwareTitleDetail.installerCard.delete();
        await assertActivity(request, deleteActivity, (d) => d.software_title === titleName);

        await softwareTitles.goto({ fleetId, availableForInstall: true });
        await softwareTitles.search.fill(titleName);
        await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();
        await expect(softwareTitles.table.rowWith(titleName)).toHaveCount(0);

        if (c.kind === 'fma') {
          await fleetMaintainedApps.goto();
          await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
        } else if (c.kind === 'vpp') {
          await softwareAppStoreVpp.goto({ fleetId });
          await softwareAppStoreVpp.expectListed(c.appName, c.platform);
        }
      });
    }
  });
}
