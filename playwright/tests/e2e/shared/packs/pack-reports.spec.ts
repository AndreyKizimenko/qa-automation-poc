/**
 * Attaching a saved report (query) to a pack on a schedule. Tier-agnostic:
 * same flow runs on free and premium, no team scope. Each step is its own
 * serial sub-test so a per-step failure pinpoints which action regressed.
 *
 * The scheduled query is what actually produces pack results: its frequency
 * and logging mode decide what osquery ships to the result log. The rendered
 * table exposes Query / Frequency / Performance impact only, so the logging
 * mode itself is asserted through the API in tests/api/packs.spec.ts.
 *
 * There is no closing activity-feed sub-test here, unlike the pack CRUD
 * lifecycle: scheduling a query emits no activity — `ScheduleQuery` in
 * server/service/scheduled_queries.go records none, where pack create / edit
 * / delete each do.
 */
import { test, expect } from '@fixtures';
import {
  createPack,
  createReport,
  deletePack,
  deleteReport,
  listPackScheduledQueries,
  withApiRequest,
} from '@helpers/api';

test.describe('Pack reports', () => {
  test.describe.configure({ mode: 'serial' });

  const stamp = Date.now();
  const packName = `Report Pack ${stamp}`;
  const queryName = `report_pack_query_${stamp}`;
  let packId: number;
  let queryId: number;

  // The pack and the query it schedules are preconditions, not the behaviour
  // under test — creating a pack through the UI is packs.spec.ts's job. Seeding
  // them over the API keeps each sub-test below on the scheduling flow alone.
  test.beforeAll(async () => {
    const seeded = await withApiRequest(async (request) => {
      const report = await createReport(request, { name: queryName, query: 'SELECT 1;' });
      const pack = await createPack(request, { name: packName, description: 'Report scheduling' });
      return { report, pack };
    });
    queryId = seeded.report.id;
    packId = seeded.pack.id;
  });

  // The pack outlives every sub-test in the block, so it is torn down here
  // rather than inside one of them. An aborted run still leaves the
  // cleanup-teardown project to wipe both entities.
  test.afterAll(async () => {
    await withApiRequest(async (request) => {
      await deletePack(request, packId);
      await deleteReport(request, queryId);
    });
  });

  test('pack starts with no reports', async ({ packsList, packEdit }) => {
    // Packs has no top-nav entry; the list at /packs/manage is the way in.
    await packsList.goto();
    await packsList.openPack(packName);
    await expect(packEdit.noReportsHeading).toBeVisible();
  });

  test('add report to pack on a schedule', async ({ packsList, packEdit, request }) => {
    await packsList.goto();
    await packsList.openPack(packName);
    await packEdit.addScheduledQuery(queryName, 60);

    // The table renders the interval humanised rather than as the seconds given.
    const row = packEdit.scheduledQueryRow(queryName);
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 minute');

    // Confirms the schedule reached the server, not just the table's own render.
    const scheduled = await listPackScheduledQueries(request, packId);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].interval).toBe(60);
    expect(scheduled[0].query_id).toBe(queryId);
  });
});
