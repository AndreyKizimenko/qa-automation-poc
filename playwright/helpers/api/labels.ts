// Label API helpers. Fleet's cleanup projects don't wipe labels, so CRUD specs
// self-heal leftover test labels via these; batch specs resolve label members.
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/**
 * Delete every non-builtin label whose name contains `marker`. Substring
 * match so a renamed "<marker>…-edited" label is swept up alongside its
 * original. Safe to call when nothing matches.
 */
export async function deleteLabelsMatching(
  request: APIRequestContext,
  marker: string,
): Promise<void> {
  const res = await request.get(apiUrl('labels'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const labels = (body.labels ?? []) as Array<{ id: number; name: string; label_type?: string }>;
  await Promise.all(
    labels
      .filter((l) => l.label_type !== 'builtin' && l.name.includes(marker))
      .map((l) =>
        request
          .delete(apiUrl(`labels/id/${l.id}`), { headers: authHeaders() })
          .catch((err) => console.warn(`[deleteLabelsMatching] ${l.id}:`, err)),
      ),
  );
}

/** A label's id by exact name, e.g. a built-in platform label ("macOS"). */
export async function getLabelId(request: APIRequestContext, name: string): Promise<number> {
  const res = await request.get(apiUrl('labels'), { headers: authHeaders() });
  await expect(res, 'Failed to list labels').toBeOK();
  const label = ((await res.json()).labels as Array<{ id: number; name: string }>).find((l) => l.name === name);
  if (!label) throw new Error(`no label named "${name}"`);
  return label.id;
}

/**
 * Ids of the hosts a label holds, narrowed by fleet and status. This endpoint
 * leaves `orbit_version` null, so read per-host detail from `/hosts` instead.
 */
export async function listLabelHostIds(
  request: APIRequestContext,
  labelId: number,
  opts: { fleetId?: number; status?: 'online' | 'offline' } = {},
): Promise<Set<number>> {
  const params: Record<string, string> = { per_page: '1000' };
  if (opts.fleetId !== undefined) params.fleet_id = String(opts.fleetId);
  if (opts.status) params.status = opts.status;
  const res = await request.get(apiUrl(`labels/${labelId}/hosts`), { headers: authHeaders(), params });
  await expect(res, `Failed to list label ${labelId}'s hosts`).toBeOK();
  return new Set(((await res.json()).hosts ?? []).map((h: { id: number }) => h.id));
}
