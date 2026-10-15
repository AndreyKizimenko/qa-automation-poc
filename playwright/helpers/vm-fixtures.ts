// The software the VMs fleet keeps for the install/uninstall specs. Declared in
// gitops/premium-fleetqa/fleets/vms.yml — this list names the same entries, and
// the two change together. The titles never leave the fleet, so Fleet always
// knows whether each is installed; their resting state is uninstalled, with no
// failed install or uninstall on record (see ensureVmFixtureUninstalled).
import { APIRequestContext, expect } from '@playwright/test';
import {
  findSoftwareTitleByPackageName,
  getHostCollectedAt,
  getHostInventoryVersions,
  getHostSoftwareState,
  getSoftwarePackage,
  installSoftwareOnHost,
  listFleetMaintainedTitles,
  uninstallSoftwareOnHost,
  waitForHostRefetch,
  waitForHostSoftwareStatus,
  waitForNoPendingRefetch,
  waitForSoftwareSettled,
  type HostSoftwareState,
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

/** Whether the host's inventory lists the fixture, by whichever reading Fleet can give for it. */
async function isVmFixtureListed(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
  state: HostSoftwareState,
): Promise<boolean> {
  if (state.installedVersions.length > 0) return true;
  return !!title.unlinkedInventoryName &&
    (await getHostInventoryVersions(request, hostId, title.unlinkedInventoryName)).length > 0;
}

/** The fixture's state on the host once no install or uninstall of it is queued or running. */
async function stateWhenIdle(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
): Promise<HostSoftwareState | null> {
  let state: HostSoftwareState | null = null;
  await expect
    .poll(
      async () => {
        state = await getHostSoftwareState(request, hostId, titleId);
        return state?.status?.startsWith('pending_') ?? false;
      },
      { message: `title ${titleId} stayed queued on host ${hostId}`, timeout: 300_000, intervals: [5_000] },
    )
    .toBe(false);
  return state;
}

/**
 * Whether the host still lists the fixture once a collection asked for now has
 * landed. The refetch Fleet queues after an install or uninstall is waited out
 * first, since one asked for meanwhile merges into it; and a refetch's software
 * results can be stored seconds after its details, so the listing is given half
 * a minute to drop.
 */
async function isVmFixtureListedAfterCollection(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
): Promise<boolean> {
  await waitForNoPendingRefetch(request, hostId);
  const since = await getHostCollectedAt(request, hostId, 'detail_updated_at');
  await waitForHostRefetch(request, hostId, { since, refetch: true });
  return expect
    .poll(
      async () => {
        const state = await getHostSoftwareState(request, hostId, title.titleId);
        return !!state && (await isVmFixtureListed(request, hostId, title, state));
      },
      { timeout: 30_000, intervals: [5_000] },
    )
    .toBe(false)
    .then(
      () => false,
      () => true,
    );
}

/**
 * Returns the fixture to its resting state: nothing on record for it on the host
 * (status null, which the Library offers as "Install") and the host's inventory
 * agreeing.
 *
 *  - A queued or running install or uninstall is waited out before anything is
 *    decided.
 *  - `installed` → uninstall.
 *  - `failed_install` / `failed_uninstall` → install, then uninstall. Fleet keeps
 *    the last action's result as the title's status until another action
 *    replaces it, and offers Retry or Reinstall for a failed one. An uninstall
 *    alone can't clear it when the software isn't on the host: the uninstall
 *    script has nothing to remove and fails again (apt exits 100). Installing
 *    over software that is there is harmless.
 *  - No status, but the inventory lists it → decided after a fresh collection.
 *    Right after a clean uninstall the status is already null while the inventory
 *    still lists the software, until Fleet's post-uninstall refetch lands; an
 *    uninstall queued on that reading fails and leaves `failed_uninstall`. Only a
 *    listing that survives the collection is uninstalled.
 */
export async function ensureVmFixtureUninstalled(
  request: APIRequestContext,
  hostId: number,
  title: VmFixtureTitle,
): Promise<void> {
  const state = await stateWhenIdle(request, hostId, title.titleId);
  if (!state) return;
  if (state.status === 'failed_install' || state.status === 'failed_uninstall') {
    console.warn(`[vm fixture] ${title.name} is ${state.status} on host ${hostId} — installing and uninstalling it to clear that`);
    await installSoftwareOnHost(request, hostId, title.titleId);
    await waitForHostSoftwareStatus(request, hostId, title.titleId, 'installed');
  } else if (state.status !== 'installed') {
    if (!(await isVmFixtureListed(request, hostId, title, state))) return;
    if (!(await isVmFixtureListedAfterCollection(request, hostId, title))) return;
  }
  await uninstallSoftwareOnHost(request, hostId, title.titleId);
  await waitForSoftwareSettled(request, hostId, title.titleId, null, {
    inventoryName: title.unlinkedInventoryName,
  });
}
