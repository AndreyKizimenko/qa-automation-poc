import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

interface FmaListEntry {
  id: number;
  slug: string;
  name: string;
  platform: string;
}

/**
 * Look up the integer id Fleet uses internally for a Fleet-Maintained App
 * by its catalog slug (e.g. `airtame/darwin`). The slug is what
 * `helpers/catalogs/fma.ts` exposes; the id is what the Add FMA endpoint
 * requires. Caches results across calls.
 */
const _fmaIdBySlug = new Map<string, number>();

export async function findFmaIdBySlug(
  request: APIRequestContext,
  fleetId: number,
  slug: string,
): Promise<number> {
  const cached = _fmaIdBySlug.get(slug);
  if (cached) return cached;

  const res = await request.get(apiUrl('software/fleet_maintained_apps'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), per_page: '500' },
  });
  await expect(res, `Failed to list Fleet-maintained apps`).toBeOK();
  const body = await res.json();
  const apps = (body.fleet_maintained_apps ?? []) as FmaListEntry[];

  for (const app of apps) {
    if (app.slug) _fmaIdBySlug.set(app.slug, app.id);
  }

  const found = _fmaIdBySlug.get(slug);
  if (!found) throw new Error(`No Fleet-maintained app found with slug "${slug}"`);
  return found;
}

/**
 * Adds a Fleet-Maintained App (by slug) to a fleet. Resolves the slug to
 * the FMA id, then POSTs to `software/fleet_maintained_apps`. Returns the
 * resulting `software_title_id`. The actual CDN fetch happens
 * asynchronously on the server; the title may take a few seconds to
 * appear in the fleet's titles list.
 */
export async function addFmaToFleet(
  request: APIRequestContext,
  fleetId: number,
  slug: string,
): Promise<{ titleId: number }> {
  const fmaId = await findFmaIdBySlug(request, fleetId, slug);
  const res = await request.post(apiUrl('software/fleet_maintained_apps'), {
    headers: authHeaders(),
    data: { fleet_maintained_app_id: fmaId, fleet_id: fleetId },
    timeout: 120_000,
  });
  await expect(res, `Failed to add FMA "${slug}" to fleet ${fleetId}`).toBeOK();
  const body = await res.json();
  if (!body.software_title_id) {
    throw new Error(`FMA add returned no software_title_id: ${JSON.stringify(body)}`);
  }
  return { titleId: body.software_title_id };
}
