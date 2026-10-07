/**
 * Software library lifecycle — premium-only (all four Add Software paths
 * are paywalled on free). Runs once per (scope, case) cell. The lifecycle is
 * add + delete, plus one edit for the Play Store case: its managed
 * configuration, saved and read back.
 *
 * A Play Store app's configuration (Actions → Edit configuration) is JSON whose
 * top-level keys Fleet limits to `managedConfiguration` and
 * `workProfileWidgets` (`ValidateAndroidAppConfiguration`); the browser checks
 * only that it parses. Premium holds no Android host, so a saved configuration
 * reaches no device: what's tested is what Fleet stores and what it refuses.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';
import {
  assertActivity,
  assertActivityAfter,
  getAppStoreAppConfiguration,
  latestActivityId,
} from '@helpers/api';
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
        softwareLibrary,
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
        // The add flow runs a server-side installer/CDN fetch plus the library
        // and activity-feed checks; under 4-worker load that can edge past the
        // global 60s budget. 90s caps the whole flow with headroom — each step
        // still ends as soon as its work does; this is only the ceiling.
        test.setTimeout(90_000);
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
            await page.waitForURL(/\/software\/titles\/\d+/, { timeout: 30_000 });
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

        // The summary card's Type line is how an admin tells an App Store or
        // Play Store app apart from a package of the same name once it's added
        // — the only visible difference on the title page. Fleet derives it
        // from the title's osquery source (`SOURCE_TYPE_CONVERSION`), so
        // `android_apps` reads "Application (Android)" and `ios_apps` reads
        // "Application (iOS)".
        if (c.kind === 'android') {
          await expect(softwareTitleDetail.typeValue).toHaveText('Application (Android)');
        } else if (c.kind === 'vpp') {
          await expect(softwareTitleDetail.typeValue).toHaveText(`Application (${c.platform})`);
        }
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

        // Verify on the Library tab (installer-managed software only) —
        // the legacy /software/titles?available_for_install=true URL now
        // redirects to /software/inventory and silently drops the
        // filter, so the inventory list mixes installers with
        // host-reported software (and a title-name search there can
        // hit unrelated rows on hosts).
        await softwareLibrary.goto({ fleetId });
        await softwareLibrary.teamDropdown.select(scope);
        await softwareLibrary.searchByName(titleName);
        await expect(softwareLibrary.table.rowWith(titleName)).toBeVisible();

        if (c.kind === 'fma') {
          await fleetMaintainedApps.goto({ fleetId });
          await fleetMaintainedApps.expectAddedFor(c.appName, c.platform);
        } else if (c.kind === 'vpp') {
          await softwareAppStoreVpp.goto({ fleetId });
          await softwareAppStoreVpp.expectNotListed(c.appName, c.platform);
        }
      });

      if (c.kind === 'android') {
        test('edit configuration', async ({ softwareTitleDetail, workstationsFleetId, request, page }) => {
          const fleetId = fleetIdFor(scope, workstationsFleetId);
          const modal = softwareTitleDetail.editConfigurationModal;
          const stored = await getAppStoreAppConfiguration(request, fleetId, titleId);

          await softwareTitleDetail.goto({ titleId, fleetId });
          await softwareTitleDetail.openEditConfiguration();

          // Well-formed JSON with a key Fleet doesn't support: refused, and nothing changes.
          await modal.fill('{ "pwUnsupportedKey": true }');
          await modal.saveButton.click();
          await softwareTitleDetail.toast.expectError(
            'Only "managedConfiguration" and "workProfileWidgets" are supported as top-level keys.',
          );
          await expect(modal.modal).toBeVisible();
          expect(await getAppStoreAppConfiguration(request, fleetId, titleId)).toEqual(stored);

          const configuration = {
            managedConfiguration: { pw_setting: 'pw-value' },
            workProfileWidgets: 'WORK_PROFILE_WIDGETS_ALLOWED',
          };
          await modal.fill(JSON.stringify(configuration));
          const beforeSave = await latestActivityId(request);
          await modal.save();
          expect(await getAppStoreAppConfiguration(request, fleetId, titleId)).toEqual(configuration);
          // The other scope's run edits the same title in parallel, so the
          // activity is matched by its fleet and the configuration it records.
          await assertActivityAfter(
            request,
            'edited_app_store_app',
            beforeSave,
            (d) => {
              // Compared field by field: Fleet records the keys in its own order.
              const recorded = d.configuration as Partial<typeof configuration> | undefined;
              return (
                d.software_title === titleName &&
                d.fleet_id === fleetId &&
                recorded?.workProfileWidgets === configuration.workProfileWidgets &&
                recorded?.managedConfiguration?.pw_setting === configuration.managedConfiguration.pw_setting
              );
            },
            { actor: process.env.FLEET_ADMIN_EMAIL },
          );

          // Fleet reopens it re-serialised (tab-indented), so it's compared parsed.
          await page.reload();
          await softwareTitleDetail.openEditConfiguration();
          expect(JSON.parse(await modal.value())).toEqual(configuration);
          await modal.close();
        });
      }

      test('delete', async ({
        softwareLibrary,
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

        await softwareLibrary.goto({ fleetId });
        await softwareLibrary.teamDropdown.select(scope);
        // Library's search input is disabled when the table is empty, so
        // we can't always type a query post-delete. Library is bounded to
        // installer-managed items (no host-reported noise), so a direct
        // row-count assertion on the title name is unambiguous.
        await expect(softwareLibrary.table.rowOrEmpty()).toBeVisible();
        await expect(softwareLibrary.table.rowWith(titleName)).toHaveCount(0);

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

// Software is added to a specific fleet, so under the "All fleets" aggregate
// the "Add software" button is disabled and explains why on hover. A gating
// check, not part of the add/delete lifecycle, so it lives in its own describe.
test.describe('Software — add-software gating', () => {
  test('Add software is disabled under All fleets, with a tooltip', async ({ softwareTitles, page }) => {
    await softwareTitles.goto();
    await softwareTitles.teamDropdown.select('All fleets');

    await expect(softwareTitles.addSoftwareButton).toBeDisabled();
    // The button is disabled (swallows pointer events), so force the hover to
    // trigger the wrapping TooltipWrapper's mouseenter and reveal the reason.
    await softwareTitles.addSoftwareButton.hover({ force: true });
    await expect(page.getByText('Select a fleet to add software.')).toBeVisible();
  });
});
