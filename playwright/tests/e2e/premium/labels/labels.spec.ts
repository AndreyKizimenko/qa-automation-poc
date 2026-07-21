/**
 * Premium • Labels • Dynamic label lifecycle. Full CRUD on the dedicated
 * Labels page as a serial lifecycle (create → edit → delete → activity feed),
 * per the suite's CRUD convention. Labels are created globally (no team scope).
 *
 * Dynamic labels are host-independent: the form ships a valid default query
 * (SELECT 1 FROM os_version …), so creation needs only a name. On edit the
 * query is immutable — only name/description change.
 *
 * Grounded in frontend/pages/labels/{ManageLabelsPage,NewLabelPage,EditLabelPage}.
 */
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';

test.describe('Premium • Labels • Dynamic label lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const name = `pw-label-dyn-${stamp}`;
  const editedName = `${name}-edited`;
  const description = 'Playwright dynamic label';
  const editedDescription = `${description} (edited)`;

  test('create', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.clickAddLabel();
    await labelsPage.selectType('Dynamic');
    await labelsPage.fillDetails(name, description);
    await labelsPage.save();

    await labelsPage.toast.expectSuccess('Label added successfully.');
    await expect(labelsPage.page).toHaveURL(/\/labels\/manage/);

    const row = labelsPage.rowFor(name);
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
    const row = labelsPage.rowFor(editedName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(editedDescription);
  });

  test('delete', async ({ labelsPage }) => {
    await labelsPage.goto();
    await labelsPage.runRowAction(editedName, 'Delete');

    await expect(labelsPage.deleteModal).toBeVisible();
    await labelsPage.deleteConfirmButton.click();
    await labelsPage.toast.expectSuccess(`Successfully deleted ${editedName}.`);

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
