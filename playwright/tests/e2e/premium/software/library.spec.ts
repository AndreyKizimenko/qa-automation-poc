/**
 * Software library lifecycle — premium-only (all four Add Software paths
 * are paywalled on free). Runs once per (scope, case) cell as a serial
 * describe: add → delete → activity feed. Splitting per CRUD step keeps
 * test reports specific about which action regressed for which software
 * type and team scope.
 *
 * Software has no in-UI edit step; the lifecycle is add + delete only.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
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

      // Activity-feed suffix is asymmetric for app-store apps on the
      // Unassigned scope: add renders "to the No team fleet" while delete
      // renders "from unassigned". Custom/FMA stay symmetric ("unassigned").
      const addSuffix =
        scope === 'Unassigned'
          ? (isAppStore ? 'the No team fleet' : 'unassigned')
          : `the ${scope} fleet`;
      const deleteSuffix =
        scope === 'Unassigned' ? 'unassigned' : `the ${scope} fleet`;

      // Captured during 'add' for use in 'delete' and 'activity feed'.
      let titleName: string;
      let titleId: number;
      let feedNeedle: string;

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

        // Feed text varies by case kind:
        //   - custom/FMA → installer filename (`software_package` in details)
        //   - VPP/Android → "<titleName> (<platform>)"
        if (c.kind === 'custom' || c.kind === 'fma') {
          feedNeedle = (activity.details as { software_package?: string }).software_package ?? '';
        } else if (c.kind === 'vpp') {
          feedNeedle = `${titleName} (${c.platform})`;
        } else {
          feedNeedle = `${titleName} (Android)`;
        }
        expect(feedNeedle.length).toBeGreaterThan(0);

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
        // Escape the captured needle: filenames contain dots, VPP/Android
        // names may include parentheses — both are regex metacharacters.
        const escaped = feedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await dashboard.expectActivities([
          new RegExp(`added ${escaped} to ${addSuffix}\\.`),
          new RegExp(`deleted ${escaped} from ${deleteSuffix}\\.`),
        ]);
      });
    });
  }
}
