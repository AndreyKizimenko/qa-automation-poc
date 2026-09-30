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
 *     one at or above it must not. A sibling test takes that Update and checks
 *     the host lands level — and skips, saying so, on a day the host is already
 *     level, so the report shows which path ran.
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
import { test, expect, HOST_RETRIES } from '@fixtures';
import { inertDeb } from '@helpers/deb';
import {
  compareVersions,
  getHostSoftwareState,
  getSoftwarePackage,
  installSoftwareOnHost,
  listFleetMaintainedTitles,
  removeTitleFromHost,
  replaceSoftwarePackage,
  requireRealHost,
  setPinnedVersion,
  uploadSoftwarePackageBuffer,
  waitForSoftwareSettled,
  type HostSoftwareState,
} from '@helpers/api';
import type { APIRequestContext } from '@playwright/test';
import type { HostDetailsPage } from '@pages';

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

/**
 * The VM of `platform`, its Claude title on the VMs fleet and the host's state
 * for it — failing with the fix when Claude is missing from the fleet or the VM.
 * The state is recorded as a `claude-state` annotation, since whether the host
 * is behind decides which path the tests take.
 */
async function claudeOn(request: APIRequestContext, fleetId: number, platform: 'darwin' | 'windows') {
  const host = await requireRealHost(request, platform);
  const claude = (await listFleetMaintainedTitles(request, fleetId)).find(
    (t) => t.name === 'Claude' && t.platform === platform,
  );
  expect(claude, 'Claude is missing from the VMs fleet — re-apply gitops/premium-fleetqa/fleets/vms.yml').toBeDefined();
  const state = await getHostSoftwareState(request, host.id, claude!.titleId);
  expect(
    state?.installedVersions.length,
    `Claude isn't installed on ${host.displayName} — its "Claude is installed" policy reinstalls it at the ` +
      `VM's next policy run (a refetch triggers one)`,
  ).toBeGreaterThan(0);
  test.info().annotations.push({
    type: 'claude-state',
    description: `installed ${state!.installedVersions.join(', ')}, library ${state!.libraryVersion}`,
  });
  return { host, claude: claude!, state: state! };
}

