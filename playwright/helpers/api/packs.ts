// Pack ("2017 pack") API helpers for seeding/tearing down preconditions.
//
// Scheduling note: `apiUrl` is pinned to `/api/v1`, and the pack-schedule
// routes are split across API versions in Fleet's router
// (server/service/handler.go). `POST /packs/schedule` is registered
// `StartingAtVersion("2022-04")`, so on v1 it 405s; v1 serves the same
// handler at `POST /schedule`. These helpers use the v1 spelling so they
// keep working through `apiUrl`.
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface PackRef {
  id: number;
  name: string;
}

export interface ScheduledQueryRef {
  id: number;
  packId: number;
  queryId: number;
  interval: number;
}

/** How osquery ships this scheduled query's results to the log destination. */
export type PackLoggingType = 'snapshot' | 'differential' | 'differential_ignore_removals';

/** Per-query execution counters Fleet records from a host's reported stats. */
export interface PackQueryStats {
  scheduled_query_name: string;
  query_name: string;
  pack_id: number;
  pack_name: string;
  executions: number;
  interval: number;
  last_executed: string;
  output_size: number;
  system_time: number;
  user_time: number;
  wall_time: number;
  denylisted: boolean;
}

export interface HostPackStats {
  pack_id: number;
  pack_name: string;
  type: string;
  query_stats: PackQueryStats[];
}

export async function createPack(
  request: APIRequestContext,
  opts: {
    name: string;
    description?: string;
    hostIds?: number[];
    labelIds?: number[];
    teamIds?: number[];
  },
): Promise<PackRef> {
  const res = await request.post(apiUrl('packs'), {
    headers: authHeaders(),
    data: {
      name: opts.name,
      description: opts.description ?? '',
      host_ids: opts.hostIds ?? [],
      label_ids: opts.labelIds ?? [],
      team_ids: opts.teamIds ?? [],
    },
  });
  await expect(res).toBeOK();
  const pack = (await res.json()).pack;
  return { id: pack.id, name: pack.name };
}

export async function getPack(
  request: APIRequestContext,
  packId: number,
): Promise<{ id: number; name: string; disabled: boolean; host_ids: number[] }> {
  const res = await request.get(apiUrl(`packs/${packId}`), { headers: authHeaders() });
  await expect(res).toBeOK();
  return (await res.json()).pack;
}

export async function setPackDisabled(
  request: APIRequestContext,
  packId: number,
  disabled: boolean,
): Promise<void> {
  const res = await request.patch(apiUrl(`packs/${packId}`), {
    headers: authHeaders(),
    data: { disabled },
  });
  await expect(res).toBeOK();
}

export async function deletePack(request: APIRequestContext, packId: number): Promise<void> {
  await request.delete(apiUrl(`packs/id/${packId}`), { headers: authHeaders() });
}

/**
 * Attach a query to a pack on a schedule. `interval` is in seconds and
 * `logging` maps onto osquery's snapshot/differential result modes, which
 * decide the shape of what lands in the result log.
 */
export async function schedulePackQuery(
  request: APIRequestContext,
  opts: {
    packId: number;
    queryId: number;
    interval: number;
    logging?: PackLoggingType;
    platform?: string;
    shard?: number;
  },
): Promise<ScheduledQueryRef> {
  const logging = opts.logging ?? 'snapshot';
  const res = await request.post(apiUrl('schedule'), {
    headers: authHeaders(),
    data: {
      pack_id: opts.packId,
      query_id: opts.queryId,
      interval: opts.interval,
      snapshot: logging === 'snapshot',
      removed: logging === 'differential',
      ...(opts.platform !== undefined ? { platform: opts.platform } : {}),
      ...(opts.shard !== undefined ? { shard: opts.shard } : {}),
    },
  });
  await expect(res).toBeOK();
  const s = (await res.json()).scheduled;
  return { id: s.id, packId: s.pack_id, queryId: s.query_id, interval: s.interval };
}

export async function listPackScheduledQueries(
  request: APIRequestContext,
  packId: number,
): Promise<Array<{ id: number; query_id: number; interval: number; snapshot: boolean | null }>> {
  const res = await request.get(apiUrl(`packs/${packId}/scheduled`), { headers: authHeaders() });
  await expect(res).toBeOK();
  return (await res.json()).scheduled ?? [];
}

export async function deleteScheduledQuery(
  request: APIRequestContext,
  scheduledQueryId: number,
): Promise<void> {
  await request.delete(apiUrl(`schedule/${scheduledQueryId}`), { headers: authHeaders() });
}

/** Reads the pack-scoped execution stats a host has reported back to Fleet. */
export async function hostPackStats(
  request: APIRequestContext,
  hostId: number,
  packId: number,
): Promise<HostPackStats | undefined> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res).toBeOK();
  const stats = ((await res.json()).host?.pack_stats ?? []) as HostPackStats[];
  return stats.find((p) => p.pack_id === packId);
}

/** Flags the host to re-run its detail queries on the next check-in. */
export async function refetchHost(request: APIRequestContext, hostId: number): Promise<void> {
  await request.post(apiUrl(`hosts/${hostId}/refetch`), { headers: authHeaders() });
}
