/**
 * Premium • Hosts • Single-host transfer, by role. C1 #20/#22.
 *
 * From a host's details page: Actions → Transfer → pick a fleet. Global admins
 * and global maintainers may both do this, so the same flow runs per role via
 * `withStaticUser`.
 *
 * Uses **simulated Windows** hosts: this is host-shuffling rather than device
 * behaviour, and claiming a different platform from `bulk-transfer.spec.ts`
 * (which takes macOS simulations) keeps the two disposable pools from
 * overlapping under `fullyParallel`. Each role also claims its own host by
 * index, so the two role cases can't contend either.
 *
 * Every case restores the host to Unassigned via the API — `cleanup.steps.ts`
 * does not move hosts, so a leaked transfer would persist on the instance.
 *
 * C1 #27 (a team admin must NOT see Transfer) stays uncovered: it needs the
 * `ws-admin` static user, which is not provisioned on the instance.
 */
import { test, expect } from '@fixtures';
import { HostDetailsPage } from '@pages';
import { withStaticUser } from '@helpers/auth';
import { findSimulatedHostIds, getHostFleetId, transferHosts } from '@helpers/api';

const ROLES = [
  { key: 'global-admin', label: 'global admin', hostIndex: 0 },
  { key: 'global-maintainer', label: 'global maintainer', hostIndex: 1 },
] as const;

test.describe('Premium • Hosts • single-host transfer by role', () => {
  for (const role of ROLES) {
    test(`a ${role.label} can transfer a host to another fleet`, async ({
      browser,
      qaFleetId,
      request,
    }) => {
      const hosts = await findSimulatedHostIds(request, 'windows', ROLES.length);
      expect(hosts, 'expected simulated Windows hosts to transfer').toHaveLength(ROLES.length);
      const host = hosts[role.hostIndex];

      try {
        await withStaticUser(browser, role.key, async (page) => {
          const hostDetails = new HostDetailsPage(page);

          await hostDetails.goto(host.id);
          await hostDetails.runAction('Transfer');
          await expect(hostDetails.transferModal.modal).toBeVisible();

          // The submit stays gated until a destination is chosen.
          await expect(hostDetails.transferModal.transferButton).toBeDisabled();

          await hostDetails.transferModal.transferTo('QA');

          // Fleet's copy renders a double space before the fleet name; Playwright
          // normalizes whitespace when matching, so the single-spaced form matches.
          await hostDetails.toast.expectSuccess('Host successfully transferred to QA.');
          await expect(hostDetails.vitals.value('Fleet')).toContainText('QA');
        });

        expect(await getHostFleetId(request, host.id)).toBe(qaFleetId);
      } finally {
        await transferHosts(request, null, [host.id]);
      }
    });
  }
});
