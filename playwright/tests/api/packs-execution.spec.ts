/**
 * A pack scheduled onto a real host actually runs there, and the results it
 * produces are recorded back on the host.
 *
 * What this can and cannot see: Fleet ships pack results to the configured
 * result-log destination (`filesystem` on the QA instances, written on the
 * server), which a browser-side suite has no access to. The observable proof
 * that results were produced is the per-query stats the host reports back —
 * a non-zero execution count, a recent `last_executed`, and a non-zero
 * `output_size` meaning rows were emitted, not just a query dispatched.
 *
 * Timing: the agent picks up a new pack on its next config refresh (the QA
 * sim fleet runs `--config_interval 1m`) and only reports scheduled-query
 * stats when Fleet asks for host details, which is hourly by default. The
 * refetch call short-circuits that wait by flagging the host to re-run its
 * detail queries on the next check-in.
 */
import { test, expect } from '@fixtures';
import {
  createPack,
  createReport,
  deletePack,
  deleteReport,
  hostPackStats,
  refetchHost,
  schedulePackQuery,
} from '@helpers/api';

test.describe('Packs execution', () => {
  test('pack query executes on a targeted host and reports results', async ({
    request,
    liveMacosHost,
  }) => {
    test.setTimeout(8 * 60_000);

    const startedAt = Date.now();
    // Timestamp plus a random tag keeps names unique under --repeat-each.
    const stamp = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    const report = await createReport(request, {
      name: `pack_exec_q_${stamp}`,
      query: 'SELECT 1;',
    });
    const pack = await createPack(request, {
      name: `pack_exec_${stamp}`,
      description: 'Verifies a pack runs on a targeted host',
      hostIds: [liveMacosHost.id],
    });

    try {
      await schedulePackQuery(request, {
        packId: pack.id,
        queryId: report.id,
        interval: 30,
        logging: 'snapshot',
      });

      // Fleet lists the schedule on the host as soon as it is targeted, with a
      // zeroed execution count, so presence alone proves nothing — poll for the
      // host to report that it actually ran the query.
      await expect
        .poll(
          async () => {
            await refetchHost(request, liveMacosHost.id);
            const stats = await hostPackStats(request, liveMacosHost.id, pack.id);
            return stats?.query_stats?.[0]?.executions ?? 0;
          },
          {
            message: `${liveMacosHost.displayName} never reported executing pack "${pack.name}"`,
            intervals: [20_000],
            timeout: 7 * 60_000,
          },
        )
        .toBeGreaterThan(0);

      const stats = await hostPackStats(request, liveMacosHost.id, pack.id);
      expect(stats?.pack_name).toBe(pack.name);

      const queryStats = stats?.query_stats?.[0];
      expect(queryStats?.query_name).toBe(report.name);
      expect(queryStats?.interval).toBe(30);
      expect(queryStats?.denylisted).toBe(false);

      // Rows were emitted to the result log, not just a query dispatched.
      expect(queryStats?.output_size).toBeGreaterThan(0);

      // A real execution timestamp, not the zero-value placeholder Fleet
      // renders for a schedule the host has not run yet. The pack did not exist
      // before the test started, so anything earlier than that (allowing for
      // clock skew between the runner and the server) is the placeholder.
      const lastExecuted = new Date(queryStats?.last_executed ?? 0).getTime();
      expect(lastExecuted).toBeGreaterThan(startedAt - 10 * 60_000);
    } finally {
      await deletePack(request, pack.id);
      await deleteReport(request, report.id);
    }
  });
});
