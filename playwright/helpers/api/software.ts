import { APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { apiUrl, authHeaders } from './core';
import { getHostCollectedAt, waitForHostRefetch, waitForNoPendingRefetch } from './hosts';

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
  version: string;
  /** SHA-256 Fleet recorded at upload; what a download should hash to. */
  hashSha256: string;
  /** Scripts Fleet generated (or the user edited) — what Advanced options renders. */
  preInstallQuery: string;
  installScript: string;
  postInstallScript: string;
  uninstallScript: string;
  /**
   * The title's version pin: `''` tracks latest, `'1.2.3'` pins that exact
   * version, `'^1'` pins the 1.x major. Fleet-maintained apps only.
   */
  pinnedVersion: string;
  /** Cached Fleet-maintained versions, newest first as the Versions modal lists them. */
  fleetMaintainedVersions: string[];
  /** The package's label scope, by label name — at most one of these is non-empty. */
  labelsIncludeAny: string[];
  labelsIncludeAll: string[];
  labelsExcludeAny: string[];
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
  return {
    name: pkg.name,
    selfService: !!pkg.self_service,
    version: pkg.version ?? '',
    hashSha256: pkg.hash_sha256 ?? '',
    preInstallQuery: pkg.pre_install_query ?? '',
    installScript: pkg.install_script ?? '',
    postInstallScript: pkg.post_install_script ?? '',
    uninstallScript: pkg.uninstall_script ?? '',
    pinnedVersion: pkg.pinned_version ?? '',
    fleetMaintainedVersions: ((pkg.fleet_maintained_versions ?? []) as { version: string }[]).map(
      (v) => v.version,
    ),
    labelsIncludeAny: ((pkg.labels_include_any ?? []) as { name: string }[]).map((l) => l.name),
    labelsIncludeAll: ((pkg.labels_include_all ?? []) as { name: string }[]).map((l) => l.name),
    labelsExcludeAny: ((pkg.labels_exclude_any ?? []) as { name: string }[]).map((l) => l.name),
  };
}

/**
 * Which of `hostIds` Fleet offers a title to — lists in the host's Library as
 * available to install — sorted. A label scope on the package decides it
 * server-side, so a simulation answers as well as a VM.
 */
export async function hostsOfferedTitle(
  request: APIRequestContext,
  hostIds: number[],
  titleId: number,
): Promise<number[]> {
  const offered: number[] = [];
  for (const hostId of hostIds) {
    if (await getHostSoftwareState(request, hostId, titleId)) offered.push(hostId);
  }
  return offered.sort((a, b) => a - b);
}

/**
 * First CVE in `cves` that Fleet's CVE detail endpoint can actually render, or
 * null when none of them can.
 *
 * `GET /vulnerabilities/:cve` 404s ("This is not a known CVE") for a CVE that
 * Fleet's software matcher has attached to a version but that no vulnerability
 * source carries metadata for yet — the detail handler inner-joins `cve_meta`
 * while the rest of the product treats that table as optional
 * ([fleetdm/fleet#49913](https://github.com/fleetdm/fleet/issues/49913)). The
 * software-version page links such a CVE regardless, so a flow that clicks the
 * top row lands on Fleet's "Vulnerability not detected" empty state.
 *
 * The condition is a race with NVD enrichment rather than a property of any
 * platform: a CVE matched in the last few hours 404s and the same CVE resolves
 * a day later. Whichever row happens to sort first is therefore the *most*
 * likely to be unrenderable, which is why callers pass the CVEs in the order
 * the page renders them and click the one this returns instead of the first.
 *
 * Probes sequentially and stops at the first hit — the renderable CVE is
 * usually the first or second row, and these run against a shared QA instance.
 *
 * TODO(fleetdm/fleet#49913): drop this probe and click the first row again once
 * the detail endpoint renders matched-but-unenriched CVEs. Tracked in
 * docs/blocked-by-product-bugs.md.
 */
export async function findRenderableCve(
  request: APIRequestContext,
  cves: string[],
): Promise<string | null> {
  for (const cve of cves) {
    const res = await request.get(apiUrl(`vulnerabilities/${cve}`), {
      headers: authHeaders(),
    });
    if (res.ok()) return cve;
  }
  return null;
}

/** Scripts an upload can carry. `.exe` and `.tar.gz` require both install and uninstall. */
export interface PackageScripts {
  installScript?: string;
  uninstallScript?: string;
}

