/**
 * Packs CRUD lifecycle (UI-only). Tier-agnostic: same flow runs on free
 * and premium, no team scope. Each lifecycle step is its own serial
 * sub-test so a per-step failure pinpoints which action regressed.
 */
import { test, expect } from '@fixtures';
import { authHeaders, assertActivity, apiUrl } from '@helpers/api';
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

  // eslint-disable-next-line playwright/no-skipped-test -- tracked in TODO.md
  test.skip('pack query executes on targeted host', async ({ request }) => {
    test.setTimeout(5 * 60_000);

    const hostsRes = await request.get(apiUrl('hosts'), { headers: authHeaders() });
    await expect(hostsRes).toBeOK();
    const hostsData = await hostsRes.json();
    const host = hostsData.hosts?.[0];
    expect(host).toBeDefined();
    const hostID = host.id;

    const queriesRes = await request.get(apiUrl('queries'), { headers: authHeaders() });
    await expect(queriesRes).toBeOK();
    const queriesData = await queriesRes.json();
    let queryID: number;

    if (queriesData.queries?.length > 0) {
      queryID = queriesData.queries[0].id;
    } else {
      const createQueryRes = await request.post(apiUrl('queries'), {
        headers: authHeaders(),
        data: { query: 'SELECT 1;', name: `smoke_pack_query_${Date.now()}` },
      });
      await expect(createQueryRes).toBeOK();
      queryID = (await createQueryRes.json()).query.id;
    }

    const execPackName = `Exec Pack ${Date.now()}`;
    const createPackRes = await request.post(apiUrl('packs'), {
      headers: authHeaders(),
      data: {
        name: execPackName,
        description: 'Smoke test: verify pack query execution',
        host_ids: [hostID],
      },
    });
    await expect(createPackRes).toBeOK();
    const packID = (await createPackRes.json()).pack.id;

    const scheduleRes = await request.post(apiUrl('packs/schedule'), {
      headers: authHeaders(),
      data: { pack_id: packID, query_id: queryID, interval: 10 },
    });
    await expect(scheduleRes).toBeOK();

    const timeoutMs = 4 * 60_000;
    const pollIntervalMs = 15_000;
    let executed = false;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hostRes = await request.get(apiUrl(`hosts/${hostID}`), { headers: authHeaders() });
      await expect(hostRes).toBeOK();
      const hostData = await hostRes.json();
      const packStats = hostData.host?.pack_stats as Array<{
        pack_id: number;
        pack_name: string;
        query_stats: Array<{ executions: number; last_executed: string }>;
      }> | undefined;

      const ourPack = packStats?.find((p) => p.pack_id === packID);
      if (ourPack?.query_stats?.some((q) => q.executions > 0)) {
        executed = true;
        break;
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    await request.delete(apiUrl(`packs/id/${packID}`), { headers: authHeaders() });

    expect(executed).toBeTruthy();
  });
});
