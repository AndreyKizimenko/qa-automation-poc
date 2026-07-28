/**
 * Premium • Labels • role access. Read-only permission checks over the
 * gitops-provisioned (global) labels. Each static human logs into a fresh
 * context via `withStaticUser`.
 *
 * Grounded in frontend/pages/labels/ManageLabelsPage (canAddLabel) +
 * LabelsTable/LabelsTableConfig (hasEditPermission):
 *   - a global observer can't add labels and gets only "View all hosts";
 *   - a team maintainer (ws-maintainer) CAN add labels, but on a *global*
 *     label (not its author, no team scope) still gets only "View all hosts"
 *     — no Edit/Delete;
 *   - a team admin lands on the same side of both gates, via a different branch
 *     of each: `canAddLabel` admits them through `isAnyTeamMaintainerOrTeamAdmin`
 *     while `hasEditPermission` omits team roles entirely, so the two can
 *     regress independently.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { LabelsPage } from '@pages';

test.describe('Premium • Labels • role access', () => {
  test('global observer cannot add labels and can only view hosts', async ({ browser }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();

      await expect(labels.addLabelButton).toHaveCount(0);

      const name = (await labels.labelNames())[0];
      await labels.openRowActions(name);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toHaveCount(0);
      await expect(labels.rowActionOption('Delete')).toHaveCount(0);
    });
  });

  test('team maintainer can add labels but cannot edit a global label', async ({ browser }) => {
    await withStaticUser(browser, 'ws-maintainer', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();

      await expect(labels.addLabelButton).toBeVisible();

      const name = (await labels.labelNames())[0];
      await labels.openRowActions(name);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toHaveCount(0);
      await expect(labels.rowActionOption('Delete')).toHaveCount(0);
    });
  });

  test('team admin can add labels but cannot edit a global label', async ({ browser }) => {
    await withStaticUser(browser, 'team-admin', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();

      await expect(labels.addLabelButton).toBeVisible();

      const name = (await labels.labelNames())[0];
      await labels.openRowActions(name);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toHaveCount(0);
      await expect(labels.rowActionOption('Delete')).toHaveCount(0);
    });
  });
});
