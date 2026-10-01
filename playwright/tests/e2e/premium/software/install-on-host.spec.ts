/**
 * Premium • Software • "Deploy": installing through the policy Fleet creates.
 *
 * Add a package with **Deploy** switched on, and Fleet creates an
 * `[Install software] <title> (<ext>)` policy whose automation installs it on
 * every host that fails it — every host missing it. Both tests follow that on
 * the Ubuntu VM:
 *
 *   - **It installs.** The policy exists and is announced in the feed, the VM
 *     fails it at its next policy run, and Fleet installs the package — "Fleet
 *     installed …" in the host's Past activity.
 *   - **It fails, and is retried.** A package the VM can't install leaves the
 *     policy failing, and Fleet retries a failed install a policy queued while
 *     the policy still fails for the host: 3 attempts in all
 *     (`MaxPolicyAutomationRetries`; `shouldRetryPolicyAutomationSoftwareInstall`
 *     in `server/service/orbit.go`), then *Failed* in the Library. QA Wolf's
 *     `software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation`.
 *     A retry queued by a policy is a different path from a direct install's
 *     (`inventory-reflects-install.spec.ts`), and Fleet also counts these failures
 *     per host and installer, giving up for 24 hours after 10
 *     (`MaxPolicyAutomationInstallAttempts`) — so the package must be new each run.
 *
 * Premium only, on the real VMs of the **VMs** fleet. The packages are built per
 * run by `helpers/deb.ts` and named `fleet-pw-deploy-*`: each test adds one and a
 * policy that points at it, so it can't be one of the fleet's durable fixtures.
 * Both are removed in a `finally`, and the cleanup sweep removes what a dead run
 * left. Installing and uninstalling the durable fixtures is
 * `software-lifecycle-on-host.spec.ts`.
 */
import * as fs from 'fs';
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
  removeTitleFromHost,
  requireRealHost,
  requestHostRefetch,
  uploadSoftwarePackageBuffer,
  waitForHostSoftwareStatus,
  waitForNoPendingRefetch,
} from '@helpers/api';
import type { DashboardPage, SoftwareTitlesPage } from '@pages';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Dashboard → Software → the VMs fleet → Add software. */
async function openAddSoftware(dashboard: DashboardPage, softwareTitles: SoftwareTitlesPage) {
  await dashboard.goto();
  await dashboard.navbar.goToSoftware();
  await softwareTitles.teamDropdown.selectByLabel('VMs');
  await softwareTitles.clickAddSoftware();
}

test.describe('Premium • Software • Install on host', () => {
  test.describe.configure({ retries: HOST_RETRIES });

  test('"Deploy" creates an install policy, and Fleet installs through it on the Linux VM', async ({
    dashboard,
    softwareTitles,
    softwareCustomPackage,
    softwareTitleDetail,
    hostDetails,
    vmsFleetId,
    request,
  }, testInfo) => {
    // The longest test here: an upload, a policy run and an automatic install on
    // a VM other specs queue work on, then its cleanup.
    test.setTimeout(900_000);
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-deploy-${Date.now().toString(36)}`;
    const file = testInfo.outputPath(`${name}_1.0.0_all.deb`);
    fs.writeFileSync(file, inertDeb(name, '1.0.0'));
    const policyName = `[Install software] ${name} (deb)`;

    let titleId: number | undefined;
    try {
      await openAddSoftware(dashboard, softwareTitles);
      await softwareCustomPackage.openTab();
      titleId = await softwareCustomPackage.uploadPackage(file, { deploy: true });
      await expect(softwareTitleDetail.displayHeading).toHaveText(name);

      // Fleet wrote the policy that does the deploying, on this fleet, and says so
      // in the feed. The activity carries no fleet (the automatic-install path
      // logs `created_policy` without `team_id`), so it reads without the "on
      // the VMs fleet" a hand-made fleet policy's does.
      const policy = (await listFleetPolicies(request, vmsFleetId)).find((p) => p.name === policyName);
      expect(policy, `no "${policyName}" policy on the VMs fleet`).toBeDefined();
      await dashboard.goto();
      await dashboard.expectActivity(new RegExp(`created a policy ${escapeRegExp(policyName)}\\.`));

      // The VM fails the policy at its next policy run — asked for now rather
      // than waited out — and the policy's automation installs the package.
      await requestHostRefetch(request, host.id);
      await waitForHostSoftwareStatus(request, host.id, titleId, 'installed', 420_000);

      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      const activity = hostDetails.activityItem(activityCopy.hostSoftware.installed({ title: name }));
      await expect(activity.first()).toBeVisible();
      await expect(activity.first()).toHaveAccessibleName(/^Fleet installed/);
    } finally {
      const policies = (await listFleetPolicies(request, vmsFleetId)).filter((p) => p.name === policyName);
      await deleteFleetPolicies(request, vmsFleetId, policies.map((p) => p.id));
      if (titleId) await removeTitleFromHost(request, vmsFleetId, host.id, titleId);
    }
  });

  test('a Deploy whose install fails is tried 3 times, then reads Failed', async ({ hostDetails, vmsFleetId, request }) => {
    // Three install attempts on a VM other specs queue work on.
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
