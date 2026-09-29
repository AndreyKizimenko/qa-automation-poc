/**
 * Premium • Controls • Configuration profiles — who a label-targeted profile
 * reaches.
 *
 * A profile's target (Custom → Include any / all, Exclude) decides which hosts in
 * its fleet Fleet sends it to. The only honest way to test that is **set
 * membership** over hosts whose labels the test controls: this profile is listed
 * on exactly these hosts and none of the others. QA Wolf's flows asserted
 * `verifiedHostsCount >= 2` on a fleet-wide aggregate, which passes whether
 * targeting worked or not.
 *
 * **The hosts.** Each test works on the VMs fleet with the platform's real VM and
 * two MDM-enrolled simulations borrowed onto the fleet for the test
 * (`findMdmSimulations`, returned in the `finally` and by the cleanup sweep):
 *
 *  - which hosts Fleet *lists* a profile for is its server-side decision, and an
 *    MDM-enrolled simulation shows it as well as a VM: it lists every profile
 *    that targets it (a macOS simulation even acknowledges the install and sits
 *    at "verifying"), and none that doesn't. That is how a host of the same
 *    platform can be outside the label — there is only one real VM per platform;
 *  - what the host *does* with it — installed, verified, and the setting actually
 *    there — only the VM can answer, read back on the device and filtered to the
 *    profile's own domain or policy value.
 *
 * Labels are manual, so membership is exactly what the test set: the osquery-perf
 * pool answers every dynamic label's query, so a dynamic label holds whatever the
 * simulations happened to report. Membership is asserted over *our* hosts, never
 * over the fleet: an Exclude-only profile targets every other host on the fleet
 * too, including simulations another spec has borrowed.
 *
 * **Timing.** Fleet's profile reconciler runs every 30 s and decides every host in
 * the fleet for a profile in the same tick, so once the hosts expected to list it
 * do, the others have been decided too. A macOS profile reads *verified* only
 * after the host's next detail collection, so the test asks for a refetch.
 *
 * Every profile here is generated inert (`helpers/profiles.ts`): a preference
 * domain nothing reads on macOS, Game DVR off on Windows. The VMs fleet can hold
 * one generated Windows profile at a time — they all set the same LocURI — which
 * is why the Windows case is one profile edited, not several.
 */
import { test, expect } from '@fixtures';
import {
  createManualLabel,
  deleteLabelById,
  deleteProfile,
  findMdmSimulations,
  findProfileByName,
  getHostDetailUpdatedAt,
  listProfiles,
  profileListings,
  readManagedPreferenceDomain,
  readWindowsPolicyValue,
  requireRealHost,
  targetsFor,
  targetsOf,
  transferHosts,
  waitForHostProfileGone,
  waitForHostProfileStatus,
  waitForHostRefetch,
  waitForNoPendingRefetch,
  waitForProfileListings,
  type ProfileRecord,
} from '@helpers/api';
import {
  inertMobileconfig,
  inertWindowsProfile,
  runNonce,
  writeProfile,
  type InertAppleProfile,
} from '@helpers/profiles';
import type { ConfigurationProfilesPage, ControlsPage, DashboardPage, OsSettingsPage, ProfileTarget } from '@pages';

/** Which slice of the MDM-enrolled simulations this spec borrows (see `findMdmSimulations`). */
const SIM_OFFSET = 0;

async function openProfilesOnVmsFleet({ dashboard, controls, osSettings, configurationProfiles }: {
  dashboard: DashboardPage;
  controls: ControlsPage;
  osSettings: OsSettingsPage;
  configurationProfiles: ConfigurationProfilesPage;
}): Promise<void> {
  await dashboard.goto();
  await dashboard.navbar.goToControls();
  await controls.goToOsSettings();
  await osSettings.goToConfigurationProfiles();
  await configurationProfiles.teamDropdown.selectByLabel('VMs');
}

