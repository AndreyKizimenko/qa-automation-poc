/**
 * Premium • Software • The host Library's Update button.
 *
 * The contract, per Library row:
 *
 *   - **Update** is offered only when the library's version is *higher* than
 *     what the host has installed;
 *   - when they're equal — or the host is ahead — there is no Update, only
 *     Reinstall;
 *   - after an update and the host's next inventory read, installed and library
 *     versions match and Update is gone.
 *
 * Fleet derives the button from `compareVersions(installed, library)`
 * (`getUiStatus` → `getInstallerActionButtonConfig`), and it pads missing
 * segments with zeros — so Windows reporting `2.7032.0.0` against a library
 * `2.7032.0` is level, not behind.
 *
 * ## Two subjects
 *
 * **A package pair built per run** (Linux) drives the whole contract on demand:
 * install 1.0.0, then swap the library's package for 1.1.0 and for 0.9.0. It's
 * deterministic and needs nothing from anyone upstream.
 *
 * **Claude**, kept installed on the macOS and Windows VMs by
 * `gitops/premium-fleetqa/fleets/vms.yml`, is the durable subject — a real
 * Fleet-maintained app whose library version moves when its vendor ships. Two
 * tests use it:
 *
 *   - the contract holds for whatever state the fleet is in right now, on both
 *     platforms: an installed build below the library's must offer Update and
 *     one at or above it must not. When the library is ahead, the test also
 *     takes the update and checks the host lands level.
 *   - on macOS, the full walk: pin the library to the previous cached build so
 *     the host is ahead, install that build so they're level, unpin so the host
 *     is behind, and Update. It needs a second cached build, which Fleet's
 *     hourly `maintained_apps_auto_update` cron keeps once the vendor has
 *     shipped one since the fleet was provisioned — so it skips, saying why,
 *     until then. Windows doesn't take this walk: Claude for Windows is an MSIX,
 *     and Windows refuses to provision an older MSIX over a newer one.
 *
 * **Restore the pin.** An exact pin stops the cron for that title, which freezes
 * the version history the second test depends on. The test unpins in a
 * `finally`, and because Playwright aborts a timed-out test before its `finally`
 * runs, `setup/cleanup.steps.ts` also clears any pin it finds on this fleet at
 * the start of every run.
 */
import { test, expect } from '@fixtures';
import { inertDeb } from '@helpers/deb';
import {
  findOnlineHost,
  getHostSoftwareState,
  getSoftwarePackage,
  installSoftwareOnHost,
  listFleetMaintainedTitles,
  removeTitleFromHost,
  replaceSoftwarePackage,
  setPinnedVersion,
  uploadSoftwarePackageBuffer,
  waitForSoftwareSettled,
  type HostSoftwareState,
} from '@helpers/api';
import type { HostDetailsPage } from '@pages';

/** Fleet's own rule: segment by segment, missing segments read as 0. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** Update iff any installed version is below the library's. */
const isBehind = (state: HostSoftwareState): boolean =>
  !!state.libraryVersion &&
  state.installedVersions.some((v) => compareVersions(v, state.libraryVersion!) < 0);

/**
 * Opens the host's Library on `title` and asserts the one install-side action
 * the versions call for — and that the other isn't offered.
 */
async function expectLibraryAction(
  hostDetails: HostDetailsPage,
  hostId: number,
  title: string,
  expected: 'Update' | 'Reinstall',
  versions: { installed: string; library: string },
) {
  await hostDetails.goto(hostId);
  await hostDetails.openLibrary(title);
  const library = hostDetails.library;
  await expect(await library.installedVersion(title)).toHaveText(versions.installed);
  await expect(await library.libraryVersion(title)).toHaveText(versions.library);
  await expect(library.installAction(title, expected)).toBeVisible();
  await expect(library.installAction(title, expected === 'Update' ? 'Reinstall' : 'Update')).toHaveCount(0);
}

