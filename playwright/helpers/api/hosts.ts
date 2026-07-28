import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders, type HostRef } from './core';

/**
 * The `platform` query param returns a label group that can include hosts
 * outside the requested platform; this filters client-side by the host's
 * actual platform field.
 */
function matchesPlatform(
  hostPlatform: string,
  desired: 'darwin' | 'windows' | 'linux',
): boolean {
  if (desired === 'darwin') return hostPlatform === 'darwin';
  if (desired === 'windows') return hostPlatform === 'windows';
  const linuxPlatforms = [
    'linux', 'ubuntu', 'debian', 'rhel', 'centos', 'arch',
    'fedora', 'amzn', 'sles', 'gentoo', 'pop', 'manjaro',
  ];
  return linuxPlatforms.includes(hostPlatform);
}

/**
 * Display name of the first host on the instance (any platform, online or
 * not). Returns null if the instance has no hosts. Handy for seeding a
 * deterministic host into a manual-label / target picker.
 */
export async function firstHostDisplayName(
  request: APIRequestContext,
): Promise<string | null> {
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: { per_page: '1' },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body.hosts?.[0]?.display_name ?? null;
}

/** Find a host of a given platform that has vulnerable software. */
export async function findHostByPlatform(
  baseURL: string,
  token: string,
  platform: 'darwin' | 'windows' | 'linux',
): Promise<HostRef | null> {
  const res = await fetch(
    `${baseURL}${apiUrl('hosts')}?platform=${platform}&per_page=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const { hosts } = await res.json();
  if (!hosts?.length) return null;

  const filtered = hosts.filter((h: { platform: string }) =>
    matchesPlatform(h.platform, platform),
  );

  for (const host of filtered) {
    const swRes = await fetch(
      `${baseURL}${apiUrl(`hosts/${host.id}/software`)}?vulnerable=true&per_page=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!swRes.ok) continue;
    const swBody = await swRes.json();
    if (swBody.software?.length > 0 || swBody.count > 0) {
      return { id: host.id, displayName: host.display_name };
    }
  }
  return null;
}

/**
 * First host (by display name) that reports at least one software title —
 * gives host-software specs a deterministic host with inventory instead of a
 * fragile "first host" pick (which could be an Android/empty host). Scans up to
 * `maxScan` hosts. Returns null if none report software.
 */
export async function findHostWithSoftware(
  request: APIRequestContext,
  maxScan = 50,
): Promise<HostRef | null> {
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: { per_page: String(maxScan), order_key: 'display_name', order_direction: 'asc' },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const hosts = (body.hosts ?? []) as Array<{ id: number; display_name: string }>;

  for (const host of hosts) {
    const swRes = await request.get(apiUrl(`hosts/${host.id}/software`), {
      headers: authHeaders(),
      params: { per_page: '1' },
    });
    if (!swRes.ok()) continue;
    const swBody = await swRes.json();
    if ((swBody.software?.length ?? 0) > 0 || (swBody.count ?? 0) > 0) {
      return { id: host.id, displayName: host.display_name };
    }
  }
  return null;
}

/** An online host plus the vitals a host spec asserts against. */
export interface OnlineHostRef extends HostRef {
  /** Usernames from the host's "Local user accounts" card (empty if it reports none). */
  usernames: string[];
  /** fleetd/Orbit version, or null for a vanilla-osquery host. */
  orbitVersion: string | null;
  osqueryVersion: string | null;
}

/**
 * Which population of hosts to draw from. The QA instances carry both a handful
 * of **real** VMs and a large **simulated** (osquery-perf) load fleet, and they
 * suit opposite purposes:
 *
 *  - `'real'` — a genuine device. Runs real osquery, so it answers live queries
 *    with the query's actual results, reports real local users and agent
 *    versions, and supports MDM-gated features. Use for any spec asserting real
 *    device behaviour. There are only a couple per tier, so never destroy one.
 *  - `'simulated'` — the disposable load fleet. Plentiful and self-regenerating,
 *    but it ignores live-query SQL, returns no rows for a fraction of runs, and
 *    reports contradictory label membership. Use where the test needs *volume*
 *    (bulk select/transfer/delete) and the individual host is incidental.
 *
 * Implemented with Fleet's documented `mdm_enrollment_status` filter: the real
 * macOS/Windows VMs are MDM-enrolled and no simulation is.
 *
 * Caveat: the real **Linux** VMs are not MDM-enrolled, so they fall inside
 * `'simulated'`. Destructive specs must therefore target `darwin` or `windows`,
 * never `linux`, or they risk deleting a real VM.
 */
