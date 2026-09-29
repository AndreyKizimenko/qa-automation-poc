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
   * What the host's inventory calls it, when Fleet can't link the title to what
   * the host reports: its installed versions then stay empty, so whether it's
   * installed is read from the inventory by this name.
   */
  inventoryName?: string;
}

export const VM_SOFTWARE_FIXTURES: readonly VmSoftwareFixture[] = [
  { label: 'macOS .pkg', platform: 'darwin', packageName: 'fleet-playwright-install-1.0.0.pkg' },
  { label: 'Windows .msi', platform: 'windows', packageName: 'fleet-playwright-install-1.0.0.msi' },
  {
    label: 'Windows .exe',
    platform: 'windows',
    packageName: '7z2601-arm64.exe',
    // The title takes the installer's ProductName; Windows lists the program by
    // its DisplayName (by design, fleetdm/fleet#20440).
    inventoryName: '7-Zip 26.01 (arm64)',
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
  /** Whether Fleet can show this title's installed version. */
  linked: boolean;
  /** The name to look for in the host's inventory. */
  inventoryName: string;
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
      linked: !fixture.inventoryName,
      inventoryName: fixture.inventoryName ?? title!.name,
    };
  }
  const title = (await listFleetMaintainedTitles(request, fleetId)).find(
    (t) => t.name === fixture.fleetMaintainedName && t.platform === fixture.platform,
  );
  expect(title, missing).toBeDefined();
  const packageName = (await getSoftwarePackage(request, fleetId, title!.titleId))?.name;
  expect(packageName, `${fixture.label} has no installer on the VMs fleet`).toBeTruthy();
  return { titleId: title!.titleId, name: title!.name, packageName: packageName!, linked: true, inventoryName: title!.name };
}

/** Whether the fixture is on the host, by whichever reading Fleet can give for it. */
export async function isVmFixtureInstalled(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
): Promise<boolean> {
  if (!title.linked) return (await getHostInventoryVersions(request, hostId, title.inventoryName)).length > 0;
  const state = await getHostSoftwareState(request, hostId, title.titleId);
  return state?.status === 'installed' || (state?.installedVersions.length ?? 0) > 0;
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
    inventoryName: title.linked ? undefined : title.inventoryName,
  });
}
