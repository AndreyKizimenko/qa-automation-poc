/**
 * Premium • Software • Script-only package (Unassigned).
 *
 * A `.sh` uploaded through Add software → Custom package is not an installer:
 * Fleet stores the file's contents *as* the install script and calls the result
 * a "Script-only package (macOS & Linux)". This spec is the add → inspect →
 * delete round-trip for that shape, driven through the UI end to end because
 * the upload preview is half of what it verifies.
 *
 * Premium-only — every Add-software path is paywalled on free.
 *
 * Scope: Unassigned only. library.spec already covers add/delete across scopes
 * and package kinds; what's unique here is the script-only *shape* — the sh
 * graphic and "macOS & Linux" subtext on the uploader, the Type line, and the
 * install script Fleet derives from the file rather than generating.
 *
 * Fixture: `fleet-playwright-script-package.sh`. Fleet titles a script package
 * after its filename minus the extension, so this name is also the title —
 * unique across the suite, which keeps a parallel worker from adding a second
 * package to the same title and making the accordion ambiguous.
 *
 * **The second describe runs one on the real Mac.** A per-run
 * `fleet-pw-script-<nonce>.sh` that prints a marker and exits 0 goes on the VMs
 * fleet by API; the Mac's Library offers it as **Run** (not Install, and with no
 * Uninstall: there is no uninstall script); Run queues it, the Mac runs it, and
 * the host's Past activity reads "ran <title> on this host.", opening "Script
 * details" with the marker in its output; the Library then reads Ran / Rerun.
 * Only a real host proves the package ran: a simulation with orbit reports a
 * random result for a script it never runs. The Mac rather than the Linux VM,
 * whose install and script queue is the busiest in the suite. The script exits 0
 * because a failed install script backs orbit off for minutes and stalls every
 * spec queued on that VM (fleetdm/fleet#54607). Every check is keyed to the
 * run's nonce title, so a late result from a dead attempt can't satisfy a
 * retry. The title is deleted in an `afterEach`, which still runs when the test
 * times out, and deleting it cancels a run still queued; the VMs sweep in
 * cleanup removes a `fleet-pw-*` title a killed run left. Round 2 #72, with #88
 * folded in (round 3, batch G).
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect, HOST_RETRIES } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import {
  assertActivity,
  assertActivityAfter,
  deleteSoftwareTitle,
  getHostSoftwareState,
  getSoftwarePackage,
  hostsOfferedTitle,
  latestActivityId,
  listUpcomingActivities,
  requireRealHost,
  uploadSoftwarePackageBuffer,
  waitForHostSoftwareStatus,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';

const SCOPE = 'Unassigned' as const;
const FLEET_ID = 0;

const FIXTURE = path.resolve(
  __dirname,
  '../../../../test-data/shared/software/fleet-playwright-script-package.sh',
);
const FILE_NAME = 'fleet-playwright-script-package.sh';
const TITLE_NAME = 'fleet-playwright-script-package';

test.describe('Premium • Software • Script-only package', () => {
  test('a .sh is added as a script-only package and removed again', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareCustomPackage,
    softwareTitleDetail,
    request,
    page,
  }) => {
    // Upload plus the activity read can edge past the 60s default under worker
    // load; matches the headroom library.spec gives its add flow.
    test.setTimeout(90_000);

    let titleId = 0;
    try {
      await dashboard.goto();
      await dashboard.navbar.goToSoftware();
      await softwareTitles.teamDropdown.select(SCOPE);
      await softwareTitles.clickAddSoftware();
      await softwareCustomPackage.openTab();

      // The uploader tells the user what Fleet made of the file before they
      // commit to it: a shell-script graphic and the platforms it can target.
      await softwareCustomPackage.uploader.setFile(FIXTURE);
      await expect(page.locator('.file-details__name')).toHaveText(FILE_NAME);
      await expect(page.locator('.file-details__description')).toHaveText('macOS & Linux');
      // Fleet picks the graphic from the extension and stamps it with a
      // data-testid; nothing in its role or text distinguishes it.
      await expect(page.locator('.file-details [data-testid="file-sh-graphic"]')).toBeVisible();

      await expect(softwareCustomPackage.addSoftwareButton).toBeEnabled();
      await softwareCustomPackage.addSoftwareButton.click();
      await page.waitForURL(/\/software\/titles\/\d+/, { timeout: 60_000 });
      await softwareCustomPackage.toast.expectSuccess(/successfully added/);

      titleId = Number(page.url().match(/\/software\/titles\/(\d+)/)?.[1]);
      expect(titleId).toBeGreaterThan(0);

      await expect(softwareTitleDetail.displayHeading).toHaveText(TITLE_NAME);
      await expect(softwareTitleDetail.typeValue).toHaveText(
        'Script-only package (macOS & Linux)',
      );
      await expect(softwareTitleDetail.headerPills).toHaveText(['Custom package']);
      await expect(softwareTitleDetail.installerCard.card).toContainText(FILE_NAME);
      await expect(softwareTitleDetail.installerCard.card).toContainText(
        'Added less than a minute ago',
      );

      // The defining property of a script-only package: the uploaded file *is*
      // the install script, and Fleet generates no uninstall counterpart.
      const pkg = await getSoftwarePackage(request, FLEET_ID, titleId);
      expect(pkg?.installScript).toBe(fs.readFileSync(FIXTURE, 'utf8'));
      expect(pkg?.uninstallScript).toBe('');

      await assertActivity(request, 'added_software', (d) => d.software_title === TITLE_NAME);

      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      await softwareLibrary.searchByName(TITLE_NAME);
      await expect(softwareLibrary.table.rowWith(TITLE_NAME)).toBeVisible();

      // Delete through the UI — the accordion row owns the affordance.
      await softwareTitleDetail.goto({ titleId, fleetId: FLEET_ID });
      await softwareTitleDetail.installerCard.delete();
      await assertActivity(request, 'deleted_software', (d) => d.software_title === TITLE_NAME);

      await softwareLibrary.goto({ fleetId: FLEET_ID });
      await softwareLibrary.teamDropdown.select(SCOPE);
      // Library's search input is disabled when the table is empty, so a query
      // isn't always possible post-delete. Library only lists installer-managed
      // titles, so a row-count assertion on the name is unambiguous.
      await expect(softwareLibrary.table.rowOrEmpty()).toBeVisible();
      await expect(softwareLibrary.table.rowWith(TITLE_NAME)).toHaveCount(0);
      titleId = 0;
    } finally {
      if (titleId) await deleteSoftwareTitle(request, FLEET_ID, titleId);
    }
  });
});

test.describe('Premium • Software • Script-only package run on a host', () => {
  // One run on the Mac, whose queue other specs' installs and scripts share, so
  // the run can wait behind them.
  test.describe.configure({ timeout: 600_000, retries: HOST_RETRIES });

  let created: { fleetId: number; titleId: number } | null = null;

  test.afterEach(async ({ request }) => {
    if (created) await deleteSoftwareTitle(request, created.fleetId, created.titleId);
    created = null;
  });

  test("runs on the macOS VM from its Library, and its output is in the run's details", async ({
    hostDetails,
    vmsFleetId,
    request,
  }) => {
    const host = await requireRealHost(request, 'darwin');
    const nonce = runNonce();
    const title = `fleet-pw-script-${nonce}`;
    const fileName = `${title}.sh`;
    const marker = `pw-script-package-ran-${nonce}`;
    const { titleId } = await uploadSoftwarePackageBuffer(
      request,
      vmsFleetId,
      fileName,
      Buffer.from(`#!/bin/sh\necho "${marker}"\nexit 0\n`),
    );
    created = { fleetId: vmsFleetId, titleId };
    expect(await hostsOfferedTitle(request, [host.id], titleId), `${title} is offered to ${host.displayName}`).toEqual([
      host.id,
    ]);

    const library = hostDetails.library;
    const before = await latestActivityId(request);

    await test.step("Run it from the Mac's Library", async () => {
      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(title);
      await expect(library.installAction(title, 'Run')).toBeVisible();
      await expect(library.installAction(title, 'Install')).toHaveCount(0);
      await expect(library.uninstallAction(title)).toHaveCount(0);

      await library.run(title);
      // Queued until the Mac's next check-in, which can beat any page that would
      // show it, so the queue is read through the API at the click.
      expect((await getHostSoftwareState(request, host.id, titleId))?.status).toBe('pending_install');
      expect((await listUpcomingActivities(request, host.id)).map((a) => a.softwareTitle)).toContain(title);
    });

    await test.step('the Mac runs it, and Fleet records the run with its output', async () => {
      await waitForHostSoftwareStatus(request, host.id, titleId, 'installed');
      const activity = await assertActivityAfter(
        request,
        'installed_software',
        before,
        (d) => d.software_title === title && d.host_id === host.id,
        { actor: process.env.FLEET_ADMIN_EMAIL },
      );
      const details = activity.details as Record<string, unknown>;
      expect(details.status).toBe('installed');
      expect(details.software_package).toBe(fileName);
      expect(details.source).toBe('sh_packages');

      await hostDetails.goto(host.id);
      await hostDetails.showPastActivities();
      await hostDetails.activityItem(activityCopy.hostSoftware.ranScriptPackage({ title })).first().click();
      const modal = hostDetails.scriptPackageDetailsModal;
      await modal.expectOpen();
      await expect(modal.statusMessage).toContainText(`Fleet ran ${title} (${fileName}) on ${host.displayName}`);
      await expect(await modal.revealOutput()).toContainText(marker);
      await modal.close();
    });

    await test.step('the Library reads Ran, and offers Rerun', async () => {
      await hostDetails.goto(host.id);
      await hostDetails.openLibrary(title);
      await expect(library.statusButton(title, 'Ran')).toBeVisible();
      await expect(library.installAction(title, 'Rerun')).toBeVisible();
    });
  });
});
