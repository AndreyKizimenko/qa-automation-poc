/**
 * Software library lifecycle — premium-only (all four Add Software paths
 * are paywalled on free). Runs once per (scope, case) cell. Software has
 * no in-UI edit step; the lifecycle is add + delete only.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';
import { fleetIdFor } from '@helpers/team-scope';
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

// Narrowed so `fleetIdFor(scope, …)` returns `number` (never `undefined`)
// at the call sites that feed pages whose `goto({ fleetId })` requires a
// number (FMA, VPP, the title detail URL builder).
const SCOPES = ['Unassigned', 'Workstations'] as const satisfies readonly TeamScope[];

for (const scope of SCOPES) {
  for (const c of CASES) {
    test.describe(`Software library lifecycle (${scope}) — ${caseLabel(c)}`, () => {
      test.describe.configure({ mode: 'serial' });

      // Custom packages and FMA go through Fleet's installer pipeline
      // (`added_software` / `deleted_software`). VPP and Android use the
      // app-store path with a separate activity pair.
      const isAppStore = c.kind === 'vpp' || c.kind === 'android';
      const addActivity = isAppStore ? 'added_app_store_app' : 'added_software';
      const deleteActivity = isAppStore ? 'deleted_app_store_app' : 'deleted_software';

      // Captured during 'add' for use in 'delete' and 'activity feed'.
      let titleName: string;
      let titleId: number;
      // Installer file name (Fleet's activity `software_package` detail) —
      // populated for custom/FMA cases only; app-store cases feed
      // titleName + platform directly into the appStoreApp matchers.
      let packageName: string;

      test('add', async ({
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
        const fleetId = fleetIdFor(scope, workstationsFleetId);

        await dashboard.goto();
        await dashboard.navbar.goToSoftware();
        await softwareTitles.teamDropdown.select(scope);

        // Click-through entry point: clicking "Add software" inherits the
        // team scope from the titles page's URL (no manual fleet_id), then
        // each sub-page's openTab() switches tabs from there.
        await softwareTitles.clickAddSoftware();

        switch (c.kind) {
          case 'custom': {
            const fixturePath = path.resolve(__dirname, '../../../../test-data', c.fixture);
            await softwareCustomPackage.openTab();
            await softwareCustomPackage.uploadPackage(fixturePath);
            break;
          }
          case 'fma':
            await fleetMaintainedApps.expectLoaded();
            await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
            await fleetMaintainedApps.clickAdd(c.appName, c.platform);
            await fleetMaintainedAppDetail.confirmAdd();
            await page.waitForURL(/\/software\/titles\/\d+/);
            break;
          case 'vpp':
            await softwareAppStoreVpp.openTab();
            await softwareAppStoreVpp.expectListed(c.appName, c.platform);
            await softwareAppStoreVpp.addApp(c.appName, c.platform);
            break;
          case 'android':
            await softwareAppStoreAndroid.openTab();
            await softwareAppStoreAndroid.addApp(c.applicationId);
            break;
        }

        await expect(softwareTitleDetail.installerCard.card).toBeVisible();
        titleName = await softwareTitleDetail.displayName();
        expect(titleName.length).toBeGreaterThan(0);
        const activity = await assertActivity(
          request,
          addActivity,
          (d) => d.software_title === titleName,
        );

        titleId = Number(page.url().match(/\/software\/titles\/(\d+)/)?.[1]);
        expect(titleId).toBeGreaterThan(0);

        // Custom/FMA cases need the installer filename for the activity-feed
        // matcher (Fleet renders software_package, not the title). App-store
        // cases use titleName + the case's platform label directly.
        if (c.kind === 'custom' || c.kind === 'fma') {
          packageName = (activity.details as { software_package?: string }).software_package ?? '';
          expect(packageName.length).toBeGreaterThan(0);
        }

        await softwareTitles.goto({ fleetId, availableForInstall: true });
        await softwareTitles.teamDropdown.select(scope);
        await softwareTitles.searchByName(titleName);
        await expect(softwareTitles.table.rowWith(titleName)).toBeVisible();

        if (c.kind === 'fma') {
          await fleetMaintainedApps.goto({ fleetId });
          await fleetMaintainedApps.expectAddedFor(c.appName, c.platform);
        } else if (c.kind === 'vpp') {
          await softwareAppStoreVpp.goto({ fleetId });
          await softwareAppStoreVpp.expectNotListed(c.appName, c.platform);
        }
      });

      test('delete', async ({
        softwareTitles,
        softwareTitleDetail,
        fleetMaintainedApps,
        softwareAppStoreVpp,
        workstationsFleetId,
        request,
        page,
      }) => {
        const fleetId = fleetIdFor(scope, workstationsFleetId);

        await page.goto(`/software/titles/${titleId}?fleet_id=${fleetId}`);
        await softwareTitleDetail.installerCard.delete();
        await assertActivity(request, deleteActivity, (d) => d.software_title === titleName);

        await softwareTitles.goto({ fleetId, availableForInstall: true });
        await softwareTitles.teamDropdown.select(scope);
        await softwareTitles.search.fill(titleName);
        await expect(softwareTitles.table.rowOrEmpty()).toBeVisible();
        await expect(softwareTitles.table.rowWith(titleName)).toHaveCount(0);

        if (c.kind === 'fma') {
          await fleetMaintainedApps.goto({ fleetId });
          await fleetMaintainedApps.expectNotAddedFor(c.appName, c.platform);
        } else if (c.kind === 'vpp') {
          await softwareAppStoreVpp.goto({ fleetId });
          await softwareAppStoreVpp.expectListed(c.appName, c.platform);
        }
      });

      test('activity feed shows add → delete', async ({ dashboard }) => {
        await dashboard.goto();
        const matchers = isAppStore
          ? [
              activityCopy.appStoreApp.added({
                name: titleName,
                platform: c.kind === 'android' ? 'Android' : c.platform,
                scope,
              }),
              activityCopy.appStoreApp.deleted({
                name: titleName,
                platform: c.kind === 'android' ? 'Android' : c.platform,
                scope,
              }),
            ]
          : [
              activityCopy.software.added({ packageName, scope }),
              activityCopy.software.deleted({ packageName, scope }),
            ];
        await dashboard.expectActivities(matchers);
      });
    });
  }
}
