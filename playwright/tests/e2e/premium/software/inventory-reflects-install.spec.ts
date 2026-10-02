/**
 * Premium • Software • The host's Inventory follows what is really installed.
 *
 * Host details → Software has two views of software: **Library** is what Fleet
 * offers the host, **Inventory** is what the host last reported having. They
 * must not be confused — an install Fleet has only queued, or one that failed,
 * is not software the host has:
 *
 *   - a package that installs appears in Inventory once the host re-reports;
 *   - a package that is still pending, or that failed, never appears there, even
 *     after a fresh inventory read. A failed install is retried: Fleet makes
 *     `MaxSoftwareInstallAttempts` (3) attempts, reporting it pending between
 *     them, before the failure sticks — so the Inventory is read inside that
 *     pending window, a minute or two long.
 *
 * Both run on the aarch64 Linux VM with packages built per run by
 * `helpers/deb.ts`. The failing one is an ordinary package with a pre-install
 * query that returns no rows (`SELECT 1 WHERE 1 = 0;`): orbit stops before the
 * install script and Fleet records the install failed, so nothing reaches the
 * host. Not a package dpkg refuses: a failed install *script* puts orbit's config
 * loop into a backoff of up to 5 min, which stalls every other spec's installs and
 * scripts on this VM; a failed pre-install query doesn't.
 * TODO(fleetdm/fleet#54607): see docs/blocked-by-product-bugs.md.
 *
 * Premium only (installing software is premium), on the VMs fleet; see
 * `install-on-host.spec.ts`.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import { inertDeb } from '@helpers/deb';
import {
  deleteSoftwareTitle,
  getHostSoftwareState,
  installSoftwareOnHost,
  listHostActivities,
  removeTitleFromHost,
  requireRealHost,
  uploadSoftwarePackageBuffer,
  waitForHostSoftwareStatus,
  waitForSoftwareSettled,
} from '@helpers/api';
import type { HostDetailsPage } from '@pages';

/** Opens the Inventory filtered to `name` and waits for the table to settle either way. */
async function inventoryFor(hostDetails: HostDetailsPage, hostId: number, name: string) {
  await hostDetails.goto(hostId);
  await hostDetails.openInventory(name);
  await expect(hostDetails.softwareRowOrEmpty()).toBeVisible();
}

test.describe('Premium • Software • Inventory reflects installs', () => {
  // Three install attempts, minutes apart, on a VM other specs are using too.
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  test('a package that installs appears in the Inventory once the host re-reports', async ({
    hostDetails,
    vmsFleetId,
    request,
    page,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-inventory-${Date.now().toString(36)}`;
    const title = await uploadSoftwarePackageBuffer(
      request,
      vmsFleetId,
      `${name}_2.4.0_all.deb`,
      inertDeb(name, '2.4.0'),
    );

    try {
      // Offered, not installed: in the Library, absent from the Inventory.
      await inventoryFor(hostDetails, host.id, name);
      await expect(hostDetails.softwareNameLink(name)).toHaveCount(0);

      await installSoftwareOnHost(request, host.id, title.titleId);
      const state = await waitForSoftwareSettled(request, host.id, title.titleId, 'installed');
      expect(state.installedVersions).toEqual(['2.4.0']);

      await inventoryFor(hostDetails, host.id, name);
      // Matched on the name link *within* the row: a `has` locator is resolved
      // relative to each row, so it must not be rooted at the table.
      const row = hostDetails.softwareRows.filter({ has: page.getByRole('link', { name, exact: true }) });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('2.4.0');
      await expect(row).toContainText('Package (deb)');
    } finally {
      await removeTitleFromHost(request, vmsFleetId, host.id, title.titleId);
    }
  });

  test('a pending or failed install never appears in the Inventory, through every retry', async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await requireRealHost(request, 'linux');
    const name = `fleet-pw-precondition-${Date.now().toString(36)}`;
    // A pre-install query that can never pass: every attempt stops before the
    // install script runs, and Fleet records it failed.
    const title = await uploadSoftwarePackageBuffer(
      request,
      vmsFleetId,
      `${name}_1.0.0_all.deb`,
      inertDeb(name, '1.0.0'),
      { preInstallQuery: 'SELECT 1 WHERE 1 = 0;' },
    );

    try {
      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(name);
      await hostDetails.library.install(name);

      // Queued is not installed. Fleet reports the install pending until its last
      // attempt has failed, a minute or more away, so this read is inside that
      // window — and confirmed to be.
      await inventoryFor(hostDetails, host.id, name);
      await expect(hostDetails.softwareNameLink(name)).toHaveCount(0);
      expect((await getHostSoftwareState(request, host.id, title.titleId))?.status).toBe('pending_install');

      // Failed for good after every attempt, and a fresh inventory read agrees
      // nothing arrived.
      const state = await waitForSoftwareSettled(request, host.id, title.titleId, 'failed_install', {
        timeout: 600_000,
      });
      expect(state.installedVersions).toEqual([]);
      const failures = (await listHostActivities(request, host.id)).filter(
        (a) => a.type === 'installed_software' && a.details.software_title === name,
      );
      expect(failures.map((a) => a.details.status)).toEqual(['failed_install', 'failed_install', 'failed_install']);

      await inventoryFor(hostDetails, host.id, name);
      await expect(hostDetails.softwareNameLink(name)).toHaveCount(0);

      // The Library, meanwhile, says what happened and offers the retry.
      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(name);
      await expect(hostDetails.library.statusButton(name, 'Failed')).toBeVisible();
      await expect(hostDetails.library.installAction(name, 'Retry')).toBeVisible();
    } finally {
      await waitForHostSoftwareStatus(request, host.id, title.titleId, 'failed_install').catch(() => {});
      await deleteSoftwareTitle(request, vmsFleetId, title.titleId);
    }
  });
});