test.describe('Premium • Software • Update on host', () => {
  test.describe.configure({ timeout: 600_000 });

  test('a package the library moves ahead of is offered Update, and only then', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await findOnlineHost(request, 'linux', { kind: 'real' });
    expect(host, 'expected an online real Linux VM').not.toBeNull();
    const name = `fleet-pw-update-${Date.now().toString(36)}`;
    const title = await uploadSoftwarePackageBuffer(
      request,
      vmsFleetId,
      `${name}_1.0.0_all.deb`,
      inertDeb(name, '1.0.0'),
    );

    try {
      await installSoftwareOnHost(request, host!.id, title.titleId);
      await waitForSoftwareSettled(request, host!.id, title.titleId, 'installed');
      await expectLibraryAction(hostDetails, host!.id, name, 'Reinstall', { installed: '1.0.0', library: '1.0.0' });

      // The library moves behind the host: still no Update.
      await replaceSoftwarePackage(request, vmsFleetId, title.titleId, `${name}_0.9.0_all.deb`, inertDeb(name, '0.9.0'));
      await expectLibraryAction(hostDetails, host!.id, name, 'Reinstall', { installed: '1.0.0', library: '0.9.0' });

      // The library moves ahead of the host: now Update.
      await replaceSoftwarePackage(request, vmsFleetId, title.titleId, `${name}_1.1.0_all.deb`, inertDeb(name, '1.1.0'));
      await expectLibraryAction(hostDetails, host!.id, name, 'Update', { installed: '1.0.0', library: '1.1.0' });

      await hostDetails.library.install(name, 'Update');
      const after = await waitForSoftwareSettled(request, host!.id, title.titleId, 'installed', { version: '1.1.0' });
      expect(after.installedVersions).toEqual(['1.1.0']);
      await expectLibraryAction(hostDetails, host!.id, name, 'Reinstall', { installed: '1.1.0', library: '1.1.0' });
    } finally {
      await removeTitleFromHost(request, vmsFleetId, host!.id, title.titleId);
    }
  });

  test.describe('Claude', () => {
    // The walk below pins the same title the state checks read, so the three run
    // one after another.
    test.describe.configure({ mode: 'serial' });

    for (const platform of ['darwin', 'windows'] as const) {
      test(`Claude on the ${platform} VM offers Update exactly when the library is ahead of it`, async ({
        hostDetails,
        vmsFleetId,
        request,
      }) => {
        const host = await findOnlineHost(request, platform, { kind: 'real' });
        expect(host, `expected an online real ${platform} VM`).not.toBeNull();
        const claude = (await listFleetMaintainedTitles(request, vmsFleetId)).find(
          (t) => t.name === 'Claude' && t.platform === platform,
        );
        expect(claude, 'Claude is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml').toBeDefined();

        const state = await getHostSoftwareState(request, host!.id, claude!.titleId);
        expect(
          state?.installedVersions.length,
          `Claude isn't installed on ${host!.displayName} — its "Claude is installed" policy reinstalls it at the ` +
            `VM's next policy run (a refetch triggers one)`,
        ).toBeGreaterThan(0);

        const behind = isBehind(state!);
        test.info().annotations.push({
          type: 'claude-state',
          description: `installed ${state!.installedVersions.join(', ')}, library ${state!.libraryVersion}`,
        });

        await hostDetails.goto(host!.id);
        await hostDetails.openLibrary('Claude');
        const library = hostDetails.library;
        await expect(await library.libraryVersion('Claude')).toHaveText(state!.libraryVersion!);
        await expect(library.installAction('Claude', behind ? 'Update' : 'Reinstall')).toBeVisible();
        await expect(library.installAction('Claude', behind ? 'Reinstall' : 'Update')).toHaveCount(0);

        if (behind) {
          await library.install('Claude', 'Update');
          const after = await waitForSoftwareSettled(request, host!.id, claude!.titleId, 'installed', {
            version: state!.libraryVersion!,
          });
          expect(isBehind(after), `after updating, installed ${after.installedVersions} vs library ${after.libraryVersion}`).toBe(false);
          await hostDetails.goto(host!.id);
          await hostDetails.openLibrary('Claude');
          await expect(library.installAction('Claude', 'Reinstall')).toBeVisible();
          await expect(library.installAction('Claude', 'Update')).toHaveCount(0);
        }
      });
    }

    test('Claude on the macOS VM: pinned back it is ahead, installed it is level, unpinned it updates', async ({
      hostDetails,
      vmsFleetId,
      request,
    }) => {
      const host = await findOnlineHost(request, 'darwin', { kind: 'real' });
      expect(host, 'expected an online real macOS VM').not.toBeNull();
      const claude = (await listFleetMaintainedTitles(request, vmsFleetId)).find(
        (t) => t.name === 'Claude' && t.platform === 'darwin',
      );
      expect(claude, 'Claude is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml').toBeDefined();

      // Needs the previous build in Fleet's cache, which only the vendor shipping
      // a newer one (and the hourly cron fetching it) can provide.
      test.skip(
        claude!.versions.length < 2,
        `the VMs fleet has cached one Claude build (${claude!.versions.join(', ')}); the walk needs the previous one too`,
      );
      const [newest, previous] = claude!.versions;

      expect(
        (await getSoftwarePackage(request, vmsFleetId, claude!.titleId))?.pinnedVersion,
        'Claude arrived pinned — an earlier run died before restoring it',
      ).toBe('');

      try {
        await setPinnedVersion(request, vmsFleetId, claude!.titleId, previous);
        const ahead = await getHostSoftwareState(request, host!.id, claude!.titleId);
        await expectLibraryAction(hostDetails, host!.id, 'Claude', 'Reinstall', {
          installed: ahead!.installedVersions[0],
          library: previous,
        });

        await installSoftwareOnHost(request, host!.id, claude!.titleId);
        const level = await waitForSoftwareSettled(request, host!.id, claude!.titleId, 'installed', {
          version: previous,
        });
        expect(level.installedVersions).toEqual([previous]);
        await expectLibraryAction(hostDetails, host!.id, 'Claude', 'Reinstall', { installed: previous, library: previous });

        await setPinnedVersion(request, vmsFleetId, claude!.titleId, '');
        await expectLibraryAction(hostDetails, host!.id, 'Claude', 'Update', { installed: previous, library: newest });

        await hostDetails.library.install('Claude', 'Update');
        const after = await waitForSoftwareSettled(request, host!.id, claude!.titleId, 'installed', {
          version: newest,
        });
        expect(after.installedVersions).toEqual([newest]);
        await expectLibraryAction(hostDetails, host!.id, 'Claude', 'Reinstall', { installed: newest, library: newest });
      } finally {
        await setPinnedVersion(request, vmsFleetId, claude!.titleId, '');
      }
    });
  });
});