/**
 * Uploads a package built in memory (a generated `.deb`, say) and returns the
 * title it created. The API twin of {@link uploadSoftwarePackage}, for specs
 * whose package is decided at run time. Unlike that helper a 409 is an error:
 * a run-time package is named to be new, so a clash means a leftover the caller
 * should hear about.
 */
export async function uploadSoftwarePackageBuffer(
  request: APIRequestContext,
  fleetId: number,
  fileName: string,
  buffer: Buffer,
  scripts: PackageScripts = {},
): Promise<SoftwarePackageRef> {
  const res = await request.post(apiUrl('software/package'), {
    headers: authHeaders(),
    multipart: {
      software: { name: fileName, mimeType: 'application/octet-stream', buffer },
      ...(fleetId ? { fleet_id: String(fleetId) } : {}),
      ...(scripts.installScript ? { install_script: scripts.installScript } : {}),
      ...(scripts.uninstallScript ? { uninstall_script: scripts.uninstallScript } : {}),
    },
    timeout: 120_000,
  });
  await expect(res, `Upload failed for ${fileName} on fleet ${fleetId}`).toBeOK();
  const ref = await findSoftwareTitleByPackageName(request, fleetId, fileName);
  if (!ref) throw new Error(`Uploaded ${fileName} but couldn't find it in software titles`);
  return ref;
}

/**
 * Replaces a title's package with a new file — what Edit software → choosing
 * a new file does. The title keeps its id, so a host that installed the old
 * version now sees the new one as the library version.
 */
export async function replaceSoftwarePackage(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
  fileName: string,
  buffer: Buffer,
): Promise<void> {
  const res = await request.patch(apiUrl(`software/titles/${titleId}/package`), {
    headers: authHeaders(),
    multipart: {
      software: { name: fileName, mimeType: 'application/octet-stream', buffer },
      fleet_id: String(fleetId),
    },
    timeout: 120_000,
  });
  await expect(res, `Failed to replace the package on title ${titleId}`).toBeOK();
}

/** Queues an install of a title's current package on one host. */
export async function installSoftwareOnHost(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
): Promise<void> {
  const res = await request.post(apiUrl(`hosts/${hostId}/software/${titleId}/install`), {
    headers: authHeaders(),
  });
  await expect(res, `Failed to queue install of title ${titleId} on host ${hostId}`).toBeOK();
}

/** Queues an uninstall of a title on one host. */
export async function uninstallSoftwareOnHost(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
): Promise<void> {
  const res = await request.post(apiUrl(`hosts/${hostId}/software/${titleId}/uninstall`), {
    headers: authHeaders(),
  });
  await expect(res, `Failed to queue uninstall of title ${titleId} on host ${hostId}`).toBeOK();
}

/**
 * Fleet's per-host install state for a title, as its Library row is built:
 * `pending_install`, `installed`, `failed_install`, `pending_uninstall`,
 * `failed_uninstall`, or null when nothing has been attempted (or the last
 * uninstall succeeded).
 */
export type HostSoftwareStatus =
  | 'pending_install'
  | 'installed'
  | 'failed_install'
  | 'pending_uninstall'
  | 'failed_uninstall'
  | null;

export interface HostSoftwareState {
  status: HostSoftwareStatus;
  /** Versions the host's inventory reports — empty until an inventory refetch sees it. */
  installedVersions: string[];
  /** The version of the installer the Library offers. */
  libraryVersion: string | null;
}

