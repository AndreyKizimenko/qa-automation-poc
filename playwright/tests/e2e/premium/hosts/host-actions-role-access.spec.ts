/**
 * Premium • Hosts • a host's Actions by role. One test per role: which of Live
 * report, Run script, Transfer and Delete the host's Actions menu offers, and
 * what its Live report modal — "Select a report" — lists and links to.
 *
 * The cells come from Fleet's gating (`HostActionsDropdown/helpers.tsx`,
 * `SelectReportModal`), each read with the menu open, as the role itself, and
 * from the modal's list rather than its description:
 *   - Live report for every role (on a desktop host); Run script for GA, GM, GT,
 *     TA, TM; Transfer for global admins, maintainers and technicians (a team
 *     role moves hosts only through the API, by design); Delete for GA, GM, TA,
 *     TM — never a technician.
 *   - the modal lists every report, with a "create a report" link, except for a
 *     plain observer, who gets only the reports observers can run and no link.
 *
 * Global roles read an online Linux simulation on Unassigned, which they all
 * see; the team admin reads an online host on the VMs fleet, the one it holds
 * hosts in. Nothing is run or moved: the menu is read and the modal closed. The
 * Workstations-only roles are left out — Workstations has no hosts to read.
 *
 * Every absence is read off an open menu, anchored on its Live report, so a
 * menu that never opened can't pass as a withheld action; the modal's are
 * anchored on a report it does list.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import {
  createReport,
  deleteReportsMatching,
  findOnlineHost,
  listFleetHosts,
  type StaticUserKey,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { HostDetailsPage } from '@pages';

interface RoleCase {
  key: StaticUserKey;
  /** Where the role finds a host it may see. */
  host: 'unassigned-simulation' | 'vms-fleet';
  runScript: boolean;
  transfer: boolean;
  delete: boolean;
  /** The modal lists reports observers can't run, and links to creating one. */
  everyReport: boolean;
}

const ROLES: RoleCase[] = [
  { key: 'global-maintainer', host: 'unassigned-simulation', runScript: true, transfer: true, delete: true, everyReport: true },
  { key: 'global-observer', host: 'unassigned-simulation', runScript: false, transfer: false, delete: false, everyReport: false },
  {
    key: 'global-observer-plus',
    host: 'unassigned-simulation',
    runScript: false,
    transfer: false,
    delete: false,
    everyReport: true,
  },
  { key: 'global-technician', host: 'unassigned-simulation', runScript: true, transfer: true, delete: false, everyReport: true },
  { key: 'team-admin', host: 'vms-fleet', runScript: true, transfer: false, delete: true, everyReport: true },
];

let marker: string | undefined;

test.afterEach(async ({ request }) => {
  if (marker) await deleteReportsMatching(request, marker);
  marker = undefined;
});

test.describe('Premium • Hosts • Actions by role', () => {
  for (const role of ROLES) {
    test(`${role.key} is offered the host actions its role grants`, async ({ browser, request, vmsFleetId }) => {
      // On the VMs fleet a real VM, which stays put; other specs borrow
      // simulations onto that fleet and move them back mid-run.
      const vmsHosts = role.host === 'vms-fleet' ? await listFleetHosts(request, vmsFleetId, { status: 'online' }) : [];
      const host =
        role.host === 'vms-fleet'
          ? vmsHosts.find((h) => h.real) ?? vmsHosts[0]
          : await findOnlineHost(request, 'linux', { kind: 'simulated' });
      expect(host, `no online host for ${role.key} (${role.host})`).toBeTruthy();

      // One report observers can run and one they can't, under one marker the
      // modal's filter narrows to.
      marker = `pw-role-hostrep-${role.key}-${runNonce()}`;
      await createReport(request, { name: `${marker}-observers`, observerCanRun: true });
      await createReport(request, { name: `${marker}-others` });

      await withStaticUser(browser, role.key, async (page) => {
        const details = new HostDetailsPage(page);
        await details.goto(host!.id);

        await details.openActions();
        await expect(details.actionOption('Live report')).toBeVisible();
        await expect(details.actionOption('Run script')).toHaveCount(role.runScript ? 1 : 0);
        await expect(details.actionOption('Transfer')).toHaveCount(role.transfer ? 1 : 0);
        await expect(details.actionOption('Delete')).toHaveCount(role.delete ? 1 : 0);

        await details.actionOption('Live report').click();
        const modal = details.selectReportModal;
        await expect(modal.modal).toBeVisible();
        await modal.filter(marker!);
        await expect(modal.report(`${marker}-observers`)).toBeVisible();
        await expect(modal.report(`${marker}-others`)).toHaveCount(role.everyReport ? 1 : 0);
        // A technician's link is #54622's, asserted by the skipped test below.
        if (role.key !== 'global-technician') {
          await expect(modal.createReportLink).toHaveCount(role.everyReport ? 1 : 0);
        }
        await modal.closeButton.click();
        await expect(modal.modal).toBeHidden();
      });
    });
  }

  // TODO(fleetdm/fleet#54622): a global technician's "Select a report" modal
  // links to creating a report (`SelectReportModal` checks `isOnlyObserver`), but
  // `/reports/new` is a 403 for the role. Un-skip once the link is withheld.
  test.skip('global-technician is not offered "create a report" from a host', async ({ browser, request }) => {
    const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
    expect(host, 'no online Linux simulation').toBeTruthy();

    await withStaticUser(browser, 'global-technician', async (page) => {
      const details = new HostDetailsPage(page);
      await details.goto(host!.id);
      await details.openLiveReport();
      await expect(details.selectReportModal.closeButton).toBeVisible();
      await expect(details.selectReportModal.createReportLink).toHaveCount(0);
    });
  });
});
