/**
 * Free • Labels • role access — the free half of
 * `premium/labels/role-access.spec.ts`, for the two non-admin roles free has.
 * Labels carry no tier gate (`pages/labels/`, `HostsFilterBlock`), so the cells
 * are premium's, read over a gitops-declared global label that free declares
 * too (`gitops/lib/labels/debian-based-linux-hosts.yml`). Read-only: nothing is
 * created, edited or deleted.
 *
 *   - global observer: no Add label, and only "View all hosts" in a label's row
 *     actions (`ManageLabelsPage` / `LabelsTableConfig`); on the Hosts list
 *     filtered by the label, the pill has no Edit label or Delete label
 *     (round 1 C9 #15).
 *   - global maintainer: Add label, and Edit and Delete on any label; the pill
 *     carries both buttons.
 *
 * Each absence is anchored on what the same role is shown beside it — the row's
 * "View all hosts", the pill itself.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { HostsListPage, LabelsPage } from '@pages';

const GITOPS_LABEL = 'Debian-based Linux hosts';

const ROLES: { key: StaticUserKey; edit: boolean }[] = [
  { key: 'global-maintainer', edit: true },
  { key: 'global-observer', edit: false },
];

test.describe('Free • Labels • role access', () => {
  for (const role of ROLES) {
    test(`${role.key} is shown the label controls its role grants`, async ({ browser }) => {
      await withStaticUser(browser, role.key, async (page) => {
        const labels = new LabelsPage(page);
        await labels.goto();
        await expect(labels.addLabelButton).toHaveCount(role.edit ? 1 : 0);

        await labels.openRowActions(GITOPS_LABEL);
        await expect(labels.rowActionOption('View all hosts')).toBeVisible();
        await expect(labels.rowActionOption('Edit')).toHaveCount(role.edit ? 1 : 0);
        await expect(labels.rowActionOption('Delete')).toHaveCount(role.edit ? 1 : 0);

        const hosts = new HostsListPage(page);
        await hosts.goto();
        await hosts.table.waitForSettled();
        await hosts.labelFilter.selectLabel(GITOPS_LABEL);
        await hosts.table.waitForSettled();
        await expect(hosts.filterPill).toHaveAccessibleName(`hosts filtered by ${GITOPS_LABEL}`);
        await expect(hosts.editLabelButton).toHaveCount(role.edit ? 1 : 0);
        await expect(hosts.deleteLabelButton).toHaveCount(role.edit ? 1 : 0);
      });
    });
  }
});
