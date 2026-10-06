/**
 * Free • Hosts • a host's Actions by role — the free half of
 * `premium/hosts/host-actions-role-access.spec.ts` (round 1 C2 #3), for the two
 * non-admin roles free has. Free has no fleets, so no role is offered Transfer.
 *
 *   - global maintainer: Live report, Run script and Delete; the Live report
 *     modal lists every report and links to creating one.
 *   - global observer: Live report only; the modal lists only the reports
 *     observers can run, with no link.
 *
 * Grounded in `HostActionsDropdown/helpers.tsx` and `SelectReportModal`. Both
 * read an online Linux simulation, picked by id (the free real VMs share
 * Unassigned with them); nothing is run or moved. Every absence is read off an
 * open menu anchored on its Live report, and the modal's on a report it lists.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { createReport, deleteReportsMatching, findOnlineHost, type StaticUserKey } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { HostDetailsPage } from '@pages';

const ROLES: { key: StaticUserKey; author: boolean }[] = [
  { key: 'global-maintainer', author: true },
  { key: 'global-observer', author: false },
];

let marker: string | undefined;

test.afterEach(async ({ request }) => {
  if (marker) await deleteReportsMatching(request, marker);
  marker = undefined;
});

test.describe('Free • Hosts • Actions by role', () => {
  for (const role of ROLES) {
    test(`${role.key} is offered the host actions its role grants`, async ({ browser, request }) => {
      const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
      expect(host, 'no online Linux simulation').toBeTruthy();
      marker = `pw-role-hostrep-${role.key}-${runNonce()}`;
      await createReport(request, { name: `${marker}-observers`, observerCanRun: true });
      await createReport(request, { name: `${marker}-others` });

      await withStaticUser(browser, role.key, async (page) => {
        const details = new HostDetailsPage(page);
        await details.goto(host!.id);

        await details.openActions();
        await expect(details.actionOption('Live report')).toBeVisible();
        await expect(details.actionOption('Run script')).toHaveCount(role.author ? 1 : 0);
        await expect(details.actionOption('Delete')).toHaveCount(role.author ? 1 : 0);
        await expect(details.actionOption('Transfer')).toHaveCount(0);

        await details.actionOption('Live report').click();
        const modal = details.selectReportModal;
        await expect(modal.modal).toBeVisible();
        await modal.filter(marker!);
        await expect(modal.report(`${marker}-observers`)).toBeVisible();
        await expect(modal.report(`${marker}-others`)).toHaveCount(role.author ? 1 : 0);
        await expect(modal.createReportLink).toHaveCount(role.author ? 1 : 0);
        await modal.closeButton.click();
        await expect(modal.modal).toBeHidden();
      });
    });
  }
});
