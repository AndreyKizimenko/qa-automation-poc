import { APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { apiUrl, sessionAuthHeaders } from './core';

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
 * Find one vulnerable software title matching any of the given osquery
 * `source` values (e.g. `apps` macOS, `deb_packages`, `programs` Windows,
 * `chocolatey_packages`, `rpm_packages`).
 */
export async function findVulnerableSoftwareBySource(
  baseURL: string,
  token: string,
  sources: string[],
  perPage = 100,
): Promise<SoftwareTitleRef | null> {
  const res = await fetch(
    `${baseURL}${apiUrl('software/titles')}?vulnerable=true&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;

  const body = await res.json();
  const titles = body.software_titles as Array<{ id: number; name: string; source: string }>;
  if (!titles?.length) return null;

  const match = titles.find((t) => sources.includes(t.source));
  if (!match) return null;

  return { id: match.id, name: match.name, source: match.source };
}

/** Match against `software_package.name`. Pages up to `maxPages × perPage`. */
export async function findSoftwareTitleByPackageName(
  request: APIRequestContext,
  fleetId: number,
  packageName: string,
  maxPages = 5,
  perPage = 100,
): Promise<SoftwarePackageRef | null> {
  for (let page = 0; page < maxPages; page++) {
    const res = await request.get(apiUrl('software/titles'), {
      headers: sessionAuthHeaders(),
      params: {
        fleet_id: String(fleetId),
        per_page: String(perPage),
        page: String(page),
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
    headers: sessionAuthHeaders(),
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
      headers: sessionAuthHeaders(),
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

/** Fetches a single software title's metadata, including its display name. */
export async function getSoftwareTitle(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<{ id: number; name: string; source: string }> {
  const res = await request.get(apiUrl(`software/titles/${titleId}`), {
    headers: sessionAuthHeaders(),
    params: { fleet_id: String(fleetId) },
  });
  await expect(res, `Failed to fetch software title ${titleId}`).toBeOK();
  const body = await res.json();
  const t = body.software_title;
  return { id: t.id, name: t.name, source: t.source };
}
