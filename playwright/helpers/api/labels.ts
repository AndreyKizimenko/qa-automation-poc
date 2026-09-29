// Label API helpers. The cleanup sweep removes `pw-*` labels; CRUD specs also
// self-heal their own leftovers, and targeting specs build manual labels here.
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

/**
 * Delete every non-builtin label whose name starts with `prefix` — the cleanup
 * sweep's form. A label a profile still targets is refused (422) and stays until
 * the next sweep, so the sweep deletes the profiles first.
 */
export async function deleteLabelsWithPrefix(request: APIRequestContext, prefix: string): Promise<void> {
  const res = await request.get(apiUrl('labels'), { headers: authHeaders(), params: { per_page: '500' } });
  if (!res.ok()) return;
  const labels = ((await res.json()).labels ?? []) as Array<{ id: number; name: string; label_type?: string }>;
  for (const l of labels.filter((l) => l.label_type !== 'builtin' && l.name.startsWith(prefix))) {
    const status = await deleteLabelById(request, l.id);
    if (status !== 200) console.warn(`[deleteLabelsWithPrefix] "${l.name}": HTTP ${status}`);
  }
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

/**
 * Creates a manual label holding exactly `hostIds` and returns its id. Manual
 * membership is the only kind a targeting spec can assert on: the osquery-perf
 * pool answers every dynamic label's query, so a dynamic label's hosts are
 * whatever the simulations happened to report. Name it `pw-…` so the cleanup
 * sweep can find it.
 */
export async function createManualLabel(
  request: APIRequestContext,
  name: string,
  hostIds: number[],
): Promise<number> {
  const res = await request.post(apiUrl('labels'), {
    headers: authHeaders(),
    data: { name, description: 'Playwright label-targeting fixture', host_ids: hostIds },
  });
  await expect(res, `Failed to create manual label "${name}": ${await res.text()}`).toBeOK();
  return (await res.json()).label.id;
}

/**
 * Creates a dynamic label and returns its id. Its membership is whatever hosts
 * answer `query` — on these instances, whatever the simulations report — so a
 * spec uses one only where membership doesn't matter.
 */
export async function createDynamicLabel(request: APIRequestContext, name: string, query: string): Promise<number> {
  const res = await request.post(apiUrl('labels'), {
    headers: authHeaders(),
    data: { name, description: 'Playwright dynamic label', query },
  });
  await expect(res, `Failed to create dynamic label "${name}": ${await res.text()}`).toBeOK();
  return (await res.json()).label.id;
}

/** Replaces a manual label's members with exactly `hostIds`. */
export async function setManualLabelHosts(
  request: APIRequestContext,
  labelId: number,
  hostIds: number[],
): Promise<void> {
  const res = await request.patch(apiUrl(`labels/${labelId}`), {
    headers: authHeaders(),
    data: { host_ids: hostIds },
  });
  await expect(res, `Failed to set label ${labelId}'s hosts`).toBeOK();
}

/**
 * Deletes a label by id and returns Fleet's status, without asserting it: Fleet
 * refuses (422) to delete a label a profile or declaration targets, and a spec
 * about that refusal needs the status. 404 — already gone — reads as 200.
 */
export async function deleteLabelById(request: APIRequestContext, labelId: number): Promise<number> {
  const res = await request.delete(apiUrl(`labels/id/${labelId}`), { headers: authHeaders() });
  return res.status() === 404 ? 200 : res.status();
}
