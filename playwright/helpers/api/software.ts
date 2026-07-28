import { APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { apiUrl, authHeaders } from './core';

export interface SoftwareTitleRef {
  id: number;
  name: string;
  source: string;
}

export interface SoftwarePackageRef {
  titleId: number;
  name: string;
  packageName: string;
}

/**
 * Find one vulnerable software title per group of osquery `source` values —
 * e.g. `{ macos: ['apps'], deb: ['deb_packages'], windows: ['programs'] }`.
 * Groups with no match on the instance are absent from the result, which
 * callers turn into a platform skip.
 *
 * Resolves every group in a single paged sweep rather than one sweep per group.
 * That matters for load, not just tidiness: `vulnerable=true` is an expensive
 * query, and firing one per platform per worker has been enough to exhaust the
 * QA MySQL's temp-table space (`Error 1114 … table is full`), which used to
 * surface as a silently missing title.
 *
 * Pages up to `maxPages × perPage`. Paging is load-bearing: the QA instances
 * carry hundreds of vulnerable titles and the default ordering puts the deb
 * packages first, so a single-page lookup can only ever match `deb_packages`
 * and starves the macOS/Windows callers into skipping.
 *
 * A match must carry a CVE on one of the versions returned *for the requested
 * scope*, because callers drill from the title into a vulnerable version.
 * Fleet's `vulnerable=true` filter is not fleet-scoped
 * ([fleetdm/fleet#50059](https://github.com/fleetdm/fleet/issues/50059)), so a
 * title can be listed on the strength of a version that lives in another fleet
 * and expose no CVE to drill into here.
 *
 * `fleetId` scopes the lookup; pass the same scope the spec then navigates to.
 * Omit it on free, which has no fleets.
 *
 * A failed request throws rather than resolving to "no match": swallowing it
 * would report an API or instance problem as missing test data and silently
 * drop the caller's coverage.
 */
export async function findVulnerableSoftwareBySources<K extends string>(
  baseURL: string,
  token: string,
  sourceGroups: Record<K, string[]>,
  opts: { fleetId?: number; perPage?: number; maxPages?: number } = {},
): Promise<Partial<Record<K, SoftwareTitleRef>>> {
  const { fleetId, perPage = 100, maxPages = 5 } = opts;
  const found: Partial<Record<K, SoftwareTitleRef>> = {};
  const pending = Object.keys(sourceGroups) as K[];

  for (let page = 0; page < maxPages && pending.length; page++) {
    const params = new URLSearchParams({
      vulnerable: 'true',
      per_page: String(perPage),
      page: String(page),
    });
    if (fleetId !== undefined) params.set('fleet_id', String(fleetId));

    const res = await fetch(`${baseURL}${apiUrl('software/titles')}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `[findVulnerableSoftwareBySources] page ${page}: ` +
          `${res.status} ${(await res.text()).slice(0, 300)}`,
      );
    }

    const body = await res.json();
    const titles = (body.software_titles ?? []) as Array<{
      id: number;
      name: string;
      source: string;
      versions?: Array<{ vulnerabilities?: string[] | null }> | null;
    }>;
    if (!titles.length) break;

    const vulnerableHere = titles.filter((t) =>
      (t.versions ?? []).some((v) => (v.vulnerabilities ?? []).length > 0),
    );

    for (const key of [...pending]) {
      const match = vulnerableHere.find((t) => sourceGroups[key].includes(t.source));
      if (match) {
        found[key] = { id: match.id, name: match.name, source: match.source };
        pending.splice(pending.indexOf(key), 1);
      }
    }
  }

  return found;
}

/**
 * Match against `software_package.name`. Pages up to `maxPages × perPage`.
 *
 * Note on `available_for_install=true`: Fleet's `/software/titles` is
 * asymmetric across team scopes. For a real team (e.g. fleet_id=4) the
 * default response includes uploaded packages; for unassigned
 * (fleet_id=0) the default response excludes them, and the package only
 * appears when this filter is passed. Always-pass keeps the helper
 * consistent across both scopes and harmless on premium teams (it just
 * narrows from "all titles" to "installer titles", which is what we
 * want — we're looking for our just-uploaded installer).
 */
export async function findSoftwareTitleByPackageName(
  request: APIRequestContext,
  fleetId: number,
  packageName: string,
  maxPages = 5,
  perPage = 100,
): Promise<SoftwarePackageRef | null> {
  for (let page = 0; page < maxPages; page++) {
    const res = await request.get(apiUrl('software/titles'), {
      headers: authHeaders(),
      params: {
        fleet_id: String(fleetId),
        per_page: String(perPage),
        page: String(page),
        available_for_install: 'true',
      },
    });
    if (!res.ok()) return null;
    const body = await res.json();
    const titles = (body.software_titles ?? []) as Array<{
      id: number;
      name: string;
      software_package?: { name: string } | null;
    }>;
    if (!titles.length) return null;

    const match = titles.find((t) => t.software_package?.name === packageName);
    if (match) {
      return { titleId: match.id, name: match.name, packageName };
    }
  }
  return null;
}

/** 409 (already exists) is treated as success; the existing title is returned. */
export async function uploadSoftwarePackage(
  request: APIRequestContext,
  fleetId: number,
  filePath: string,
): Promise<SoftwarePackageRef> {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);

  const res = await request.post(apiUrl('software/package'), {
    headers: authHeaders(),
    multipart: {
      software: { name: fileName, mimeType: 'application/octet-stream', buffer },
      fleet_id: String(fleetId),
    },
    timeout: 60_000,
  });

  const status = res.status();
  if (status !== 200 && status !== 409) {
    throw new Error(
      `Upload failed for ${fileName} on fleet ${fleetId}: HTTP ${status} — ${await res.text()}`,
    );
  }

  const ref = await findSoftwareTitleByPackageName(request, fleetId, fileName);
  if (!ref) throw new Error(`Uploaded ${fileName} but couldn't find it in software titles`);
  return ref;
}

/** Removes the package from the library. Does not uninstall from hosts. */
export async function deleteSoftwareTitle(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<void> {
  const res = await request.delete(
    apiUrl(`software/titles/${titleId}/available_for_install`),
    {
      headers: authHeaders(),
      params: { fleet_id: String(fleetId) },
    },
  );
  const status = res.status();
  if (status === 404 || status === 204 || status === 200) return;
  throw new Error(
    `Failed to delete software title ${titleId} for fleet ${fleetId}: HTTP ${status} — ${await res.text()}`,
  );
}

/** No-op when no matching title exists. */
export async function deleteSoftwareTitleByPackageName(
  request: APIRequestContext,
  fleetId: number,
  packageName: string,
): Promise<void> {
  const existing = await findSoftwareTitleByPackageName(request, fleetId, packageName);
  if (existing) await deleteSoftwareTitle(request, fleetId, existing.titleId);
}

/**
 * Delete every "available for install" title on the given fleet (custom
 * packages, FMA, VPP, Android). Does NOT touch host-discovered software
 * inventory — only entries that an admin added.
 */
export async function deleteAllInstallSoftwareTitles(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.get(apiUrl('software/titles'), {
    headers: authHeaders(),
    params: {
      fleet_id: String(fleetId),
      available_for_install: 'true',
      per_page: '100',
    },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const titles = (body.software_titles ?? []) as Array<{ id: number }>;
  await Promise.all(
    titles.map((t) =>
      deleteSoftwareTitle(request, fleetId, t.id).catch((err) => {
        console.warn(`[software cleanup] failed to delete title ${t.id}:`, err);
      }),
    ),
  );
}

/** Fetches a single software title's metadata, including its display name. */
export async function getSoftwareTitle(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<{ id: number; name: string; source: string }> {
  const res = await request.get(apiUrl(`software/titles/${titleId}`), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId) },
  });
  await expect(res, `Failed to fetch software title ${titleId}`).toBeOK();
  const body = await res.json();
  const t = body.software_title;
  return { id: t.id, name: t.name, source: t.source };
}

export interface SoftwarePackageDetail {
  name: string;
  selfService: boolean;
}

/**
 * Reads a title's active installer package metadata. `self_service` lives on
 * `software_title.software_package` (a back-compat alias Fleet still returns,
 * pointing at the first-added package; `packages[0]` is the modern shape).
 * Returns null for titles with no custom package (FMA / app-store /
 * host-reported). The definitive way to verify an Edit-software round-trip
 * persisted — a reopened modal renders stale config.
 */
export async function getSoftwarePackage(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<SoftwarePackageDetail | null> {
  const res = await request.get(apiUrl(`software/titles/${titleId}`), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId) },
  });
  await expect(res, `Failed to fetch software title ${titleId}`).toBeOK();
  const body = await res.json();
  const t = body.software_title;
  const pkg = t?.software_package ?? t?.packages?.[0];
  if (!pkg) return null;
  return { name: pkg.name, selfService: !!pkg.self_service };
}
