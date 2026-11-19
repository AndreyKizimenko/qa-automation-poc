/**
 * Premium • Software • A patch policy brings a Fleet-maintained app up to date on a real Mac.
 *
 * `premium/software/patch-policy.spec.ts` checks what each patch option stores, on a fleet with no hosts. This
 * spec runs one to the end, on a pool Mac with Itsycal, the VMs fleet's durable macOS Fleet-maintained app:
 *
 *   1. **The Mac runs the previous build.** Itsycal is pinned to the older of its two cached builds (an exact
 *      pin, Versions modal's "Pin to …"), and installed.
 *   2. **Deploy → Patch adds the patch policy, and the Mac passes it.** Its default option, "Patch when app is
 *      closed", installs on failure. A patch policy's query is generated from the title's *active* build: it
 *      passes while no installed copy is older than that build, and on a host without the app
 *      (`pkg/patch_policy`, `defaultMacOSQuery`). Pinned, the active build is the one the Mac runs, so it passes.
 *   3. **Versions → "Automatically update to latest".** The newest build becomes the active one, and Fleet
 *      regenerates the policy's query on the spot and clears its results (`SetFleetMaintainedAppActiveInstaller`).
 *      The Mac's next result fails; a newly failing result fires the automation, which installs the newest build
 *      (the activity carries the policy's id); after the install's refetch the Mac passes again.
 *   4. **Host details** shows the policy passing and the newest build installed, with no Update offered.
 *
 * Needs two cached builds, which only a vendor release since the fleet was provisioned gives (Fleet's hourly
 * `maintained_apps_auto_update` cron keeps the previous one): with one, it skips, saying so. Itsycal had
 * 0.15.15 and 0.15.14 on 2026-11-18. Windows has no such walk yet: the VMs fleet's Windows apps are Claude,
 * an MSIX that Windows won't take back to an older build, and DB Browser for SQLite, with one build cached.
 *
 * **What it leaves, and who removes it.** The `cleanup` fixture deletes the patch policy, unpins Itsycal, and
 * returns it to its resting state, uninstalled. A killed run's patch policy is the VMs sweep's
 * (`setup/cleanup.steps.ts` deletes every patch policy there: gitops declares none), its pin the stranded-pin
 * step's, and the installed app the resting-state step's.
 *
 * **Why `exclusive/`.** Fleet runs a policy automation's install at priority 0, below every install a user
 * asks for, so beside the main project's install specs it would wait out its budget. Alone after the main
 * project, the VMs fleet holds only the pool, and the policy (macOS only) reaches the two Macs: the other one,
 * without Itsycal, passes it and gets nothing. The pin is the fleet's too, and `software-lifecycle-on-host`
 * installs Itsycal at whatever build the library offers, which is the other reason this can't run beside it.
 *
 * Takes the release checklist's "patch policy fails on an outdated host and installs the update"
 * (`docs/release-smokes-plan.md`, P1.4).
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  findPatchPolicy,
  deleteFleetPolicies,
  getHostCollectedAt,
  getHostPolicyResponses,
  getSoftwarePackage,
  installSoftwareOnHost,
  latestActivityId,
  listFleetMaintainedTitles,
  listHostActivities,
  requestHostRefetch,
  requireRealHost,
  setPinnedVersion,
  waitForHostRefetch,
  waitForNoPendingRefetch,
  waitForSoftwareSettled,
} from '@helpers/api';
import { toastCopy } from '@helpers/toast-copy';
import { ensureVmFixtureUninstalled, findVmFixtureTitle, VM_SOFTWARE_FIXTURES } from '@helpers/vm-fixtures';
import type { APIRequestContext } from '@playwright/test';

const ITSYCAL = VM_SOFTWARE_FIXTURES.find((f) => f.fleetMaintainedName === 'Itsycal')!;

/**
 * Asks the host for its policies again and waits until its answer to `policyId` is `response`. A refetch re-runs
 * the host's policies at once; one is asked for only while none is outstanding, since a new request merges into
 * a running one (`waitForNoPendingRefetch`).
 */
async function waitForPolicyResponse(
  request: APIRequestContext,
  hostId: number,
  policyId: number,
  response: 'pass' | 'fail',
  timeout = 300_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const answer = (await getHostPolicyResponses(request, hostId)).get(policyId) ?? '';
        if (answer !== response) {
          await waitForNoPendingRefetch(request, hostId);
          const since = await getHostCollectedAt(request, hostId, 'policy_updated_at');
          await requestHostRefetch(request, hostId);
          await waitForHostRefetch(request, hostId, { since, field: 'policy_updated_at' });
          return (await getHostPolicyResponses(request, hostId)).get(policyId) ?? '';
        }
        return answer;
      },
      { message: `host ${hostId} never answered policy ${policyId} with "${response}"`, timeout, intervals: [1_000] },
    )
    .toBe(response);
}

