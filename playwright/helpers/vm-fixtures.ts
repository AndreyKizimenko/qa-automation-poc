// The software the VMs fleet keeps for the install/uninstall specs. Declared in
// gitops/premium-fleetqa/fleets/vms.yml — this list names the same entries, and
// the two change together. The titles never leave the fleet, so Fleet always
// knows whether each is installed; their resting state is uninstalled.
import { APIRequestContext, expect } from '@playwright/test';
import {
  findSoftwareTitleByPackageName,
  getHostInventoryVersions,
  getHostSoftwareState,
  getSoftwarePackage,
  listFleetMaintainedTitles,
  uninstallSoftwareOnHost,
  waitForSoftwareSettled,
} from './api';

export type VmPlatform = 'darwin' | 'windows' | 'linux';

export interface VmSoftwareFixture {
  label: string;
  platform: VmPlatform;
  /** A custom package, by its installer's file name. */
  packageName?: string;
  /** A Fleet-maintained app, by its title name. */
  fleetMaintainedName?: string;
  /**
   * What the host's inventory calls it while Fleet hasn't linked the title to it.
   * An unlinked title's installed versions stay empty, so whether the software
   * is on the host is also read from the inventory by this name.
   */
  unlinkedInventoryName?: string;
}

export const VM_SOFTWARE_FIXTURES: readonly VmSoftwareFixture[] = [
  { label: 'macOS .pkg', platform: 'darwin', packageName: 'fleet-playwright-install-1.0.0.pkg' },
  { label: 'Windows .msi', platform: 'windows', packageName: 'fleet-playwright-install-1.0.0.msi' },
  {
    label: 'Windows .exe',
    platform: 'windows',
    packageName: '7z2601-arm64.exe',
    // A new .exe title takes the installer's ProductName while Windows lists the
    // program by its DisplayName, so it starts unlinked (fleetdm/fleet#20440).
    // 7-Zip is also in the Fleet-maintained catalog, and Fleet's hourly
    // `reconcile_windows_maintained_app_titles` cron then merges the DisplayName
    // title into this one (renaming it "7-zip", with 7-Zip's upgrade code), after
    // which it is linked. Which state the durable title is in depends on whether
    // the cron has run since the title was created, so both are read.
    unlinkedInventoryName: '7-Zip 26.01 (arm64)',
  },
  { label: 'Linux .deb', platform: 'linux', packageName: 'fleet-playwright-install_1.0.0_all.deb' },
  { label: 'macOS Fleet-maintained app', platform: 'darwin', fleetMaintainedName: 'Itsycal' },
  { label: 'Windows Fleet-maintained app', platform: 'windows', fleetMaintainedName: 'DB Browser for SQLite' },
];

export interface VmFixtureTitle {
  titleId: number;
  name: string;
  /** The installer's file name, as the install details name it. */
  packageName: string;
  /** See {@link VmSoftwareFixture.unlinkedInventoryName}. */
  unlinkedInventoryName?: string;
}

/** The fixture's title on the VMs fleet, or a failure saying how to restore it. */
export async function findVmFixtureTitle(
  request: APIRequestContext,
  fleetId: number,
  fixture: VmSoftwareFixture,
): Promise<VmFixtureTitle> {
  const missing = `${fixture.label} fixture is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml`;
  if (fixture.packageName) {
    const title = await findSoftwareTitleByPackageName(request, fleetId, fixture.packageName);
    expect(title, missing).not.toBeNull();
    return {
      titleId: title!.titleId,
      name: title!.name,
      packageName: title!.packageName,
      unlinkedInventoryName: fixture.unlinkedInventoryName,
    };
  }
  const title = (await listFleetMaintainedTitles(request, fleetId)).find(
    (t) => t.name === fixture.fleetMaintainedName && t.platform === fixture.platform,
  );
  expect(title, missing).toBeDefined();
  const packageName = (await getSoftwarePackage(request, fleetId, title!.titleId))?.name;
  expect(packageName, `${fixture.label} has no installer on the VMs fleet`).toBeTruthy();
  return { titleId: title!.titleId, name: title!.name, packageName: packageName! };
}

/** Whether the fixture is on the host, by whichever reading Fleet can give for it. */
export async function isVmFixtureInstalled(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
): Promise<boolean> {
  const state = await getHostSoftwareState(request, hostId, title.titleId);
  if (state?.status === 'installed' || (state?.installedVersions.length ?? 0) > 0) return true;
  return !!title.unlinkedInventoryName &&
    (await getHostInventoryVersions(request, hostId, title.unlinkedInventoryName)).length > 0;
}

/**
 * Returns the fixture to its resting state — uninstalled, and the host's
 * inventory agreeing — if it isn't there already.
 */
export async function ensureVmFixtureUninstalled(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
): Promise<void> {
  if (!(await isVmFixtureInstalled(request, hostId, title))) return;
  await uninstallSoftwareOnHost(request, hostId, title.titleId);
  await waitForSoftwareSettled(request, hostId, title.titleId, null, {
    inventoryName: title.unlinkedInventoryName,
  });
}
