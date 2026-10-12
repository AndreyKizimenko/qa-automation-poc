import { APIRequestContext, expect } from '@playwright/test';
import * as crypto from 'crypto';
import { apiUrl, authHeaders } from './core';
import { getSoftwarePackage } from './software';

export interface FmaListEntry {
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

  // The catalog outgrew one page (1,424 entries on 4.93), so read every page:
  // a slug past the first would otherwise read as missing.
  const perPage = 500;
  for (let page = 0; !_fmaIdBySlug.has(slug); page++) {
    const res = await request.get(apiUrl('software/fleet_maintained_apps'), {
      headers: authHeaders(),
      params: { fleet_id: String(fleetId), per_page: String(perPage), page: String(page) },
    });
    await expect(res, `Failed to list Fleet-maintained apps`).toBeOK();
    const apps = ((await res.json()).fleet_maintained_apps ?? []) as FmaListEntry[];
    for (const app of apps) {
      if (app.slug) _fmaIdBySlug.set(app.slug, app.id);
    }
    if (apps.length < perPage) break;
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
 * A Fleet-maintained app the fleet hasn't added yet: the first entry the
 * catalog lists with `available=true`. Its details form offers *Add software*
 * without the "already added" lock, so anything else that disables the button
 * comes from elsewhere (gitops mode, say).
 */
export async function findAvailableFleetMaintainedApp(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ id: number; name: string; platform: string }> {
  const res = await request.get(apiUrl('software/fleet_maintained_apps'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), available: 'true', per_page: '1' },
  });
  await expect(res, 'Failed to list available Fleet-maintained apps').toBeOK();
  const app = (((await res.json()).fleet_maintained_apps ?? []) as FmaListEntry[])[0];
  if (!app) throw new Error(`Fleet ${fleetId} has already added every Fleet-maintained app`);
  return { id: app.id, name: app.name, platform: app.platform };
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
 *
 * The body is written by hand: Playwright leaves an empty-string field out of a
 * `multipart` request (a `FormData` one too), and Fleet reads a missing
 * `version` as "no change" — a 200 that unpins nothing. The pin is read back so
 * a request Fleet ignored fails here rather than in whatever runs next.
 */
export async function setPinnedVersion(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
  version: string,
): Promise<void> {
  const boundary = `----fleet-pw-${crypto.randomUUID()}`;
  const fields = { fleet_id: String(fleetId), version };
  const body =
    Object.entries(fields)
      .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
      .join('') + `--${boundary}--\r\n`;
  const res = await request.patch(apiUrl(`software/titles/${titleId}/package`), {
    headers: { ...authHeaders(), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    data: Buffer.from(body),
    timeout: 60_000,
  });
  await expect(res, `Failed to set version pin on title ${titleId}`).toBeOK();
  expect(
    (await getSoftwarePackage(request, fleetId, titleId))?.pinnedVersion,
    `title ${titleId}'s pin on fleet ${fleetId} after setting it to "${version}"`,
  ).toBe(version);
}

/** One catalog entry as `GET /software/fleet_maintained_apps/:id` returns it. */
export interface FleetMaintainedAppDetail {
  id: number;
  name: string;
  slug: string;
  platform: string;
  /** The version Fleet's manifest currently publishes. */
  version: string;
  /** The vendor URL Fleet downloads the installer from. */
  url: string;
  installScript: string;
  uninstallScript: string;
  /** The title on the fleet asked about, or null when the fleet hasn't added the app. */
  titleId: number | null;
}

/**
 * Every catalog entry, optionally for one platform. Pages until Fleet says
 * there are no more (`meta.has_next_results`): the list pages by app, not by
 * entry, so a page's length says nothing about whether another follows.
 */
export async function listAllFleetMaintainedApps(
  request: APIRequestContext,
  opts: { fleetId?: number; platform?: 'darwin' | 'windows' } = {},
): Promise<FmaListEntry[]> {
  const all: FmaListEntry[] = [];
  for (let page = 0; page < 50; page++) {
    const res = await request.get(apiUrl('software/fleet_maintained_apps'), {
      headers: authHeaders(),
      params: {
        per_page: '200',
        page: String(page),
        ...(opts.fleetId !== undefined ? { fleet_id: String(opts.fleetId) } : {}),
        ...(opts.platform ? { platform: opts.platform } : {}),
      },
    });
    await expect(res, 'Failed to list Fleet-maintained apps').toBeOK();
    const body = await res.json();
    const apps = ((body.fleet_maintained_apps ?? []) as FmaListEntry[]).filter(
      (a) => !opts.platform || a.platform === opts.platform,
    );
    all.push(...apps);
    if (!body.meta?.has_next_results) return all;
  }
  throw new Error('Fleet-maintained apps list never reported its last page in 50 pages');
}

/**
 * One catalog entry with what Fleet hydrates from its manifest: version,
 * installer URL and the default scripts. Downloads nothing — the cheap way to
 * check the whole catalog.
 */
export async function getFleetMaintainedApp(
  request: APIRequestContext,
  appId: number,
  fleetId?: number,
): Promise<FleetMaintainedAppDetail> {
  const res = await request.get(apiUrl(`software/fleet_maintained_apps/${appId}`), {
    headers: authHeaders(),
    params: fleetId !== undefined ? { fleet_id: String(fleetId) } : {},
    timeout: 60_000,
  });
  await expect(res, `Failed to read Fleet-maintained app ${appId}`).toBeOK();
  const app = (await res.json()).fleet_maintained_app;
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    platform: app.platform,
    version: app.version ?? '',
    url: app.url ?? '',
    installScript: app.install_script ?? '',
    uninstallScript: app.uninstall_script ?? '',
    titleId: app.software_title_id ?? null,
  };
}

/** The add's outcome, kept as data so a caller can classify a refusal instead of throwing on it. */
export type FmaAddOutcome =
  | { ok: true; titleId: number; ms: number }
  | { ok: false; status: number; message: string; ms: number };

/**
 * Adds a Fleet-maintained app to a fleet and reports what happened rather than
 * asserting. Fleet downloads the installer inside this request (up to its
 * 15-minute installer timeout), checks it against the manifest's SHA-256 and
 * stores it, so the refusal text says which of those failed.
 */
export async function tryAddFmaToFleet(
  request: APIRequestContext,
  fleetId: number,
  slug: string,
  opts: { selfService?: boolean; timeout?: number } = {},
): Promise<FmaAddOutcome> {
  const fmaId = await findFmaIdBySlug(request, fleetId, slug);
  const started = Date.now();
  const res = await request.post(apiUrl('software/fleet_maintained_apps'), {
    headers: authHeaders(),
    data: { fleet_maintained_app_id: fmaId, fleet_id: fleetId, self_service: opts.selfService ?? false },
    timeout: opts.timeout ?? 300_000,
  });
  const ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  if (res.ok() && body.software_title_id) return { ok: true, titleId: body.software_title_id, ms };
  const message =
    (body.errors as Array<{ reason?: string }> | undefined)?.map((e) => e.reason).join('; ') ||
    body.message ||
    JSON.stringify(body);
  return { ok: false, status: res.status(), message, ms };
}

/** What Fleet stored for a Fleet-maintained title on one fleet — the catalog smoke's subject. */
export interface FleetMaintainedTitleMetadata {
  titleId: number;
  name: string;
  /** osquery source the title is matched on: `apps` (macOS) or `programs` (Windows). */
  source: string;
  bundleIdentifier: string | null;
  upgradeCode: string | null;
  package: {
    /** The installer's file name as Fleet stored it. */
    name: string;
    platform: string;
    version: string;
    hashSha256: string;
    url: string;
    installScript: string;
    uninstallScript: string;
    selfService: boolean;
    fleetMaintainedAppId: number | null;
  } | null;
}

export async function getFleetMaintainedTitleMetadata(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<FleetMaintainedTitleMetadata> {
  const res = await request.get(apiUrl(`software/titles/${titleId}`), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId) },
  });
  await expect(res, `Failed to fetch software title ${titleId}`).toBeOK();
  const t = (await res.json()).software_title;
  const pkg = t.software_package ?? t.packages?.[0] ?? null;
  return {
    titleId: t.id,
    name: t.name,
    source: t.source ?? '',
    bundleIdentifier: t.bundle_identifier ?? null,
    upgradeCode: t.upgrade_code ?? null,
    package: pkg && {
      name: pkg.name ?? '',
      platform: pkg.platform ?? '',
      version: pkg.version ?? '',
      hashSha256: pkg.hash_sha256 ?? '',
      url: pkg.url ?? '',
      installScript: pkg.install_script ?? '',
      uninstallScript: pkg.uninstall_script ?? '',
      selfService: !!pkg.self_service,
      fleetMaintainedAppId: pkg.fleet_maintained_app_id ?? null,
    },
  };
}