test.describe('Premium • Software • Update on host', () => {
  test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES });

  test('a package the library moves ahead of is offered Update, and only then', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-update-${Date.now().toString(36)}`;
    const title = await uploadSoftwarePackageBuffer(
      request,
      vmsFleetId,
      `${name}_1.0.0_all.deb`,
      inertDeb(name, '1.0.0'),
    );

    try {
      await installSoftwareOnHost(request, host.id, title.titleId);
      await waitForSoftwareSettled(request, host.id, title.titleId, 'installed');
      await expectLibraryAction(hostDetails, host.id, name, 'Reinstall', { installed: '1.0.0', library: '1.0.0' });

      // The library moves behind the host: still no Update.
      await replaceSoftwarePackage(request, vmsFleetId, title.titleId, `${name}_0.9.0_all.deb`, inertDeb(name, '0.9.0'));
      await expectLibraryAction(hostDetails, host.id, name, 'Reinstall', { installed: '1.0.0', library: '0.9.0' });

      // The library moves ahead of the host: now Update.
      await replaceSoftwarePackage(request, vmsFleetId, title.titleId, `${name}_1.1.0_all.deb`, inertDeb(name, '1.1.0'));
      await expectLibraryAction(hostDetails, host.id, name, 'Update', { installed: '1.0.0', library: '1.1.0' });

      await hostDetails.library.install(name, 'Update');
      const after = await waitForSoftwareSettled(request, host.id, title.titleId, 'installed', { version: '1.1.0' });
      expect(after.installedVersions).toEqual(['1.1.0']);
      await expectLibraryAction(hostDetails, host.id, name, 'Reinstall', { installed: '1.1.0', library: '1.1.0' });
    } finally {
      await removeTitleFromHost(request, vmsFleetId, host.id, title.titleId);
    }
  });

  test.describe('Claude', () => {
    // The walk below pins the same title the state checks read, and the update
    // test changes what they see, so all five run one after another.
    test.describe.configure({ mode: 'serial' });

    for (const platform of ['darwin', 'windows'] as const) {
      test(`Claude on the ${platform} VM offers Update exactly when the library is ahead of it`, async ({
        hostDetails,
        vmsFleetId,
        request,
      }) => {
        const { host, state } = await claudeOn(request, vmsFleetId, platform);
        const behind = isBehind(state);

        await hostDetails.goto(host.id);
        await hostDetails.openLibrary('Claude');
        const library = hostDetails.library;
        await expect(await library.libraryVersion('Claude')).toHaveText(state.libraryVersion!);
        await expect(library.installAction('Claude', behind ? 'Update' : 'Reinstall')).toBeVisible();
        await expect(library.installAction('Claude', behind ? 'Reinstall' : 'Update')).toHaveCount(0);
      });

      test(`Claude on the ${platform} VM updates to the library's build when it is behind`, async ({
        hostDetails,
        vmsFleetId,
        request,
      }) => {
        const { host, claude, state } = await claudeOn(request, vmsFleetId, platform);
        // Only a vendor release since the last run puts the host behind.
        test.skip(
          !isBehind(state),
          `installed ${state.installedVersions.join(', ')} is level with library ${state.libraryVersion}`,
        );

        await hostDetails.goto(host.id);
        await hostDetails.openLibrary('Claude');
        await hostDetails.library.install('Claude', 'Update');
        const after = await waitForSoftwareSettled(request, host.id, claude.titleId, 'installed', {
          version: state.libraryVersion!,
        });
        expect(isBehind(after), `after updating, installed ${after.installedVersions} vs library ${after.libraryVersion}`).toBe(false);
        await hostDetails.goto(host.id);
        await hostDetails.openLibrary('Claude');
        await expect(hostDetails.library.installAction('Claude', 'Reinstall')).toBeVisible();
        await expect(hostDetails.library.installAction('Claude', 'Update')).toHaveCount(0);
      });
    }

    test('Claude on the macOS VM: pinned back it is ahead, installed it is level, unpinned it updates', async ({
      hostDetails,
      vmsFleetId,
      request,
    }) => {
      const { host, claude } = await claudeOn(request, vmsFleetId, 'darwin');

      // Needs the previous build in Fleet's cache, which only the vendor shipping
      // a newer one (and the hourly cron fetching it) can provide.
      test.skip(
        claude.versions.length < 2,
        `the VMs fleet has cached one Claude build (${claude.versions.join(', ')}); the walk needs the previous one too`,
      );
      const [newest, previous] = claude.versions;

      expect(
        (await getSoftwarePackage(request, vmsFleetId, claude.titleId))?.pinnedVersion,
        'Claude arrived pinned — an earlier run died before restoring it',
      ).toBe('');

      try {
        await setPinnedVersion(request, vmsFleetId, claude.titleId, previous);
        const ahead = await getHostSoftwareState(request, host.id, claude.titleId);
        await expectLibraryAction(hostDetails, host.id, 'Claude', 'Reinstall', {
          installed: ahead!.installedVersions[0],
          library: previous,
        });

        await installSoftwareOnHost(request, host.id, claude.titleId);
        const level = await waitForSoftwareSettled(request, host.id, claude.titleId, 'installed', {
          version: previous,
        });
        expect(level.installedVersions).toEqual([previous]);
        await expectLibraryAction(hostDetails, host.id, 'Claude', 'Reinstall', { installed: previous, library: previous });

        await setPinnedVersion(request, vmsFleetId, claude.titleId, '');
        await expectLibraryAction(hostDetails, host.id, 'Claude', 'Update', { installed: previous, library: newest });

        await hostDetails.library.install('Claude', 'Update');
        const after = await waitForSoftwareSettled(request, host.id, claude.titleId, 'installed', {
          version: newest,
        });
        expect(after.installedVersions).toEqual([newest]);
        await expectLibraryAction(hostDetails, host.id, 'Claude', 'Reinstall', { installed: newest, library: newest });
      } finally {
        await setPinnedVersion(request, vmsFleetId, claude.titleId, '');
      }
    });
  });
});
