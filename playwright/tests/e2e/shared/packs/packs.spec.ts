/**
 * Packs CRUD lifecycle (UI-only). Tier-agnostic: same flow runs on free
 * and premium, no team scope. Each lifecycle step is its own serial
 * sub-test so a per-step failure pinpoints which action regressed.
 */
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';

test.describe('Packs CRUD', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const packName = `Smoke Pack ${stamp}`;
  const description = 'Automated smoke test pack';
  const updatedDescription = 'Updated smoke test pack description';

  test('create', async ({ packsList, packEdit, page, request }) => {
    // Packs has no top-nav entry; go straight to /packs/manage.
    await packsList.goto();
    await expect(page).toHaveURL(/\/packs/);
    await expect(packsList.heading).toBeVisible();

    // Create with a host target so the row exposes a non-zero host count.
    await packsList.createNewPackButton.click();
    await expect(page).toHaveURL(/\/packs\/new/);
    await packEdit.fillBasics(packName, description);
    await packEdit.addFirstHostTarget('a');
    await packEdit.saveNew();
    await assertActivity(request, 'created_pack', (d) => d.pack_name === packName);

    await packsList.goto();
    const packRow = packsList.packRow(packName);
    await expect(packRow).toBeVisible();
    const hostsCell = await packsList.table.cellByColumn(packRow, 'Hosts');
    expect(Number(await hostsCell.innerText())).toBeGreaterThanOrEqual(1);
  });

  test('edit', async ({ packsList, packEdit, request }) => {
    await packsList.goto();
    await packsList.openPack(packName);
    await packEdit.updateDescription(updatedDescription);

    await packsList.goto();
    await packsList.openPack(packName);
    await expect(packEdit.descriptionInput).toHaveValue(updatedDescription);
    await assertActivity(request, 'edited_pack', (d) => d.pack_name === packName);
  });

  test('delete', async ({ packsList, page, request }) => {
    await packsList.goto();
    await packsList.deletePack(packName);
    await expect(page.getByText(packName)).toBeHidden();
    await assertActivity(request, 'deleted_pack', (d) => d.pack_name === packName);
  });

  test('activity feed shows create → edit → delete', async ({ dashboard }) => {
    await dashboard.goto();
    await dashboard.expectActivities([
      activityCopy.pack.created({ name: packName }),
      activityCopy.pack.edited({ name: packName }),
      activityCopy.pack.deleted({ name: packName }),
    ]);
  });
});
