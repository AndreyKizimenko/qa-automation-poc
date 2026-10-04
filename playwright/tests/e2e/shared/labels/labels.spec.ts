/**
 * Labels • CRUD on the dedicated Labels page. Two serial lifecycles (Dynamic
 * and Manual), each create → edit → delete → activity feed, per the suite's
 * CRUD convention. Labels are created globally (no fleet scope).
 *
 * Shared: `pages/labels/` has no tier gate on the Dynamic or Manual types (the
 * only `isPremiumTier` there is the Host vitals type's IdP criteria), and the
 * server gates only fleet-scoped labels, which this spec never creates. Both
 * instances carry 20-odd gitops-provisioned labels.
 *
 * The list is client-side-paginated (20/page) and sorted by name, so a label
 * can land on a later page; `locateRow` pages to it, and the delete checks use
 * it too, since a row missing from page 1 proves nothing. The cleanup projects
 * sweep `pw-*` labels on premium only (inside the VMs-fleet step, which free
 * skips), so each lifecycle purges its own leftovers up front.
 *
 * The Dynamic lifecycle renames its label to one ending in `!@#$%^&*()_-+=`, so
 * the edit form, the list, the delete toast and the activity feed all carry
 * special characters. The suite's own matching is safe with them:
 * `DataTable.rowWith` matches text without a regex, `activityCopy` escapes, the
 * purge matches by `includes` and deletes by id.
 *
 * The Manual label holds osquery-perf simulations (Linux slices 2–4 of
 * `findSimulations`, never moved), never a real VM: on free, the real VMs sit in
 * the same global scope the label does. Its lifecycle runs where QA Wolf's did,
 * from the Hosts list (round 1 C9 #11): filtered by the label, the list holds
 * exactly its two hosts; the pill's **Edit label** opens the form, which swaps
 * one host for another; the list then holds the new pair; the pill's **Delete
 * label** deletes it. Membership is read back through the API after the save,
 * since the toast can't prove what was stored. The Dynamic lifecycle keeps the
 * Labels page's own Edit and Delete.
 *
 * Grounded in frontend/pages/labels/{ManageLabelsPage,NewLabelPage,EditLabelPage}
 * and the Hosts list's HostsFilterBlock (the label pill and its two buttons).
 */
import type { PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { deleteLabelsMatching, findSimulations, getHostDisplayName, getLabelId, listLabelHostIds } from '@helpers/api';

// Cleanup runs in beforeAll (no `request` fixture there), so spin up a
// cookie-less API context and purge this lifecycle's leftover labels.
async function purgeLabels(
  playwright: PlaywrightWorkerArgs['playwright'],
  marker: string,
): Promise<void> {
  const ctx = await playwright.request.newContext({
    baseURL: process.env.FLEET_URL,
    ignoreHTTPSErrors: true,
  });
  await deleteLabelsMatching(ctx, marker);
  await ctx.dispose();
}

const DYN_MARKER = 'pw-label-dyn';
const MAN_MARKER = 'pw-label-man';
const SPECIAL_CHARACTERS = '!@#$%^&*()_-+=';

test.describe('Labels • Dynamic label lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const name = `${DYN_MARKER}-${Date.now()}`;
  const editedName = `${name} ${SPECIAL_CHARACTERS}`;
  const description = 'Playwright dynamic label';
  const editedDescription = `${description} (edited)`;

  test.beforeAll(async ({ playwright }) => {
    await purgeLabels(playwright, DYN_MARKER);
  });

  test('create', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.clickAddLabel();
    await labelsPage.selectType('Dynamic');
    await labelsPage.fillDetails(name, description);
    await labelsPage.save();

    await labelsPage.toast.expectSuccess('Label added successfully.');
    await expect(labelsPage.page).toHaveURL(/\/labels\/manage/);

    await labelsPage.goto();
    const row = await labelsPage.locateRow(name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(description);
    await expect(row).toContainText('Dynamic');
  });

  test('edit to a name with special characters', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.runRowAction(name, 'Edit');

    await expect(labelsPage.page).toHaveURL(/\/labels\/\d+/);
    await expect(labelsPage.nameInput).toHaveValue(name);
    await expect(labelsPage.descriptionInput).toHaveValue(description);

    await labelsPage.fillDetails(editedName, editedDescription);
    await labelsPage.save();
    await labelsPage.toast.expectSuccess('Label updated successfully.');

    await labelsPage.goto();
    const row = await labelsPage.locateRow(editedName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(editedName);
    await expect(row).toContainText(editedDescription);
  });

  test('delete', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.runRowAction(editedName, 'Delete');

    await expect(labelsPage.deleteModal).toBeVisible();
    await labelsPage.deleteConfirmButton.click();
    await labelsPage.toast.expectSuccess(`Successfully deleted ${editedName}.`);

    await labelsPage.goto();
    await expect(await labelsPage.locateRow(editedName)).toHaveCount(0);
  });

  test('activity feed shows create → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      activityCopy.label.created({ name }),
      activityCopy.label.edited({ name: editedName }),
      activityCopy.label.deleted({ name: editedName }),
    ]);
  });
});

