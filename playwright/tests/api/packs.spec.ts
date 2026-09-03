/**
 * Pack API contracts. Tier-agnostic — packs have no team scope and no
 * premium gating, so this runs on both the free and premium projects.
 *
 * These are the guarantees the pack UI and `fleetctl` both sit on: where the
 * schedule endpoint is served, that a scheduled query's logging mode round
 * trips, and that names stay unique.
 */
import { test, expect } from '@playwright/test';
import {
  apiUrl,
  apiLatestUrl,
  authHeaders,
  createPack,
  createReport,
  deletePack,
  deleteReport,
  deleteScheduledQuery,
  getPack,
  listPackScheduledQueries,
  schedulePackQuery,
  setPackDisabled,
} from '@helpers/api';

test.describe('Packs API', () => {
  test('scheduling is served at /schedule on v1 and /packs/schedule on latest', async ({
    request,
  }) => {
    const stamp = Date.now();
    const report = await createReport(request, { name: `sched_ver_q_${stamp}` });
    const pack = await createPack(request, { name: `sched_ver_pack_${stamp}` });

    try {
      // Fleet registers POST /packs/schedule StartingAtVersion("2022-04"), so the
      // v1 channel does not serve it — v1 keeps the same handler at /schedule.
      const v1Packs = await request.post(apiUrl('packs/schedule'), {
        headers: authHeaders(),
        data: { pack_id: pack.id, query_id: report.id, interval: 60 },
      });
      expect(v1Packs.status()).toBe(405);

      const v1Schedule = await request.post(apiUrl('schedule'), {
        headers: authHeaders(),
        data: { pack_id: pack.id, query_id: report.id, interval: 60 },
      });
      await expect(v1Schedule).toBeOK();

      const latestPacks = await request.post(apiLatestUrl('packs/schedule'), {
        headers: authHeaders(),
        data: { pack_id: pack.id, query_id: report.id, interval: 90 },
      });
      await expect(latestPacks).toBeOK();
    } finally {
      await deletePack(request, pack.id);
      await deleteReport(request, report.id);
    }
  });

  test('scheduled query records its logging mode', async ({ request }) => {
    const stamp = Date.now();
    const snapshotQuery = await createReport(request, { name: `log_snap_q_${stamp}` });
    const differentialQuery = await createReport(request, { name: `log_diff_q_${stamp}` });
    const pack = await createPack(request, { name: `logging_pack_${stamp}` });

    try {
      await schedulePackQuery(request, {
        packId: pack.id,
        queryId: snapshotQuery.id,
        interval: 60,
        logging: 'snapshot',
      });
      await schedulePackQuery(request, {
        packId: pack.id,
        queryId: differentialQuery.id,
        interval: 60,
        logging: 'differential',
      });

      const scheduled = await listPackScheduledQueries(request, pack.id);
      expect(scheduled).toHaveLength(2);

      const byQuery = new Map(scheduled.map((s) => [s.query_id, s]));
      expect(byQuery.get(snapshotQuery.id)?.snapshot).toBe(true);
      expect(byQuery.get(differentialQuery.id)?.snapshot).not.toBe(true);
    } finally {
      await deletePack(request, pack.id);
      await deleteReport(request, snapshotQuery.id);
      await deleteReport(request, differentialQuery.id);
    }
  });

  test('removing a scheduled query detaches it from the pack', async ({ request }) => {
    const stamp = Date.now();
    const report = await createReport(request, { name: `detach_q_${stamp}` });
    const pack = await createPack(request, { name: `detach_pack_${stamp}` });

    try {
      const scheduled = await schedulePackQuery(request, {
        packId: pack.id,
        queryId: report.id,
        interval: 60,
      });
      expect(await listPackScheduledQueries(request, pack.id)).toHaveLength(1);

      await deleteScheduledQuery(request, scheduled.id);
      expect(await listPackScheduledQueries(request, pack.id)).toHaveLength(0);
    } finally {
      await deletePack(request, pack.id);
      await deleteReport(request, report.id);
    }
  });

  test('disabled flag round trips', async ({ request }) => {
    const pack = await createPack(request, { name: `disabled_pack_${Date.now()}` });

    try {
      expect((await getPack(request, pack.id)).disabled).toBe(false);

      await setPackDisabled(request, pack.id, true);
      expect((await getPack(request, pack.id)).disabled).toBe(true);

      await setPackDisabled(request, pack.id, false);
      expect((await getPack(request, pack.id)).disabled).toBe(false);
    } finally {
      await deletePack(request, pack.id);
    }
  });

  test('duplicate pack name is rejected', async ({ request }) => {
    const name = `dupe_pack_${Date.now()}`;
    const pack = await createPack(request, { name });

    try {
      const res = await request.post(apiUrl('packs'), {
        headers: authHeaders(),
        data: { name, description: 'second pack, same name' },
      });
      expect(res.ok()).toBe(false);
      expect(res.status()).toBe(409);
    } finally {
      await deletePack(request, pack.id);
    }
  });
});
