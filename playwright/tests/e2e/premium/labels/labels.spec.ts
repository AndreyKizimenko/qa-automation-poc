/**
 * Premium • Labels • CRUD on the dedicated Labels page. Two serial lifecycles
 * (Dynamic and Manual), each create → edit → delete → activity feed, per the
 * suite's CRUD convention. Labels are created globally (no team scope).
 *
 * The instance carries ~27 gitops-provisioned custom labels, and the list is
 * client-side-paginated (20/page) sorted by name — so a new label can land on
 * a later page; `locateRow` pages to it. Fleet's cleanup projects don't wipe
 * labels, so each lifecycle purges its own leftovers up front (self-healing).
 *
 * Grounded in frontend/pages/labels/{ManageLabelsPage,NewLabelPage,EditLabelPage}.
 */
import type { PlaywrightWorkerArgs } from '@playwright/test';
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { deleteLabelsMatching, firstHostDisplayName } from '@helpers/api';

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

test.describe('Premium • Labels • Dynamic label lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const name = `${DYN_MARKER}-${Date.now()}`;
  const editedName = `${name}-edited`;
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

  test('edit', async ({ labelsPage }) => {
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
    await expect(row).toContainText(editedDescription);
  });

  test('delete', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.runRowAction(editedName, 'Delete');

    await expect(labelsPage.deleteModal).toBeVisible();
    await labelsPage.deleteConfirmButton.click();
    await labelsPage.toast.expectSuccess(`Successfully deleted ${editedName}.`);

    await labelsPage.goto();
    await expect(labelsPage.rowFor(editedName)).toHaveCount(0);
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

/**
 * Manual labels group hosts by explicit membership. The host is picked from
 * the instance via the API (offline hosts still resolve), so this stays
 * host-independent.
 */
test.describe('Premium • Labels • Manual label lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const name = `${MAN_MARKER}-${Date.now()}`;
  const editedName = `${name}-edited`;
  const description = 'Playwright manual label';
  const editedDescription = `${description} (edited)`;

  test.beforeAll(async ({ playwright }) => {
    await purgeLabels(playwright, MAN_MARKER);
  });

  test('create', async ({ labelsPage, request, pageHealth }) => {
    // The manual-label host-target search logs a benign 4xx to the console
    // ("Invalid usage: missing required parameter(s)") while typing; the search
    // still returns hosts and the label saves. Opt out of the console-error
    // assertion for this one test.
    pageHealth.disable();

    const hostName = await firstHostDisplayName(request);
    test.skip(!hostName, 'No hosts on the instance to add to a manual label');

    await labelsPage.goto();
    await labelsPage.clickAddLabel();
    await labelsPage.selectType('Manual');
    await labelsPage.fillDetails(name, description);
    await labelsPage.addHost(hostName!);
    await labelsPage.save();

    await labelsPage.toast.expectSuccess('Label added successfully.');
    await expect(labelsPage.page).toHaveURL(/\/labels\/manage/);

    await labelsPage.goto();
    const row = await labelsPage.locateRow(name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(description);
    await expect(row).toContainText('Manual');
  });

  test('edit', async ({ labelsPage }) => {
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
    await expect(row).toContainText(editedDescription);
  });

  test('delete', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.runRowAction(editedName, 'Delete');

    await expect(labelsPage.deleteModal).toBeVisible();
    await labelsPage.deleteConfirmButton.click();
    await labelsPage.toast.expectSuccess(`Successfully deleted ${editedName}.`);

    await labelsPage.goto();
    await expect(labelsPage.rowFor(editedName)).toHaveCount(0);
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
