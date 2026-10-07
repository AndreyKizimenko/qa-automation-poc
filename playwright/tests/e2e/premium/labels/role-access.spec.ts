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
 *     regress independently;
 *   - a team observer (ws-observer) can't add labels and gets only "View all
 *     hosts", as a global observer does;
 *   - a global technician can add labels and gets Edit and Delete on any label.
 *
 * Two more cells read what authorship and the Hosts list add (round 1 C9 #14,
 * #15; round 3, batch E):
 *   - a team maintainer's own label: a label made in the UI is always global
 *     (the form sends no fleet), and `hasEditPermission` admits its author, so
 *     ws-maintainer gets Edit and Delete on it and edits and deletes it — the
 *     one place the rego checks authorship (`policy.rego`'s label rules). It's a
 *     Dynamic `pw-role-*` label, deleted in an `afterEach` if the test didn't;
 *     the VMs-fleet sweep removes `pw-` labels after a dead run.
 *   - a global observer filters the Hosts list by a gitops label: the pill names
 *     it, with no Edit label or Delete label (`HostsFilterBlock` gives those to
 *     global roles but observers, or the label's author). QA Wolf's flow was
 *     titled "team observer" but signed in as the global observer; ws-observer's
 *     label filter is disabled while Workstations has no hosts.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { deleteLabelsMatching, findLabelByName, findUserByEmail, staticUser } from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import { HostsListPage, LabelsPage } from '@pages';

/** A gitops-declared global label on premium (`gitops/lib/labels/debian-based-linux-hosts.yml`); its members are the Ubuntu simulations. */
const GITOPS_LABEL = 'Debian-based Linux hosts';

let ownLabel: string | undefined;

test.afterEach(async ({ request }) => {
  if (ownLabel) await deleteLabelsMatching(request, ownLabel);
  ownLabel = undefined;
});

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

  test('team observer cannot add labels and can only view hosts', async ({ browser }) => {
    await withStaticUser(browser, 'ws-observer', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();

      await expect(labels.addLabelButton).toHaveCount(0);

      await labels.openRowActions(GITOPS_LABEL);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toHaveCount(0);
      await expect(labels.rowActionOption('Delete')).toHaveCount(0);
    });
  });

  test('global technician can add labels and edit or delete any label', async ({ browser }) => {
    await withStaticUser(browser, 'global-technician', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();

      await expect(labels.addLabelButton).toBeVisible();

      // Read only: a gitops label is never edited or deleted here.
      await labels.openRowActions(GITOPS_LABEL);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toBeVisible();
      await expect(labels.rowActionOption('Delete')).toBeVisible();
    });
  });

  test('team maintainer creates, edits and deletes a label of its own', async ({ browser, request }) => {
    const name = `pw-role-label-${runNonce()}`;
    ownLabel = name;
    const author = await findUserByEmail(request, staticUser('ws-maintainer').email);
    expect(author, 'ws-maintainer not found').not.toBeNull();

    await withStaticUser(browser, 'ws-maintainer', async (page) => {
      const labels = new LabelsPage(page);
      await labels.goto();
      await labels.clickAddLabel();
      await labels.selectType('Dynamic');
      await labels.fillDetails(name, 'Playwright role label');
      await labels.save();
      await labels.toast.expectSuccess('Label added successfully.');

      // Global, and the maintainer's own — which is what earns it Edit and Delete.
      const stored = await findLabelByName(request, name);
      expect(stored?.fleetId).toBeNull();
      expect(stored?.authorId).toBe(author!.id);

      await labels.goto();
      await labels.openRowActions(name);
      await expect(labels.rowActionOption('View all hosts')).toBeVisible();
      await expect(labels.rowActionOption('Edit')).toBeVisible();
      await expect(labels.rowActionOption('Delete')).toBeVisible();

      await labels.runRowAction(name, 'Edit');
      await expect(labels.nameInput).toHaveValue(name);
      await labels.fillDetails(name, 'Playwright role label (edited)');
      await labels.save();
      await labels.toast.expectSuccess('Label updated successfully.');
      await expect.poll(async () => (await findLabelByName(request, name))?.description).toBe(
        'Playwright role label (edited)',
      );

      await labels.goto();
      await labels.runRowAction(name, 'Delete');
      await expect(labels.deleteModal).toBeVisible();
      await labels.deleteConfirmButton.click();
      await labels.toast.expectSuccess(`Successfully deleted ${name}.`);
    });

    expect(await findLabelByName(request, name)).toBeNull();
  });

  test('global observer filters the Hosts list by a label, with no Edit or Delete on its pill', async ({
    browser,
  }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const hosts = new HostsListPage(page);
      await hosts.goto();
      await hosts.table.waitForSettled();
      await hosts.labelFilter.selectLabel(GITOPS_LABEL);

      await hosts.table.waitForSettled();
      await expect(hosts.table.firstRowWithLink).toBeVisible();
      await expect(hosts.filterPill).toHaveAccessibleName(`hosts filtered by ${GITOPS_LABEL}`);
      await expect(hosts.editLabelButton).toHaveCount(0);
      await expect(hosts.deleteLabelButton).toHaveCount(0);
    });
  });
});
