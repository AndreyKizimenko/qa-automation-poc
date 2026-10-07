/**
 * Premium • Software • a "Deploy" whose install fails is retried, then reads Failed.
 *
 * Add a package with **Deploy** on, and Fleet creates an `[Install software]
 * <title> (<ext>)` policy whose automation installs it on every host missing it.
 * Here the package can't install — built for `amd64`, refused by the aarch64
 * Ubuntu VM's dpkg — so the policy keeps failing, and Fleet retries a failed
 * install a policy queued while the policy still fails for the host: 3 attempts
 * in all (`MaxPolicyAutomationRetries`; `shouldRetryPolicyAutomationSoftwareInstall`
 * in `server/service/orbit.go`), then *Failed* in the Library and "Fleet failed to
 * install …" in the Activity card.
 * A retry a policy queues is a different path from a direct install's
 * (`inventory-reflects-install.spec.ts`), and Fleet also counts these failures per
 * host and installer, giving up for 24 hours after 10
 * (`MaxPolicyAutomationInstallAttempts`) — so the package is new each run.
 *
 * **Why `exclusive/`.** Two things make it a bad neighbour on a shared VM, both
 * ways round:
 *   - Fleet queues what a policy automation installs at priority 0, below every
 *     user-requested install or script, and picks a host's next activity by
 *     priority before age. Beside the main project's install specs, its retries
 *     wait out the test's budget.
 *   - A failed install *script* puts orbit's config loop into a backoff — 1, 2, 4,
 *     then 5 min — that delays everything else queued on the host
 *     (TODO(fleetdm/fleet#54607); docs/blocked-by-product-bugs.md). Three
 *     failures in a row would stall every other spec's work on the Ubuntu VM.
 * The `premium-exclusive` project runs it alone, after the main project, and after
 * `policy-automation-runs` (files run in path order), so its own backoff delays
 * nothing that's measured.
 *
 * Premium only, on the VMs fleet. The package is built per run by
 * `helpers/deb.ts` and named `fleet-pw-deploy-fails-*`; it and its policy are
 * removed in the `finally`, and the VMs sweep removes what a dead run left. The
 * passing twin is `premium/software/install-on-host.spec.ts`.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { inertDeb } from '@helpers/deb';
import {
  cancelUpcomingActivity,
  deleteFleetPolicies,
  deleteSoftwareTitle,
  listFleetPolicies,
  listHostActivities,
  listUpcomingActivities,
  requireRealHost,
  requestHostRefetch,
  uploadSoftwarePackageBuffer,
  waitForHostSoftwareStatus,
  waitForNoPendingRefetch,
} from '@helpers/api';

test.describe('Premium • Software • Deploy install retries', () => {
  test.describe.configure({ retries: HOST_RETRIES });

  test('a Deploy whose install fails is tried 3 times, then reads Failed', async ({ hostDetails, vmsFleetId, request }) => {
    // Three install attempts, each followed by orbit's backoff (1, then 2 min).
    test.setTimeout(900_000);
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-deploy-fails-${Date.now().toString(36)}`;
    const policyName = `[Install software] ${name} (deb)`;

    const failures = async () =>
      (await listHostActivities(request, host.id, 100)).filter(
        (a) => a.type === 'installed_software' && a.details.software_title === name,
      );
    const queued = async () => (await listUpcomingActivities(request, host.id)).filter((u) => u.softwareTitle === name);

    let titleId: number | undefined;
    try {
      // Built for amd64: the aarch64 VM's dpkg refuses it, so every attempt fails
      // on the device without touching it — and the package never arriving is
      // what keeps the install policy failing, which a retry needs.
      ({ titleId } = await uploadSoftwarePackageBuffer(
        request,
        vmsFleetId,
        `${name}_1.0.0_amd64.deb`,
        inertDeb(name, '1.0.0', 'amd64'),
        {},
        { automaticInstall: true },
      ));
      const policy = (await listFleetPolicies(request, vmsFleetId)).find((p) => p.name === policyName);
      expect(policy, `no "${policyName}" policy on the VMs fleet`).toBeDefined();

      await waitForNoPendingRefetch(request, host.id);
      await requestHostRefetch(request, host.id);

      // Settled once nothing is queued: Fleet queues each retry in the same
      // request that records the failed attempt.
      await expect
        .poll(async () => ((await queued()).length > 0 ? -1 : (await failures()).length), {
          message: `3 failed installs of ${name}, none queued`,
          timeout: 600_000,
          intervals: [10_000],
        })
        .toBeGreaterThanOrEqual(3);
      const attempts = await failures();
      expect(attempts.map((a) => a.details.status)).toEqual(['failed_install', 'failed_install', 'failed_install']);
      for (const a of attempts) {
        expect(a.details.policy_id, 'each attempt is the install policy\'s').toBe(policy!.id);
        expect(a.actorEmail, 'a policy automation installs as Fleet, not as a user').toBe('');
      }
      await waitForHostSoftwareStatus(request, host.id, titleId, 'failed_install');

      // The host's Activity card names Fleet, and the Library says it failed.
      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      const activity = hostDetails.activityItem(activityCopy.hostSoftware.failedToInstall({ title: name }));
      await expect(activity.first()).toHaveAccessibleName(/^Fleet failed to install/);
      await hostDetails.openLibrary(name);
      await expect(hostDetails.library.statusButton(name, 'Failed')).toBeVisible();
    } finally {
      // The policy first: it would queue the install again, and Fleet won't delete
      // a title an install policy points at.
      const policies = (await listFleetPolicies(request, vmsFleetId)).filter((p) => p.name === policyName);
      await deleteFleetPolicies(request, vmsFleetId, policies.map((p) => p.id));
      for (const install of await queued()) await cancelUpcomingActivity(request, host.id, install.uuid);
      if (titleId !== undefined) await deleteSoftwareTitle(request, vmsFleetId, titleId);
    }
  });
});