test.describe('Premium • Software • A patch policy on a real Mac', () => {
  test.describe.configure({ timeout: 1_200_000, retries: HOST_RETRIES });

  test('an outdated Fleet-maintained app fails its patch policy, which installs the newest build, then passes', { tag: '@vm-macos' }, async ({
    softwareTitleDetail,
    hostDetails,
    vmsFleetId,
    request,
    cleanup,
  }) => {
    const host = await requireRealHost(request, 'darwin');
    const fixture = await findVmFixtureTitle(request, vmsFleetId, ITSYCAL);
    const cached = (await listFleetMaintainedTitles(request, vmsFleetId)).find((t) => t.titleId === fixture.titleId)!.versions;
    test.skip(cached.length < 2, `the VMs fleet has cached one ${fixture.name} build (${cached.join(', ')}); the walk needs the previous one too`);
    const [newest, previous] = cached;
    test.info().annotations.push({ type: 'builds', description: `${fixture.name} ${previous} → ${newest} on ${host.displayName}` });

    expect((await getSoftwarePackage(request, vmsFleetId, fixture.titleId))?.pinnedVersion, `${fixture.name} arrived pinned`).toBe('');
    expect(await findPatchPolicy(request, vmsFleetId, fixture.titleId), `${fixture.name} arrived with a patch policy`).toBeNull();
    // Registered first, so they run last: the policy goes before the pin is cleared and the app uninstalled.
    cleanup.add(`return ${fixture.name} to rest on ${host.displayName}`, (r) => ensureVmFixtureUninstalled(r, host.id, fixture));
    cleanup.add(`unpin ${fixture.name}`, (r) => setPinnedVersion(r, vmsFleetId, fixture.titleId, ''));

    await test.step(`the Mac runs the previous build, ${previous}`, async () => {
      await setPinnedVersion(request, vmsFleetId, fixture.titleId, previous);
      await installSoftwareOnHost(request, host.id, fixture.titleId);
      const state = await waitForSoftwareSettled(request, host.id, fixture.titleId, 'installed', { version: previous, timeout: 480_000 });
      expect(state.installedVersions).toEqual([previous]);
    });

    const policy = await test.step('Deploy → Patch adds the patch policy, and the Mac passes it', async () => {
      await softwareTitleDetail.goto({ titleId: fixture.titleId, fleetId: vmsFleetId });
      await softwareTitleDetail.openDeploy();
      await softwareTitleDetail.deploy.setPatch(true);
      await expect(softwareTitleDetail.deploy.patchOption('Patch when app is closed')).toBeChecked();
      await softwareTitleDetail.saveDeploy();
      await softwareTitleDetail.toast.expectSuccess(toastCopy.software.deployUpdated);
      const created = await findPatchPolicy(request, vmsFleetId, fixture.titleId);
      expect(created, 'Deploy → Patch stored no patch policy').not.toBeNull();
      cleanup.add(`delete ${created!.name}`, (r) => deleteFleetPolicies(r, vmsFleetId, [created!.id]));
      expect(created!.patchWhenClosed).toBe(true);
      await waitForPolicyResponse(request, host.id, created!.id, 'pass');
      return created!;
    });

    const since = await latestActivityId(request);

    await test.step('Versions → "Automatically update to latest": the policy fails, and its automation installs the newest build', async () => {
      await softwareTitleDetail.goto({ titleId: fixture.titleId, fleetId: vmsFleetId });
      await softwareTitleDetail.openVersions();
      await softwareTitleDetail.versionsModal.select({ kind: 'latest' });
      await softwareTitleDetail.versionsModal.save(fixture.name);
      expect((await getSoftwarePackage(request, vmsFleetId, fixture.titleId))?.pinnedVersion).toBe('');

      // The result that fires the automation: the first one since the query was regenerated.
      await waitForNoPendingRefetch(request, host.id);
      const policiesAt = await getHostCollectedAt(request, host.id, 'policy_updated_at');
      await waitForHostRefetch(request, host.id, { since: policiesAt, field: 'policy_updated_at', refetch: true });

      await expect
        .poll(
          async () =>
            (await listHostActivities(request, host.id)).find(
              (a) => a.id > since && a.type === 'installed_software' && a.details.policy_id === policy.id,
            )?.details.status,
          { message: `${policy.name} never installed ${fixture.name} on ${host.displayName}`, timeout: 600_000, intervals: [10_000] },
        )
        .toBe('installed');
      const state = await waitForSoftwareSettled(request, host.id, fixture.titleId, 'installed', { version: newest });
      expect(state.installedVersions).toEqual([newest]);
      await waitForPolicyResponse(request, host.id, policy.id, 'pass');
    });

    await test.step('Host details: the policy passes, and the newest build is installed with no Update offered', async () => {
      await hostDetails.goto(host.id);
      await hostDetails.openPoliciesTab();
      await expect(hostDetails.policyRow(policy.name)).toContainText('Pass');
      await hostDetails.openLibrary(fixture.name);
      await expect(await hostDetails.library.installedVersion(fixture.name)).toHaveText(newest);
      await expect(await hostDetails.library.libraryVersion(fixture.name)).toHaveText(newest);
      await expect(hostDetails.library.installAction(fixture.name, 'Update')).toHaveCount(0);
    });
  });
});