/** One title's install state on a host, or null if the title isn't offered to it. */
export async function getHostSoftwareState(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
): Promise<HostSoftwareState | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}/software`), {
    headers: authHeaders(),
    params: { available_for_install: 'true', per_page: '100' },
  });
  await expect(res, `Failed to list installable software on host ${hostId}`).toBeOK();
  const row = ((await res.json()).software ?? []).find((s: { id: number }) => s.id === titleId) as
    | {
        status: HostSoftwareStatus;
        installed_versions: Array<{ version: string }> | null;
        software_package: { version: string } | null;
        app_store_app: { version: string } | null;
      }
    | undefined;
  if (!row) return null;
  return {
    status: row.status ?? null,
    installedVersions: (row.installed_versions ?? []).map((v) => v.version),
    libraryVersion: row.software_package?.version ?? row.app_store_app?.version ?? null,
  };
}

/**
 * Waits for a host's install or uninstall of a title to reach `status`. A shared
 * VM works through one queue — scripts, installs, uninstalls — so the budget
 * covers another spec's work landing first.
 */
export async function waitForHostSoftwareStatus(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
  status: HostSoftwareStatus,
  timeout = 300_000,
): Promise<HostSoftwareState> {
  let state: HostSoftwareState | null = null;
  await expect
    .poll(
      async () => {
        state = await getHostSoftwareState(request, hostId, titleId);
        return state?.status;
      },
      { message: `title ${titleId} never reached ${status} on host ${hostId}`, timeout, intervals: [5_000] },
    )
    .toBe(status);
  return state!;
}

/**
 * Takes a title off a host and out of the fleet's library — the cleanup every
 * install spec ends with, and the pre-clean for a fixed-name fixture a dead run
 * may have left installed. Uninstalls first when the host still has it, since
 * deleting a title from the library leaves whatever it installed on the host.
 *
 * As cleanup it waits for the uninstall only, not for the host to re-report:
 * the refetch is hygiene for the *next* run, whose own pre-clean
 * ({@link ensureNotInstalled}) already handles a stale inventory, and on a VM
 * other specs are queueing work on it can cost minutes a `finally` doesn't have.
 */
export async function removeTitleFromHost(
  request: APIRequestContext,
  fleetId: number,
  hostId: number,
  titleId: number,
  opts: { settleInventory?: boolean } = {},
): Promise<void> {
  await ensureNotInstalled(request, hostId, titleId, { settleInventory: opts.settleInventory ?? false });
  await deleteSoftwareTitle(request, fleetId, titleId);
}

/**
 * Uninstalls a title from a host if the host has it, and waits until the host's
 * inventory agrees it's gone.
 *
 * Waiting on the inventory, not just the uninstall's status, is what lets the
 * next run start clean: until the host re-reports, its Library row keeps showing
 * the old installed version, and a spec that then expects "Install" finds
 * "Reinstall". Also the pre-clean for software a dead run left on a host after
 * its title was deleted — adding the title back is what makes the install
 * visible again.
 */
export async function ensureNotInstalled(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
  opts: { settleInventory?: boolean } = {},
): Promise<void> {
  const state = await getHostSoftwareState(request, hostId, titleId);
  if (!state || (state.status !== 'installed' && state.installedVersions.length === 0)) return;
  await uninstallSoftwareOnHost(request, hostId, titleId);
  if (opts.settleInventory === false) {
    await waitForHostSoftwareStatus(request, hostId, titleId, null);
  } else {
    await waitForSoftwareSettled(request, hostId, titleId, null);
  }
}

/**
 * Fleet's version order (`compareVersions` in the frontend, which picks the
 * Library's Update vs Reinstall): segment by segment, a missing segment reads as
 * 0 — so Windows' `2.7032.0.0` is `2.7032.0`. Negative, zero or positive.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

const sameVersion = (a: string, b: string): boolean => compareVersions(a, b) === 0;

/**
 * Waits for an install or uninstall to finish *and* for the host's software
 * inventory to reflect it — the state the Library's Installed version and the
 * Inventory tab are built from.
 *
 * Three steps, in this order:
 *
 *  1. The status settles.
 *  2. A collection runs after that: wait out any refetch already outstanding,
 *     then baseline `detail_updated_at`, ask for a refetch, wait for it to move.
 *     Fleet queues a refetch after every install and uninstall, and one queued
 *     by the previous action on this host can still be running on data from
 *     before this one — a refetch asked for meanwhile merges into it, and its
 *     landing would pass for this one's. A baseline taken before the action could be
 *     overtaken by a routine collection landing mid-install; and it's
 *     `detail_updated_at`, not `software_updated_at`, because the latter only
 *     moves when the inventory changes — never after a failed uninstall, say
 *     (see `HostCollectedAtField` in hosts.ts). A refetch is asked for rather than
 *     waited out, since the next unprompted collection can be an hour away.
 *  3. The inventory shows what the status implies: present after `installed`
 *     or `failed_uninstall`, absent after a clean uninstall or `failed_install`.
 *     The detail results of a refetch can be stored seconds before its software
 *     results, so step 2 alone can return a beat early. If the inventory still
 *     disagrees a minute after the collection, steps 2–3 run once more.
 *
 * Pass `version` when the host already had the title — an update — so the
 * wait is for that version, not for any. Pass `inventoryName` for a title Fleet
 * may not have tied to what the host reports (see {@link getHostInventoryVersions}):
 * an unlinked title's installed versions stay empty, so step 3 also reads the
 * host's inventory by the name the host uses, and counts the software as listed
 * if either reading shows it.
 */
export async function waitForSoftwareSettled(
  request: APIRequestContext,
  hostId: number,
  titleId: number,
  status: HostSoftwareStatus,
  opts: { timeout?: number; inventory?: 'present' | 'absent'; version?: string; inventoryName?: string } = {},
): Promise<HostSoftwareState> {
  await waitForHostSoftwareStatus(request, hostId, titleId, status, opts.timeout);

  const inventory =
    opts.inventory ?? (status === 'installed' || status === 'failed_uninstall' ? 'present' : 'absent');
  let state: HostSoftwareState | null = null;
  const agrees = async (): Promise<boolean> => {
    state = await getHostSoftwareState(request, hostId, titleId);
    if (opts.version) return state?.installedVersions.some((v) => sameVersion(v, opts.version!)) ?? false;
    const listed =
      (state?.installedVersions.length ?? 0) > 0 ||
      (!!opts.inventoryName && (await getHostInventoryVersions(request, hostId, opts.inventoryName)).length > 0);
    return listed === (inventory === 'present');
  };

  // The refetch Fleet queued after the previous install or uninstall on this
  // host may still be running on data from before this one, so it lands first.
  // A second round covers a routine collection that was already in flight.
  await waitForNoPendingRefetch(request, hostId);
  for (let round = 1; round <= 2; round++) {
    const since = await getHostCollectedAt(request, hostId, 'detail_updated_at');
    await waitForHostRefetch(request, hostId, { since, refetch: true });
    const settled = await expect
      .poll(agrees, { timeout: 60_000, intervals: [5_000] })
      .toBe(true)
      .then(() => true)
      .catch(() => false);
    if (settled) return state!;
  }
  throw new Error(
    `host ${hostId}'s inventory never showed ${opts.inventoryName ?? `title ${titleId}`} ` +
      `${opts.version ?? inventory} after ${status}, over two collections`,
  );
}

