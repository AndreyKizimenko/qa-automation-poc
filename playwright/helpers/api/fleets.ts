import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders, type FleetRef } from './core';

/** Exact name match. The `query` API param is fuzzy, so we filter client-side. */
export async function findFleetByName(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef | null> {
  const res = await request.get(apiUrl('fleets'), {
    headers: authHeaders(),
    params: { query: name, per_page: '50' },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const match = (body.fleets ?? body.teams ?? []).find(
    (t: { id: number; name: string }) => t.name === name,
  );
  return match ? { id: match.id, name: match.name } : null;
}

export async function createFleet(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef> {
  const res = await request.post(apiUrl('fleets'), {
    headers: authHeaders(),
    data: { name },
  });
  await expect(res, `Failed to create fleet "${name}"`).toBeOK();
  const body = await res.json();
  // The teams→fleets rename is in transition; prefer `fleet`, fall back to `team`.
  const ref = body.fleet ?? body.team;
  return { id: ref.id, name: ref.name };
}

export async function deleteFleet(
  request: APIRequestContext,
  id: number,
  opts: { ignoreMissing?: boolean } = {},
): Promise<void> {
  const res = await request.delete(apiUrl(`fleets/${id}`), {
    headers: authHeaders(),
  });
  if (opts.ignoreMissing && res.status() === 404) return;
  await expect(res, `Failed to delete fleet ${id}`).toBeOK();
}

/** Delete-then-create. Use in setup specs to clear stale state from prior runs. */
export async function recreateFleet(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef> {
  const existing = await findFleetByName(request, name);
  if (existing) await deleteFleet(request, existing.id, { ignoreMissing: true });
  return createFleet(request, name);
}