export type HostKind = 'real' | 'simulated';

/**
 * Extra guarantees a spec needs from its host. Simulated hosts report different
 * vitals from one another, so a spec asserting on one must resolve a host known
 * to report it rather than trusting an arbitrary pick. Real VMs satisfy both of
 * these already.
 */
export interface OnlineHostRequirements {
  /** Restrict to real devices or to the simulated load fleet. */
  kind?: HostKind;
  /**
   * Only match hosts reporting local user accounts. A host's users card stays
   * empty ("No users detected on this host") until its `users` detail query has
   * succeeded at least once, which is per-host luck on the sim fleet.
   */
  withUsers?: boolean;
  /**
   * Only match fleetd hosts (those reporting an Orbit version). The Agent
   * vitals tooltip listing osquery/Orbit versions only renders for these —
   * vanilla-osquery hosts show a bare osquery version with no tooltip
   * (`Vitals.tsx`, `isChromeOrVanillaOsqueryHost`).
   */
  withOrbit?: boolean;
}

/**
 * First online host (ordered by display name) of the given platform that meets
 * `requirements` — the resolver behind the `liveMacosHost` fixture and any spec
 * needing a host that actually answers live reports, refetches, and transfers.
 *
 * Fleet's `platform` param filters by *label group*, which can return hosts of
 * other platforms, so results are re-filtered on each host's own `platform`
 * field. Ordering by display name keeps the pick stable across calls in a run.
 * Fetching per-host vitals costs one extra request per candidate, so this only
 * walks candidates while a requirement is unmet.
 */
export async function findOnlineHost(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  requirements: OnlineHostRequirements = {},
  maxScan = 100,
): Promise<OnlineHostRef | null> {
  const candidates = (
    await listOnlineHosts(request, platform, maxScan, requirements.kind)
  ).filter((h) => matchesPlatform(h.platform, platform));

  for (const candidate of candidates) {
    const host = await getOnlineHostVitals(request, candidate);
    if (!host) continue;
    if (requirements.withUsers && host.usernames.length === 0) continue;
    if (requirements.withOrbit && !host.orbitVersion) continue;
    return host;
  }
  return null;
}

/**
 * Simulated hosts of a platform — the disposable pool for specs that mutate or
 * destroy hosts. Excludes every MDM-enrolled host so a real VM can never be
 * selected; pass `darwin` or `windows` (see {@link HostKind} on why `linux` is
 * unsafe here).
 *
 * Drawn from the **end** of the display-name ordering on purpose: the read-only
 * pickers other specs use (`findOnlineHost`, `findHostWithSoftware`) all take the
 * first hosts ascending, so mutating from the other end keeps a parallel worker
 * from having a host moved out from under it mid-assertion.
 *
 * `offset` claims a distinct slice of the pool. The suite runs fully parallel,
 * so two mutating specs on the same platform must not be handed the same hosts —
 * each picks a slice and the offsets are kept distinct across specs.
 */
export async function findSimulatedHostIds(
  request: APIRequestContext,
  platform: 'darwin' | 'windows',
  count: number,
  offset = 0,
): Promise<HostRef[]> {
  const hosts = await listOnlineHosts(
    request,
    platform,
    Math.max((count + offset) * 3, 50),
    'simulated',
    'desc',
  );
  return hosts
    .filter((h) => matchesPlatform(h.platform, platform))
    .slice(offset, offset + count)
    .map((h) => ({ id: h.id, displayName: h.display_name }));
}

/**
 * When Fleet last stored a full set of vitals for the host (`detail_updated_at`).
 * A refetch advances it, so a spec can prove the UI's "Last fetched less than a
 * minute ago" followed from its own refetch rather than from a background detail
 * cycle that happened to land first.
 */