/**
 * Versions of `name` in the host's own software inventory, by the name the host
 * reports — independent of any library title. Needed where Fleet hasn't tied a
 * title to what the host reports: a new `.exe` title is named from the
 * installer's ProductName ("7-Zip") while Windows lists the program by its
 * DisplayName ("7-Zip 26.01 (arm64)"), so the title shows no installed version
 * until something links them.
 */
export async function getHostInventoryVersions(
  request: APIRequestContext,
  hostId: number,
  name: string,
): Promise<string[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}/software`), {
    headers: authHeaders(),
    params: { query: name, per_page: '50' },
  });
  await expect(res, `Failed to read the software inventory of host ${hostId}`).toBeOK();
  const rows = ((await res.json()).software ?? []) as Array<{
    name: string;
    installed_versions: Array<{ version: string }> | null;
  }>;
  return rows.filter((r) => r.name === name).flatMap((r) => (r.installed_versions ?? []).map((v) => v.version));
}

/** An installer in a fleet's library, as a cleanup sweep needs to recognise it. */
export interface InstallableTitle {
  titleId: number;
  name: string;
  /** The installer's file name — for a Fleet-maintained app, the one Fleet fetched. */
  packageName: string;
  fleetMaintained: boolean;
}

/** Every installer in a fleet's library (packages and Fleet-maintained apps). */
export async function listInstallableTitles(
  request: APIRequestContext,
  fleetId: number,
): Promise<InstallableTitle[]> {
  const res = await request.get(apiUrl('software/titles'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), available_for_install: 'true', per_page: '200' },
  });
  await expect(res, `Failed to list installable titles on fleet ${fleetId}`).toBeOK();
  return ((await res.json()).software_titles ?? [])
    .filter((t: { software_package?: unknown }) => t.software_package)
    .map(
      (t: {
        id: number;
        name: string;
        software_package: { name: string; fleet_maintained_app_id?: number | null };
      }) => ({
        titleId: t.id,
        name: t.name,
        packageName: t.software_package.name,
        fleetMaintained: !!t.software_package.fleet_maintained_app_id,
      }),
    );
}

/** Names in a host's software inventory that contain `query` (Fleet's own search). */
export async function listHostSoftwareNames(
  request: APIRequestContext,
  hostId: number,
  query: string,
): Promise<string[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}/software`), {
    headers: authHeaders(),
    params: { query, per_page: '100' },
  });
  await expect(res, `Failed to read the software inventory of host ${hostId}`).toBeOK();
  return (((await res.json()).software ?? []) as Array<{ name: string }>).map((r) => r.name);
}
