// Bulk-delete helpers used by the suite-level teardown to leave no-team
// in a known-empty state. Each helper is safe to call on an already
// empty scope and silently skips individual failures so one stuck item
// doesn't abort the rest of the cleanup.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders, sessionAuthHeaders } from './core';

/** Deletes every saved query on the instance. */
export async function deleteAllQueries(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiUrl('queries'), {
    headers: sessionAuthHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const queries = (body.queries ?? []) as Array<{ id: number }>;
  await Promise.all(
    queries.map((q) =>
      request
        .delete(apiUrl(`queries/id/${q.id}`), { headers: sessionAuthHeaders() })
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
        .delete(apiUrl(`packs/id/${p.id}`), { headers: sessionAuthHeaders() })
        .catch((err) => console.warn(`[cleanup packs] ${p.id}:`, err)),
    ),
  );
}

/** Deletes every global (no-team) policy in a single bulk call. */
export async function deleteAllGlobalPolicies(request: APIRequestContext): Promise<void> {
  const res = await request.get(apiUrl('global/policies'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const ids = ((body.policies ?? []) as Array<{ id: number }>).map((p) => p.id);
  if (ids.length === 0) return;
  await request
    .post(apiUrl('policies/delete'), {
      headers: sessionAuthHeaders(),
      data: { ids },
    })
    .catch((err) => console.warn('[cleanup policies]', err));
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
      headers: sessionAuthHeaders(),
      data: { ids },
    })
    .catch((err) => console.warn(`[cleanup team ${teamId} policies]`, err));
}
