/**
 * Premium • Software • "Deploy": installing through the policy Fleet creates.
 *
 * Add a package with **Deploy** switched on, and Fleet creates an
 * `[Install software] <title> (<ext>)` policy whose automation installs it on
 * every host that fails it. The test follows that on the Ubuntu VM: the policy
 * exists and is announced in the feed, the VM fails it at its next policy run,
 * and Fleet installs the package — "Fleet installed …" in the host's Past
 * activity.
 *
 * Premium only, on the real VMs of the **VMs** fleet. The package is built per
 * run by `helpers/deb.ts` and named `fleet-pw-deploy-*`: the test adds it and a
 * policy that points at it, so it can't be one of the fleet's durable fixtures.
 * Both are removed in a `finally`, and the cleanup sweep removes what a dead run
 * left. Installing and uninstalling the durable fixtures is
 * `software-lifecycle-on-host.spec.ts`; a Deploy whose install fails, and Fleet's
 * retries of it, is `premium/exclusive/software/deploy-install-retries.spec.ts` —
 * in the exclusive project, because a policy's installs queue below every
 * user-requested one and a failed install stalls orbit (fleetdm/fleet#54607).
 */
import * as fs from 'fs';
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { inertDeb } from '@helpers/deb';
import {
  deleteFleetPolicies,
  listFleetPolicies,
  removeTitleFromHost,
  requireRealHost,
  requestHostRefetch,
  waitForHostSoftwareStatus,
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
});
