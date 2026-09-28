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
 * How many catalog entries the Fleet-maintained list holds for a fleet under
 * the same filters the Add software UI offers. Entries are per platform, so an
 * app available on macOS and Windows counts twice — which is exactly what the
 * UI's "N items" summary reports.
 *
 * `availableOnly` mirrors the "Hide added apps" slider (`available=true`), and
 * `platform` mirrors the platform filter.
 */
export async function countFleetMaintainedApps(
  request: APIRequestContext,
  fleetId: number,
  opts: { platform?: 'darwin' | 'windows'; availableOnly?: boolean } = {},
): Promise<number> {
  const res = await request.get(apiUrl('software/fleet_maintained_apps'), {
    headers: authHeaders(),
    params: {
      fleet_id: String(fleetId),
      per_page: '1',
      ...(opts.platform ? { platform: opts.platform } : {}),
      ...(opts.availableOnly ? { available: 'true' } : {}),
    },
  });
  await expect(res, 'Failed to count Fleet-maintained apps').toBeOK();
  const body = await res.json();
  return body.count as number;
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
    timeout: 60_000,
  });
  await expect(res, `Failed to add FMA "${slug}" to fleet ${fleetId}`).toBeOK();
  const body = await res.json();
  if (!body.software_title_id) {
    throw new Error(`FMA add returned no software_title_id: ${JSON.stringify(body)}`);
  }
  return { titleId: body.software_title_id };
}

/** A Fleet-maintained app installed on a fleet, with the builds Fleet has cached for it. */
export interface FleetMaintainedTitle {
  titleId: number;
  /** Title name as the Library list renders it ("Google Chrome"). */
  name: string;
  /** `darwin` or `windows` — the installer's platform, not the title's source. */
  platform: string;
  /** Cached versions, newest first, in the order the Versions modal lists them. */
  versions: string[];
}

/**
 * Every Fleet-maintained app currently on a fleet, newest-cached-version first
 * per entry.
 *
 * The titles list already carries `fleet_maintained_versions`, so one request
 * answers "which durable app has more than one build cached today" without a
 * per-title round trip. An app added from a custom package has no
 * `fleet_maintained_app_id` and is filtered out.
 *
 * Note that the same app on macOS and Windows is two titles with the *same*
 * name — resolve one by name **and** platform, never by name alone.
 */
export async function listFleetMaintainedTitles(
  request: APIRequestContext,
  fleetId: number,
): Promise<FleetMaintainedTitle[]> {
  const res = await request.get(apiUrl('software/titles'), {
    headers: authHeaders(),
    params: {
      fleet_id: String(fleetId),
      available_for_install: 'true',
      order_key: 'name',
      per_page: '200',
    },
  });
  await expect(res, `Failed to list software titles on fleet ${fleetId}`).toBeOK();
  const body = await res.json();
  const titles = (body.software_titles ?? []) as Array<{
    id: number;
    name: string;
    software_package?: {
      platform?: string;
      fleet_maintained_app_id?: number | null;
      fleet_maintained_versions?: { version: string }[] | null;
    } | null;
  }>;

  return titles
    .filter((t) => t.software_package?.fleet_maintained_app_id)
    .map((t) => ({
      titleId: t.id,
      name: t.name,
      platform: t.software_package?.platform ?? '',
      versions: (t.software_package?.fleet_maintained_versions ?? []).map((v) => v.version),
    }));
}

/**
 * Sets (or clears) a Fleet-maintained title's version pin the way the Versions
 * modal does: a multipart PATCH whose `version` field carries `''` for latest,
 * `'1.2.3'` for an exact build or `'^1'` for a major. Used to restore a title
 * the UI left pinned — an exact pin freezes Fleet's hourly auto-update cron for
 * that title, so a spec that walks away from one stops the fleet accumulating
 * new versions.
 */
export async function setPinnedVersion(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
  version: string,
): Promise<void> {
  const res = await request.patch(apiUrl(`software/titles/${titleId}/package`), {
    headers: authHeaders(),
    multipart: { fleet_id: String(fleetId), version },
    timeout: 60_000,
  });
  await expect(res, `Failed to set version pin on title ${titleId}`).toBeOK();
}
