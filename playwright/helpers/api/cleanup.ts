// Bulk-delete helpers used by the suite-level teardown to leave no-team
// in a known-empty state. Each helper is safe to call on an already
// empty scope and silently skips individual failures so one stuck item
// doesn't abort the rest of the cleanup.
import { APIRequestContext } from '@playwright/test';
import { apiLatestUrl, apiUrl, authHeaders } from './core';

/** Deletes every global saved query (report); a fleet's own reports aren't listed, so they stay. */
export async function deleteAllQueries(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiUrl('queries'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const queries = (body.queries ?? []) as Array<{ id: number }>;
  await Promise.all(
    queries.map((q) =>
      request
        .delete(apiUrl(`queries/id/${q.id}`), { headers: authHeaders() })
        .catch((err) => console.warn(`[cleanup queries] ${q.id}:`, err)),
    ),
  );
}

/** Deletes every pack on the instance. */
export async function deleteAllPacks(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiUrl('packs'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const packs = (body.packs ?? []) as Array<{ id: number }>;
  await Promise.all(
    packs.map((p) =>
      request
        .delete(apiUrl(`packs/id/${p.id}`), { headers: authHeaders() })
        .catch((err) => console.warn(`[cleanup packs] ${p.id}:`, err)),
    ),
  );
}

/**
 * Deletes every global (no-team) policy in a single bulk call. Both calls go
 * to the current API version: Fleet serves the global policy listing and its
 * bulk delete as `/api/latest/fleet/policies` and `/policies/delete` (routes
 * that start at the 2022-04 version), while `/api/v1` still answers the old
 * `global/policies` listing but 404s the delete — a 404 that a `.catch` never
 * sees, which is how this wipe once deleted nothing for weeks. A non-OK answer
 * from either call throws, so a wipe that stops working fails the run instead
 * of leaving the gitops-provisioned global policies in place while every doc
 * says they are gone.
 */
export async function deleteAllGlobalPolicies(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiLatestUrl('policies'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) {
    throw new Error(`[cleanup policies] GET ${apiLatestUrl('policies')} → HTTP ${res.status()}: ${await res.text()}`);
  }
  const body = await res.json();
  const ids = ((body.policies ?? []) as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) return;
  const del = await request.post(apiLatestUrl('policies/delete'), {
    headers: authHeaders(),
    data: { ids },
  });
  if (!del.ok()) {
    throw new Error(
      `[cleanup policies] POST ${apiLatestUrl('policies/delete')} → HTTP ${del.status()}: ${await del.text()}`,
    );
  }
}

/** Deletes every policy scoped to a specific team in a single bulk call. */
export async function deleteAllTeamPolicies(
  request: APIRequestContext,
  teamId: number,
): Promise<void> {
  const res = await request.get(apiUrl(`teams/${teamId}/policies`), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const ids = ((body.policies ?? []) as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) return;
  await request
    .post(apiUrl(`teams/${teamId}/policies/delete`), {
      headers: authHeaders(),
      data: { ids },
    })
    .catch((err) => console.warn(`[cleanup team ${teamId} policies]`, err));
}