export async function getHostDetailUpdatedAt(
  request: APIRequestContext,
  hostId: number,
): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  return (await res.json()).host?.detail_updated_at ?? '';
}

/**
 * Whether Fleet still knows about a host id. Deletion specs assert on the id
 * rather than the display name: the load fleet's agents re-enroll after a
 * delete, and a re-enrolled host reuses its name under a **new** id.
 */
export async function hostExists(
  request: APIRequestContext,
  hostId: number,
): Promise<boolean> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  return res.ok();
}

/**
 * The fleet a host currently belongs to, or null for Unassigned/"No team".
 * Transfer specs verify the move through this rather than re-reading the list,
 * which can serve a stale page from react-query's cache.
 */
export async function getHostFleetId(
  request: APIRequestContext,
  hostId: number,
): Promise<number | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  return (await res.json()).host?.team_id ?? null;
}

/** Vitals for a single host, shaped for assertions (null when unreadable). */
async function getOnlineHostVitals(
  request: APIRequestContext,
  candidate: OnlineHost,
): Promise<OnlineHostRef | null> {
  const res = await request.get(apiUrl(`hosts/${candidate.id}`), { headers: authHeaders() });
  if (!res.ok()) return null;
  const { host } = await res.json();
  return {
    id: candidate.id,
    displayName: candidate.display_name,
    usernames: ((host?.users ?? []) as Array<{ username: string }>).map((u) => u.username),
    orbitVersion: host?.orbit_version ?? null,
    osqueryVersion: host?.osquery_version ?? null,
  };
}

interface OnlineHost {
  id: number;
  display_name: string;
  platform: string;
}

async function listOnlineHosts(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  perPage: number,
  kind?: HostKind,
  direction: 'asc' | 'desc' = 'asc',
): Promise<OnlineHost[]> {
  // Fleet's `platform` param matches *label groups*, and there is no "linux"
  // group — passing it returns zero hosts even when Linux hosts exist. For linux
  // the param is omitted and the client-side `matchesPlatform` filter (which
  // callers already apply) does the work.
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: {
      status: 'online',
      ...(platform === 'linux' ? {} : { platform }),
      per_page: String(perPage),
      order_key: 'display_name',
      order_direction: direction,
      ...(kind === 'real' ? { mdm_enrollment_status: 'enrolled' } : {}),
      ...(kind === 'simulated' ? { mdm_enrollment_status: 'unenrolled' } : {}),
    },
  });
  if (!res.ok()) return [];
  return ((await res.json()).hosts ?? []) as OnlineHost[];
}

// ── Host transfer ────────────────────────────────────────────────────────────

/**
 * Transfer specific hosts to a fleet. Pass `null` (or `0`) to send hosts
 * to "No team" — the server expects `team_id: null` for unassigned, since
 * `team_id: 0` references a non-existent row and trips the FK constraint.
 *
 * The server rejects payloads that include both `team_id` and `fleet_id`
 * during the rename transition; we send `team_id` (the legacy field name)
 * since the server still accepts it on every supported version.
 */
export async function transferHosts(
  request: APIRequestContext,
  fleetId: number | null,
  hostIds: number[],
): Promise<void> {
  if (!hostIds.length) return;
  const teamId = fleetId === 0 ? null : fleetId;
  const res = await request.post(apiUrl('hosts/transfer'), {
    headers: authHeaders(),
    data: { team_id: teamId, hosts: hostIds },
  });
  await expect(res, `Failed to transfer hosts to fleet ${fleetId}`).toBeOK();
}

/**
 * Transfer hosts to a fleet by filter (e.g. all online, or all on a given
 * source fleet). Returns silently when no hosts match. Pass `null` (or `0`)
 * for the destination to mean "No team". Filter keys must also use only
 * one of `team_id` / `fleet_id`.
 */
export async function transferHostsByFilter(
  request: APIRequestContext,
  fleetId: number | null,
  filters: Record<string, string | number>,
): Promise<void> {
  const teamId = fleetId === 0 ? null : fleetId;
  const res = await request.post(apiUrl('hosts/transfer/filter'), {
    headers: authHeaders(),
    data: { team_id: teamId, filters },
  });
  await expect(res, `Failed to transfer hosts to fleet ${fleetId}`).toBeOK();
}