test.describe('Premium • Controls • Configuration profiles — label targeting', () => {
  test.describe.configure({ timeout: 900_000 });

  test('macOS: include all, include any + exclude, and exclude reach exactly the hosts their labels pick', async ({
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
    const label = { a: `pw-lt-${n}-a`, b: `pw-lt-${n}-b`, c: `pw-lt-${n}-c` };
    // a = VM + s1, b = VM + s2, c = s2 alone.
    const cases: Array<{ profile: InertAppleProfile; target: ProfileTarget; labels: string; expected: number[] }> = [
      {
        // Only the VM is in both labels.
        profile: inertMobileconfig(`pw-lt-${n}-all`),
        target: { include: { mode: 'all', labels: [label.a, label.b] } },
        labels: '2 labels',
        expected: [vm.id],
      },
      {
        // Everyone is in a or b; c takes s2 back out.
        profile: inertMobileconfig(`pw-lt-${n}-any`),
        target: { include: { mode: 'any', labels: [label.a, label.b] }, exclude: [label.c] },
        labels: '3 labels',
        expected: [vm.id, s1],
      },
      {
        // Only s2 is outside a — and the VM is excluded, so it never gets this one.
        profile: inertMobileconfig(`pw-lt-${n}-exclude`),
        target: { exclude: [label.a] },
        labels: '1 label',
        expected: [s2],
      },
    ];
    const [includeAll, includeAnyExclude, excludeOnly] = cases;
    const uploaded: ProfileRecord[] = [];
    const labelIds: number[] = [];

    try {
      await transferHosts(request, vmsFleetId, sims);
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));
      labelIds.push(await createManualLabel(request, label.c, [s2]));

      await openProfilesOnVmsFleet({ dashboard, controls, osSettings, configurationProfiles });
      for (const c of cases) {
        await configurationProfiles.uploadProfile(writeProfile(c.profile, testInfo.outputDir), c.target);
        await expect(configurationProfiles.itemByName(c.profile.name)).toBeVisible();
        await expect(configurationProfiles.labelCount(c.profile.name)).toHaveText(c.labels);
        // What the modal wrote is what Fleet stored.
        const stored = await findProfileByName(request, vmsFleetId, c.profile.name);
        expect(stored, `${c.profile.name} was not stored on the VMs fleet`).not.toBeNull();
        expect(targetsOf(stored!), c.profile.name).toEqual(targetsFor(c.target));
        uploaded.push(stored!);
      }

      // The Edit modal reads the target back: Custom, Include "Any" with a and b,
      // Exclude with c — and a label ticked on one tab can't be ticked on the other.
      await configurationProfiles.openEdit(includeAnyExclude.profile.name);
      const edit = configurationProfiles.editTargets;
      await expect(edit.customRadio).toBeChecked();
      await expect(edit.tabHasSelection('Include')).toBeVisible();
      await expect(edit.tabHasSelection('Exclude')).toBeVisible();
      await expect(edit.modeRadio('Include', 'any')).toBeChecked();
      await expect(edit.labelCheckbox(label.a, 'Include')).toBeChecked();
      await expect(edit.labelCheckbox(label.b, 'Include')).toBeChecked();
      await expect(edit.labelCheckbox(label.c, 'Include')).toBeDisabled();
      await edit.excludeTab.click();
      await expect(edit.labelCheckbox(label.c, 'Exclude')).toBeChecked();
      await expect(edit.labelCheckbox(label.a, 'Exclude')).toBeDisabled();
      await configurationProfiles.editCancelButton.click();
      await expect(configurationProfiles.editModal).toBeHidden();

      // Server-side: each profile is listed on exactly the hosts its labels pick.
      const expected = cases.map((c, i) => ({ profile: uploaded[i], hosts: c.expected }));
      await waitForProfileListings(request, ours, expected);

      // Host-side: the VM installs the two that include it; its next collection
      // verifies them.
      const [allRecord, anyRecord] = uploaded;
      for (const p of [allRecord, anyRecord]) {
        await waitForHostProfileStatus(request, vm.id, p.uuid, ['verifying', 'verified']);
      }
      await waitForNoPendingRefetch(request, vm.id);
      await waitForHostRefetch(request, vm.id, { since: await getHostDetailUpdatedAt(request, vm.id), refetch: true });
      for (const p of [allRecord, anyRecord]) {
        await waitForHostProfileStatus(request, vm.id, p.uuid, ['verified'], 180_000);
      }

      // On the device: both included profiles' settings are there, the excluded one's isn't.
      for (const c of [includeAll, includeAnyExclude]) {
        expect(await readManagedPreferenceDomain(request, vm.id, c.profile.domain), c.profile.name).toEqual({
          Marker: c.profile.marker,
        });
      }
      expect(await readManagedPreferenceDomain(request, vm.id, excludeOnly.profile.domain)).toEqual({});

      // The VM's Controls tab says the same.
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(includeAll.profile.name)).toContainText('Verified');
      await expect(hostDetails.controlRow(includeAnyExclude.profile.name)).toContainText('Verified');
      await expect(hostDetails.controlRow(excludeOnly.profile.name)).toHaveCount(0);

      // Nothing drifted while the VM installed: still exactly the same hosts.
      expect(await profileListings(request, ours, uploaded)).toEqual(
        Object.fromEntries(expected.map((e) => [e.profile.name, [...e.hosts].sort()])),
      );

      // Deleting a profile takes it off the VM.
      await openProfilesOnVmsFleet({ dashboard, controls, osSettings, configurationProfiles });
      await configurationProfiles.deleteProfile(includeAll.profile.name);
      await waitForHostProfileGone(request, vm.id, allRecord.uuid);
      await expect
        .poll(() => readManagedPreferenceDomain(request, vm.id, includeAll.profile.domain), {
          message: `${includeAll.profile.name}'s domain stayed on the VM after the profile was deleted`,
          timeout: 120_000,
          intervals: [10_000],
        })
        .toEqual({});
    } finally {
      for (const p of uploaded) await deleteProfile(request, p.uuid);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });

  test('Windows: include all + exclude reaches only the VM, and an edit that excludes it takes the profile back off', async ({
    dashboard,
    controls,
    osSettings,
    configurationProfiles,
    hostDetails,
    vmsFleetId,
    request,
  }, testInfo) => {
    const vm = await requireRealHost(request, 'windows');
    expect(vm.fleetId, 'the Windows VM must be on the VMs fleet').toBe(vmsFleetId);
    // Generated Windows profiles all set one LocURI: a second on the fleet would
    // be undone by this one's removal, and the other way round.
    const others = (await listProfiles(request, vmsFleetId)).filter((p) => p.platform === 'windows' && p.name.startsWith('pw-'));
    expect(others.map((p) => p.name), 'another generated Windows profile is on the VMs fleet').toEqual([]);
    const sims = await findMdmSimulations(request, 'windows', 2, SIM_OFFSET);
    expect(sims, 'needs two online, MDM-enrolled Windows simulations on Unassigned').toHaveLength(2);
    const [s1, s2] = sims;
    const ours = [vm.id, s1, s2];

    const n = runNonce();
    const label = { a: `pw-lt-${n}-wa`, b: `pw-lt-${n}-wb`, c: `pw-lt-${n}-wc` };
    const profile = inertWindowsProfile(`pw-lt-${n}-win`);
    let record: ProfileRecord | null = null;
    const labelIds: number[] = [];

    try {
      await transferHosts(request, vmsFleetId, sims);
      // a = all three, b = VM + s2, c = s2 alone.
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1, s2]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));
      labelIds.push(await createManualLabel(request, label.c, [s2]));

      const target: ProfileTarget = { include: { mode: 'all', labels: [label.a, label.b] }, exclude: [label.c] };
      await openProfilesOnVmsFleet({ dashboard, controls, osSettings, configurationProfiles });
      await configurationProfiles.uploadProfile(writeProfile(profile, testInfo.outputDir), target);
      await expect(configurationProfiles.labelCount(profile.name)).toHaveText('3 labels');
      record = await findProfileByName(request, vmsFleetId, profile.name);
      expect(record, `${profile.name} was not stored on the VMs fleet`).not.toBeNull();
      expect(targetsOf(record!)).toEqual(targetsFor(target));

      // s1 is only in a; s2 is in both, but c excludes it — which leaves the VM.
      await waitForProfileListings(request, ours, [{ profile: record!, hosts: [vm.id] }]);
      await waitForHostProfileStatus(request, vm.id, record!.uuid, ['verified']);
      expect(await readWindowsPolicyValue(request, vm.id, profile.policyArea, profile.policyName)).toBe(
        profile.appliedValue,
      );
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toContainText('Verified');

      // Re-target it to exclude b: the VM and s2 drop out, s1 comes in.
      const edit: ProfileTarget = { exclude: [label.b] };
      await openProfilesOnVmsFleet({ dashboard, controls, osSettings, configurationProfiles });
      await configurationProfiles.openEdit(profile.name);
      await configurationProfiles.updateTarget(edit);
      expect(targetsOf((await findProfileByName(request, vmsFleetId, profile.name))!)).toEqual(targetsFor(edit));
      await waitForProfileListings(request, ours, [{ profile: record!, hosts: [s1] }]);

      // Off the VM: Fleet removes it, and Windows puts the setting back to its default.
      await waitForHostProfileGone(request, vm.id, record!.uuid);
      await expect
        .poll(() => readWindowsPolicyValue(request, vm.id, profile.policyArea, profile.policyName), {
          message: `${profile.name}'s setting stayed applied on the VM after the edit excluded it`,
          timeout: 120_000,
          intervals: [10_000],
        })
        .not.toBe(profile.appliedValue);
      await hostDetails.goto(vm.id);
      await hostDetails.openControlsTab();
      await expect(hostDetails.controlRow(profile.name)).toHaveCount(0);
    } finally {
      if (record) await deleteProfile(request, record.uuid);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });
});
