/**
 * Attaching a saved report (query) to a pack on a schedule, from the pack's
 * edit page. Tier-agnostic — packs carry no team scope.
 *
 * The scheduled query is what actually produces pack results: its frequency
 * and logging mode decide what osquery ships to the result log. The rendered
 * table exposes Query / Frequency / Performance impact only, so the logging
 * mode itself is asserted through the API in tests/api/packs.spec.ts.
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

  test.beforeAll(async () => {
    const seeded = await withApiRequest(async (request) => {
      const report = await createReport(request, { name: queryName, query: 'SELECT 1;' });
      const pack = await createPack(request, { name: packName, description: 'Report scheduling' });
      return { report, pack };
    });
    queryId = seeded.report.id;
    packId = seeded.pack.id;
  });

  test.afterAll(async () => {
    await withApiRequest(async (request) => {
      await deletePack(request, packId);
      await deleteReport(request, queryId);
    });
  });

  test('pack starts with no reports', async ({ packEdit }) => {
    await packEdit.goto(packId);
    await expect(packEdit.noReportsHeading).toBeVisible();
  });

  test('add report to pack on a schedule', async ({ packEdit, request }) => {
    await packEdit.goto(packId);
    await packEdit.addScheduledQuery(queryName, 60);

    // The table humanises the interval it was given.
    const row = packEdit.scheduledQueryRow(queryName);
    await expect(row).toBeVisible();
    await expect(row).toContainText('1 minute');

    const scheduled = await listPackScheduledQueries(request, packId);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].interval).toBe(60);
    expect(scheduled[0].query_id).toBe(queryId);
  });
});
