/**
 * Premium • Controls • Configuration profiles — who a label-targeted DDM
 * declaration reaches.
 *
 * A declaration (`.json`) goes through the same Add profile modal and the same
 * label targets as a `.mobileconfig`, but Fleet stores its targeting in a table
 * of its own and delivers it over Apple's declarative management channel, not as
 * an InstallProfile command — so targeting a declaration is its own path to get
 * wrong. Three declarations side by side on the VMs fleet:
 *
 *  - no target ("All hosts") — every macOS host of ours;
 *  - Include **all** of two labels — only the VM;
 *  - Exclude one label — only a simulation; the VM never gets it.
 *
 * Asserted the way `profile-label-targets.spec.ts` asserts profiles, and for the
 * same reasons (see its header): set membership over the VM and two MDM-enrolled
 * simulations borrowed onto the fleet — the server-side decision a simulation
 * answers — and, for what the VM does, Fleet's *verified*, which for a
 * declaration is the device's own DDM status report. There is no osquery table
 * to read a test declaration back from.
 *
 * The declarations are Apple's no-op test type,
 * `com.apple.configuration.management.test` (`inertDeclaration`): an `Echo`
 * string and nothing else. Never an OS-update declaration on the VMs fleet: it
 * would make the real Mac download an update.
 *
 * A declaration whose target label is deleted is `profile-broken-labels.spec.ts`'s
 * declaration case: Fleet refuses the delete.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  createManualLabel,
  deleteLabelById,
  deleteProfile,
  findMdmSimulations,
  findProfileByName,
  profileListings,
  requireRealHost,
  targetsFor,
  targetsOf,
  transferHosts,
  waitForHostProfileGone,
  waitForHostProfileStatus,
  waitForProfileListings,
  type ProfileRecord,
} from '@helpers/api';
import { inertDeclaration, runNonce, writeProfile, type InertDeclaration } from '@helpers/profiles';
import type { ProfileTarget } from '@pages';

/** Which slice of the MDM-enrolled simulations this spec borrows (see `findMdmSimulations`). */
const SIM_OFFSET = 2;

test.describe('Premium • Controls • Configuration profiles — declarations', () => {
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  test('a declaration with no target, include all, or exclude reaches exactly the hosts its labels pick', async ({
    dashboard,
    controls,
    osSettings,
    configurationProfiles,
    hostDetails,
    vmsFleetId,
    request,
  }, testInfo) => {
    const vm = await requireRealHost(request, 'darwin');
    expect(vm.fleetId, 'the macOS VM must be on the VMs fleet').toBe(vmsFleetId);
    const sims = await findMdmSimulations(request, 'darwin', 2, SIM_OFFSET);
    expect(sims, 'needs two online, MDM-enrolled macOS simulations on Unassigned').toHaveLength(2);
    const [s1, s2] = sims;
    const ours = [vm.id, s1, s2];

    const n = runNonce();
    const label = { a: `pw-dc-${n}-a`, b: `pw-dc-${n}-b` };
    // a = VM + s1, b = VM + s2.
    const cases: Array<{ declaration: InertDeclaration; target?: ProfileTarget; labels?: string; expected: number[] }> = [
      { declaration: inertDeclaration(`pw-dc-${n}-every`), expected: [vm.id, s1, s2] },
      {
        declaration: inertDeclaration(`pw-dc-${n}-all`),
        target: { include: { mode: 'all', labels: [label.a, label.b] } },
        labels: '2 labels',
        expected: [vm.id],
      },
      {
        // Only s2 is outside a.
        declaration: inertDeclaration(`pw-dc-${n}-exclude`),
        target: { exclude: [label.a] },
        labels: '1 label',
        expected: [s2],
      },
    ];
    const [every, includeAll, excludeOnly] = cases;
    const uploaded: ProfileRecord[] = [];
    const labelIds: number[] = [];

    try {
      await transferHosts(request, vmsFleetId, sims);
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));

      await dashboard.goto();
      await dashboard.navbar.goToControls();
      await controls.goToOsSettings();
      await osSettings.goToConfigurationProfiles();
      await configurationProfiles.teamDropdown.selectByLabel('VMs');
      for (const c of cases) {
        await configurationProfiles.uploadProfile(writeProfile(c.declaration, testInfo.outputDir), c.target);
        const row = configurationProfiles.itemByName(c.declaration.name);
        // The row names the platform for a declaration apart from a .mobileconfig.
        await expect(row).toContainText('macOS, iOS, iPadOS (declaration)');
        if (c.labels) await expect(configurationProfiles.labelCount(c.declaration.name)).toHaveText(c.labels);
        else await expect(configurationProfiles.labelCount(c.declaration.name)).toHaveCount(0);
        const stored = await findProfileByName(request, vmsFleetId, c.declaration.name);
        expect(stored, `${c.declaration.name} was not stored on the VMs fleet`).not.toBeNull();
        expect(targetsOf(stored!), c.declaration.name).toEqual(targetsFor(c.target ?? {}));
        uploaded.push(stored!);
      }

      // Server-side: each declaration is listed on exactly the hosts its labels pick.
      const expected = cases.map((c, i) => ({ profile: uploaded[i], hosts: c.expected }));
      await waitForProfileListings(request, ours, expected);

      // Host-side: the VM reports the two that include it active.
      const [everyRecord, allRecord] = uploaded;
      for (const d of [everyRecord, allRecord]) {
        await waitForHostProfileStatus(request, vm.id, d.uuid, ['verified']);
      }
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(every.declaration.name)).toContainText('Verified');
      await expect(hostDetails.controlRow(includeAll.declaration.name)).toContainText('Verified');
      await expect(hostDetails.controlRow(excludeOnly.declaration.name)).toHaveCount(0);

      // Nothing drifted while the VM took them: still exactly the same hosts.
      expect(await profileListings(request, ours, uploaded)).toEqual(
        Object.fromEntries(expected.map((e) => [e.profile.name, [...e.hosts].sort((a, b) => a - b)])),
      );

      // Deleting one takes it off the VM.
      await configurationProfiles.goto({ fleetId: vmsFleetId });
      await configurationProfiles.teamDropdown.selectByLabel('VMs');
      await configurationProfiles.deleteProfile(includeAll.declaration.name);
      await waitForHostProfileGone(request, vm.id, allRecord.uuid);
    } finally {
      for (const d of uploaded) await deleteProfile(request, d.uuid);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });
});