/** Manual labels group hosts by explicit membership. */
test.describe('Labels • Manual label lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const name = `${MAN_MARKER}-${Date.now()}`;
  const editedName = `${name}-edited`;
  const description = 'Playwright manual label';
  const editedDescription = `${description} (edited)`;

  // Three Linux simulations: the label starts with the first two, and the edit
  // swaps the second for the third.
  let hosts: Array<{ id: number; name: string }> = [];

  test.beforeAll(async ({ playwright }) => {
    await purgeLabels(playwright, MAN_MARKER);
  });

  test('create', async ({ labelsPage, hostsList, request, pageHealth }) => {
    // The manual-label host-target search logs a benign 4xx to the console
    // ("Invalid usage: missing required parameter(s)") while typing; the search
    // still returns hosts and the label saves. Opt out of the console-error
    // assertion for this one test.
    pageHealth.disable();

    const ids = await findSimulations(request, 'linux', 3, 2);
    expect(ids, 'three online Linux simulations for the manual label').toHaveLength(3);
    hosts = await Promise.all(ids.map(async (id) => ({ id, name: await getHostDisplayName(request, id) })));

    await labelsPage.goto();
    await labelsPage.clickAddLabel();
    await labelsPage.selectType('Manual');
    await labelsPage.fillDetails(name, description);
    for (const host of hosts.slice(0, 2)) {
      expect(await labelsPage.addHost(host.name)).toBe(host.name);
    }
    await labelsPage.save();

    await labelsPage.toast.expectSuccess('Label added successfully.');
    await expect(labelsPage.page).toHaveURL(/\/labels\/manage/);

    await labelsPage.goto();
    const row = await labelsPage.locateRow(name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(description);
    await expect(row).toContainText('Manual');

    // Filtered by the label, the Hosts list holds exactly its hosts.
    await labelsPage.navbar.goToHosts();
    await hostsList.labelFilter.selectLabel(name);
    await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${name}`);
    await expect
      .poll(async () => (await hostsList.hostNames()).sort())
      .toEqual([hosts[0].name, hosts[1].name].sort());
  });

  test('edit from the Hosts list swaps a host', async ({ labelsPage, hostsList, request, pageHealth }) => {
    // The same host-target search as create.
    pageHealth.disable();

    await hostsList.goto();
    await hostsList.labelFilter.selectLabel(name);
    await hostsList.editLabelButton.click();

    await expect(labelsPage.page).toHaveURL(/\/labels\/\d+$/);
    await expect(labelsPage.nameInput).toHaveValue(name);
    await expect(labelsPage.descriptionInput).toHaveValue(description);
    await expect
      .poll(async () => (await labelsPage.selectedHostNames()).sort())
      .toEqual([hosts[0].name, hosts[1].name].sort());

    await labelsPage.fillDetails(editedName, editedDescription);
    await labelsPage.removeHost(hosts[1].name);
    expect(await labelsPage.addHost(hosts[2].name)).toBe(hosts[2].name);
    await labelsPage.save();
    await labelsPage.toast.expectSuccess('Label updated successfully.');

    const labelId = await getLabelId(request, editedName);
    const byId = (a: number, b: number) => a - b;
    await expect
      .poll(async () => [...(await listLabelHostIds(request, labelId))].sort(byId))
      .toEqual([hosts[0].id, hosts[2].id].sort(byId));

    await labelsPage.goto();
    const row = await labelsPage.locateRow(editedName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(editedDescription);

    await labelsPage.navbar.goToHosts();
    await hostsList.labelFilter.selectLabel(editedName);
    await expect(hostsList.filterPill).toHaveAccessibleName(`hosts filtered by ${editedName}`);
    await expect
      .poll(async () => (await hostsList.hostNames()).sort())
      .toEqual([hosts[0].name, hosts[2].name].sort());
  });

  test('delete from the Hosts list', async ({ labelsPage, hostsList }) => {
    await hostsList.goto();
    await hostsList.labelFilter.selectLabel(editedName);
    await hostsList.deleteLabelButton.click();

    await expect(hostsList.deleteLabelModal).toBeVisible();
    await hostsList.deleteLabelModal.getByRole('button', { name: 'Delete', exact: true }).click();
    await hostsList.toast.expectSuccess('Successfully deleted label.');
    // Fleet drops the label from the route, back to the unfiltered list.
    await expect(hostsList.page).toHaveURL(/\/hosts\/manage(?!\/labels)/);
    await expect(hostsList.filterPill).toHaveCount(0);

    await labelsPage.goto();
    await expect(await labelsPage.locateRow(editedName)).toHaveCount(0);
  });

  test('activity feed shows create → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      activityCopy.label.created({ name }),
      activityCopy.label.edited({ name: editedName }),
      activityCopy.label.deleted({ name: editedName }),
    ]);
  });
});
