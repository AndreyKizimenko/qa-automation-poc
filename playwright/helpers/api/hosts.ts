import { APIRequestContext, expect } from '@playwright/test';
import { apiLatestUrl, apiUrl, authHeaders, type HostRef } from './core';

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
 * Told apart by **hardware model**: the QA VMs run on virtualized hardware and
 * report `VirtualMac2,1` or `QEMU Virtual Machine`, while osquery-perf reports
 * fixed consumer models (`MacBookPro11,4`, `Surface Laptop 2`). The model is a
 * property of the machine, so it holds on both tiers and across re-enrollment.
 *
 * MDM enrollment is deliberately *not* the discriminator. It used to be, on the
 * premise that only real VMs were enrolled — which stopped being true once the
 * `perf-hosts` tooling began enrolling a share of the simulations, at which
 * point `'real'` started returning simulations and `'simulated'` could return a
 * VM. A host's enrollment also flaps independently of what kind of host it is.
 *
 * Because the model covers Linux too, `'simulated'` now excludes the real Linux
 * VMs as well, so a destructive spec targeting `linux` can no longer draw one.
 */
export type HostKind = 'real' | 'simulated';

/**
 * The QA VMs are the only hosts on virtualized hardware. Matched
 * case-insensitively against the reported hardware model, which covers
 * `VirtualMac2,1` (macOS) and `QEMU Virtual Machine` (Windows and Linux).
 */
const REAL_DEVICE_MODEL = /virtual|qemu/i;

function matchesKind(host: OnlineHost, kind?: HostKind): boolean {
  if (!kind) return true;
  const isReal = REAL_DEVICE_MODEL.test(host.hardware_model ?? '');
  return kind === 'real' ? isReal : !isReal;
}

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
 *
 * The pool is **paged** rather than read off one window. `kind` is decided from
 * the hardware model, which Fleet has no query param for, so it can only be
 * applied client-side — and a handful of real VMs among hundreds of simulations
 * will not reliably land in the first page.
 *
 * Each page's candidates are tried before the next page is fetched, so the walk
 * stops on the page holding the first host that satisfies `requirements`. That
 * matters for `kind: 'real'`: only a few hosts on the instance can ever match,
 * so collecting candidates up-front would read every page on every call and put
 * a needless multiple of that load on a shared QA instance.
 *
 * `maxScan` bounds how many candidates have their vitals fetched, which is the
 * expensive part — one extra request each.
 */
export async function findOnlineHost(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  requirements: OnlineHostRequirements = {},
  maxScan = 100,
): Promise<OnlineHostRef | null> {
  const perPage = 100;
  // Bounds the walk at 1000 online hosts so an instance with no matching host
  // returns null instead of paging indefinitely.
  const maxPages = 10;
  let scanned = 0;

  for (let page = 0; scanned < maxScan && page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'asc', page);

    for (const candidate of batch) {
      if (scanned >= maxScan) break;
      if (!matchesPlatform(candidate.platform, platform)) continue;
      if (!matchesKind(candidate, requirements.kind)) continue;

      scanned += 1;
      const host = await getOnlineHostVitals(request, candidate);
      if (!host) continue;
      if (requirements.withUsers && host.usernames.length === 0) continue;
      if (requirements.withOrbit && !host.orbitVersion) continue;
      return host;
    }

    if (batch.length < perPage) break;
  }
  return null;
}

/**
 * Simulated hosts of a platform — the disposable pool for specs that mutate or
 * destroy hosts. Excludes every host on virtualized hardware so a real VM can
 * never be selected (see {@link HostKind}).
 *
 * Drawn from the **end** of the display-name ordering on purpose: the read-only
 * pickers other specs use (`findOnlineHost`, `findHostWithSoftware`) all take the
 * first hosts ascending, so mutating from the other end keeps a parallel worker
 * from having a host moved out from under it mid-assertion.
 *
 * `offset` claims a distinct slice of the pool. The suite runs fully parallel,
 * so two mutating specs on the same platform must not be handed the same hosts —
 * each picks a slice and the offsets are kept distinct across specs.
 *
 * Pages the pool until `offset + count` hosts of the requested platform have
 * been collected, rather than reading the slice off one fixed-size page: the
 * `platform` param matches a *label group* that also returns other platforms,
 * so the share of any one page that survives `matchesPlatform` is a property of
 * the live pool mix, not something the caller can size for. Stops early once a
 * short page proves the pool is exhausted, and returns fewer hosts than asked
 * for when the pool genuinely cannot cover the slice — callers assert on the
 * length they need.
 */
export async function findSimulatedHostIds(
  request: APIRequestContext,
  platform: 'darwin' | 'windows',
  count: number,
  offset = 0,
): Promise<HostRef[]> {
  const needed = offset + count;
  const perPage = 100;
  // Bounds the walk at 1000 online hosts so a pool that can never satisfy the
  // slice fails the caller's assertion instead of paging indefinitely.
  const maxPages = 10;
  const matches: OnlineHost[] = [];

  for (let page = 0; matches.length < needed && page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'desc', page);
    matches.push(
      ...batch.filter(
        (h) => matchesPlatform(h.platform, platform) && matchesKind(h, 'simulated'),
      ),
    );
    if (batch.length < perPage) break;
  }

  return matches
    .slice(offset, offset + count)
    .map((h) => ({ id: h.id, displayName: h.display_name }));
}

/**
 * How far into the end of the display-name ordering the borrowing specs start.
 * {@link findSimulatedHostIds} hands the transfer and delete specs slices at
 * offsets 0–25 of that same ordering, so starting past 40 keeps a borrowed
 * simulation from being moved or deleted by one of them mid-test.
 */
const BORROW_SKIP = 40;

/**
 * Online, MDM-enrolled simulations on Unassigned — hosts a label-targeting spec
 * can move onto the VMs fleet as the "same platform, outside the label" host
 * beside the real VM. Only an MDM-enrolled host is one Fleet decides profile
 * targeting for, which is what makes it outside the label rather than merely
 * outside MDM; a simulation answers that server-side decision as well as a VM
 * does (it lists every profile that targets it, and none that doesn't).
 *
 * `offset` claims a distinct slice of those hosts, as with
 * {@link findSimulatedHostIds}; specs that borrow at the same time keep theirs
 * apart. Returns fewer than `count` when the pool can't cover it — callers
 * assert on the length they need.
 *
 * Slices claimed, per platform: 0–1 `profile-label-targets.spec.ts` (moved onto
 * the VMs fleet); 2–3 `profile-broken-labels.spec.ts` (label members only, never moved).
 */
export async function findMdmSimulations(
  request: APIRequestContext,
  platform: 'darwin' | 'windows',
  count: number,
  offset = 0,
): Promise<number[]> {
  const perPage = 100;
  const maxPages = 10;
  const simulated: OnlineHost[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'desc', page);
    simulated.push(...batch.filter((h) => matchesPlatform(h.platform, platform) && matchesKind(h, 'simulated')));
    const enrolled = simulated
      .slice(BORROW_SKIP)
      .filter((h) => h.mdm?.connected_to_fleet && h.team_id == null);
    if (enrolled.length >= offset + count || batch.length < perPage) {
      return enrolled.slice(offset, offset + count).map((h) => h.id);
    }
  }
  return [];
}

/** Lock/wipe state as Fleet reports it on the host detail endpoint. */
export interface HostDeviceState {
  /** 'unlocked' | 'locked' | 'wiped' — absent until the host has an action. */
  deviceStatus: string | null;
  /** 'lock' | 'unlock' | 'wipe' while one is in flight, '' when settled. */
  pendingAction: string | null;
}

/**
 * The host's lock/wipe state. Only the **detail** endpoint carries these; the
 * list endpoint omits `device_status` unless explicitly asked for it.
 */
export async function getHostDeviceState(
  request: APIRequestContext,
  hostId: number,
): Promise<HostDeviceState> {
  const res = await request.get(apiLatestUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  const mdm = (await res.json()).host?.mdm ?? {};
  return { deviceStatus: mdm.device_status ?? null, pendingAction: mdm.pending_action ?? null };
}

/**
 * Deletes a host. Used as the last-resort cleanup for lock/wipe specs: a
 * simulation left locked would otherwise sit in the pool misreporting its state
 * to every later spec.
 *
 * A deleted simulation does **not** re-enrol on its own — osquery-perf enrols
 * once at startup — so the pool is only replenished by the daily refresh in
 * `tools/perf-hosts/`. Callers must therefore delete a small, fixed number of
 * hosts, never a number that scales with anything.
 */
export async function deleteHost(request: APIRequestContext, hostId: number): Promise<void> {
  await request.delete(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
}

/** A simulated host resolved for a `fleetctl mdm` command. */
export interface MdmTargetHost extends HostRef {
  /** What `fleetctl mdm <cmd> --host` must be given. */
  hostname: string;
  platform: string;
  mdmConnected: boolean;
}

export interface MdmHostRequirements {
  /**
   * Whether the host must be connected to Fleet MDM.
   *
   * **This must be chosen, not left to chance.** `fleetctl mdm` refuses a host
   * that isn't MDM-connected *client-side* (`hostMdmActionSetup` in
   * `cmd/fleetctl/fleetctl/mdm.go`), before it ever calls the server — but only
   * for platforms where `MDMTurnedOnSupported` is true (darwin, ios, ipados,
   * windows, android; **not** Linux). That refusal is what makes the error-path
   * specs safe: a *connected* macOS or Windows simulation would sail through and
   * enqueue a real lock or wipe. About a third of the pool is enrolled, so
   * picking blind is a coin flip.
   *
   * `false` for premium error-path specs. `true` is only safe on **free**, where
   * the licence check short-circuits before anything is enqueued.
   */
  mdmConnected: boolean;
  /**
   * Require a host that runs orbit.
   *
   * Only ~40% of the pool does (`osquery-perf --orbit_prob` defaults to 0.5), and
   * **only those can ever complete a lock or unlock**: on Windows and Linux both
   * run as scripts, which orbit is what polls for. Lock a simulation without
   * orbit and it sits at `pending_action: 'lock'` forever — after which Fleet
   * refuses every further lock *and* unlock, so the host can only be deleted.
   *
   * Required for any spec that performs a real lock. Leave unset for error-path
   * specs, which never reach the server and would only shrink their pool.
   */
  withOrbit?: boolean;
  /** Claims a distinct slice so parallel specs don't collide. */
  offset?: number;
}

/**
 * A simulated host suitable for a `fleetctl mdm` command.
 *
 * Reads the list endpoint alone — it carries `hostname`, `mdm.connected_to_fleet`
 * and `orbit_version`, so no per-host detail fetch is needed. Draws from the
 * **end** of the display-name ordering, like {@link findSimulatedHostIds}, to stay
 * clear of the read-only pickers.
 */
export async function findSimulatedHostForMdm(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  requirements: MdmHostRequirements,
): Promise<MdmTargetHost | null> {
  const { mdmConnected, withOrbit = false, offset = 0 } = requirements;
  const perPage = 100;
  const maxPages = 10;
  const matches: OnlineHost[] = [];

  for (let page = 0; matches.length <= offset && page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'desc', page);
    matches.push(
      ...batch.filter(
        (h) =>
          matchesPlatform(h.platform, platform) &&
          matchesKind(h, 'simulated') &&
          Boolean(h.mdm?.connected_to_fleet) === mdmConnected &&
          (!withOrbit || Boolean(h.orbit_version)) &&
          Boolean(h.hostname),
      ),
    );
    if (batch.length < perPage) break;
  }

  const host = matches[offset];
  if (!host) return null;
  return {
    id: host.id,
    displayName: host.display_name,
    hostname: host.hostname!,
    platform: host.platform,
    mdmConnected,
  };
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
  return getHostCollectedAt(request, hostId, 'detail_updated_at');
}

/**
 * Two timestamps Fleet keeps per host, which mean different things:
 *
 *  - `detail_updated_at` — when the host last reported a full collection. Every
 *    refetch advances it, so it's the proof that a collection ran after a point
 *    in time.
 *  - `software_updated_at` — when the host's software inventory last *changed*.
 *    Fleet skips the write when an ingest finds nothing new (`nothingChanged` in
 *    `server/datastore/mysql/software.go`), so it only advances if the software
 *    list differs. Wait on it only for "until the inventory changes", and only
 *    with a baseline taken before the change could have been ingested; to know
 *    the inventory is current, wait on `detail_updated_at` instead.
 */
export type HostCollectedAtField = 'detail_updated_at' | 'software_updated_at';

/** When Fleet last stored `field` for the host (empty string if never). */
export async function getHostCollectedAt(
  request: APIRequestContext,
  hostId: number,
  field: HostCollectedAtField,
): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  return (await res.json()).host?.[field] ?? '';
}

/** Asks Fleet to re-collect a host's vitals and software on its next check-in. */
export async function requestHostRefetch(request: APIRequestContext, hostId: number): Promise<void> {
  const res = await request.post(apiUrl(`hosts/${hostId}/refetch`), { headers: authHeaders() });
  await expect(res, `Failed to request a refetch of host ${hostId}`).toBeOK();
}

/** One queued item on a host — an install, uninstall, script run or MDM command. */
export interface UpcomingActivity {
  /** What {@link cancelUpcomingActivity} takes. */
  uuid: string;
  type: string;
  softwareTitle: string | null;
  /** The installer's file name, for software. */
  softwarePackage: string | null;
  scriptName: string | null;
}

/** What's queued on a host, oldest first — what it works through, one at a time. */
export async function listUpcomingActivities(
  request: APIRequestContext,
  hostId: number,
): Promise<UpcomingActivity[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}/activities/upcoming`), {
    headers: authHeaders(),
    params: { per_page: '100' },
  });
  await expect(res, `Failed to list host ${hostId}'s upcoming activities`).toBeOK();
  const activities = ((await res.json()).activities ?? []) as Array<{
    uuid: string;
    type: string;
    details?: { software_title?: string; software_package?: string; script_name?: string } | null;
  }>;
  return activities.map((a) => ({
    uuid: a.uuid,
    type: a.type,
    softwareTitle: a.details?.software_title ?? null,
    softwarePackage: a.details?.software_package ?? null,
    scriptName: a.details?.script_name ?? null,
  }));
}

/** Removes a queued item before the host picks it up. Already-started or gone is fine. */
export async function cancelUpcomingActivity(
  request: APIRequestContext,
  hostId: number,
  uuid: string,
): Promise<void> {
  const res = await request.delete(apiUrl(`hosts/${hostId}/activities/upcoming/${uuid}`), {
    headers: authHeaders(),
  });
  if (!res.ok() && res.status() !== 404) {
    console.warn(`[cancelUpcomingActivity] host ${hostId} ${uuid}: HTTP ${res.status()} — ${await res.text()}`);
  }
}

/**
 * Waits until the host has no refetch outstanding (`refetch_requested` false).
 * Fleet clears the flag when the collection's results land, not when the host
 * picks the queries up — so while it's set, a collection may already be running
 * on data from before now, and a refetch asked for meanwhile merges into it
 * instead of starting a new one. Fleet sets it after every software install and
 * uninstall.
 */
export async function waitForNoPendingRefetch(
  request: APIRequestContext,
  hostId: number,
  timeout = 240_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
        await expect(res, `Failed to read host ${hostId}`).toBeOK();
        return (await res.json()).host?.refetch_requested ?? false;
      },
      { message: `host ${hostId} kept a refetch outstanding`, timeout, intervals: [5_000] },
    )
    .toBe(false);
}

/**
 * Waits until the host has re-reported since `since` — the one wait every
 * host-execution spec needs, because what they assert (an installed version, a
 * cleared status) only reaches Fleet on the host's next collection.
 *
 * Take `since` from {@link getHostCollectedAt} *before* the action under test.
 * Comparing against a baseline, rather than polling UI copy like "Last fetched
 * less than a minute ago", proves the collection happened after the action and
 * wasn't a background cycle that landed just before it.
 *
 * `refetch` also queues a refetch first. Leave it off where Fleet queues one
 * itself: a completed software install or uninstall already does, so asking again
 * only adds load on the shared instance.
 *
 * The default budget covers what the real VMs measure — a refetch lands in
 * 70–120s — plus a refetch another spec may already have in flight on the same
 * host. Returns the new timestamp so a caller can chain a second wait off it.
 */
export async function waitForHostRefetch(
  request: APIRequestContext,
  hostId: number,
  opts: {
    since: string;
    field?: HostCollectedAtField;
    refetch?: boolean;
    timeout?: number;
  },
): Promise<string> {
  const { since, field = 'detail_updated_at', refetch = false, timeout = 240_000 } = opts;
  if (refetch) await requestHostRefetch(request, hostId);

  const baseline = since ? Date.parse(since) : 0;
  let latest = since;
  await expect
    .poll(
      async () => {
        latest = await getHostCollectedAt(request, hostId, field);
        return latest ? Date.parse(latest) : 0;
      },
      {
        message: `host ${hostId} never re-reported ${field} after ${since || '(never)'}`,
        timeout,
        intervals: [5_000],
      },
    )
    .toBeGreaterThan(baseline);
  return latest;
}

/** What a `fleetctl mdm` command needs to address a host, and whether it can reach it. */
export interface HostMdmIdentity {
  /** The host's own hostname — what `fleetctl mdm … --hosts` resolves against. */
  hostname: string;
  /** Fleet's MDM enrollment status ("On (manual)", "On (automatic)", "Off", …). */
  enrollmentStatus: string | null;
}

export async function getHostMdmIdentity(
  request: APIRequestContext,
  hostId: number,
): Promise<HostMdmIdentity> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  const { host } = await res.json();
  return { hostname: host?.hostname ?? '', enrollmentStatus: host?.mdm?.enrollment_status ?? null };
}

/** One row of a host's Certificates card, as Fleet reports it. */
export interface HostCertificate {
  commonName: string;
  issuerCommonName: string;
  /** `system` or `user` — the card renders these as "System" / "User". */
  source: string;
  notValidBefore: string;
  notValidAfter: string;
}

/**
 * The Certificates card's own page size and default sort
 * (`DEFAULT_CERTIFICATES_PAGE_SIZE`, `CERTIFICATES_DEFAULT_SORT`). Mirrored here
 * so a spec can compare the rendered rows against the same page the card asked
 * for, rather than against a longer list it would only show the first slice of.
 */
const CERTIFICATES_PAGE_SIZE = 10;

/** A host's certificates as the card lists them, plus its total. */
export interface HostCertificatesPage {
  /** The first page, in the card's default order (common name ascending). */
  certificates: HostCertificate[];
  /** Every certificate the host reports — what the card's "N certificates" counts. */
  total: number;
}

/**
 * Certificates a host reports out of its system and login keychains, in the
 * card's default order and page size, alongside the host's total.
 *
 * Only real devices report any: an osquery-perf simulation returns an empty
 * list, and Fleet then doesn't mount the card at all
 * (`HostDetailsPage.tsx`, `showCertificatesCard`). Resolve the host with
 * `findOnlineHost(..., { kind: 'real' })` before calling this.
 */
export async function getHostCertificates(
  request: APIRequestContext,
  hostId: number,
): Promise<HostCertificatesPage> {
  const res = await request.get(apiUrl(`hosts/${hostId}/certificates`), {
    headers: authHeaders(),
    params: {
      per_page: String(CERTIFICATES_PAGE_SIZE),
      order_key: 'common_name',
      order_direction: 'asc',
    },
  });
  await expect(res, `Failed to read certificates for host ${hostId}`).toBeOK();
  const body = await res.json();
  const certificates = (body.certificates ?? []).map(
    (c: {
      common_name: string;
      issuer: { common_name: string };
      source: string;
      not_valid_before: string;
      not_valid_after: string;
    }) => ({
      commonName: c.common_name,
      issuerCommonName: c.issuer?.common_name ?? '',
      source: c.source,
      notValidBefore: c.not_valid_before,
      notValidAfter: c.not_valid_after,
    }),
  );
  return { certificates, total: body.count ?? certificates.length };
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

/** A host as the hosts list reports it, with the fields a batch run decides on. */
export interface ListedHost {
  id: number;
  platform: string;
  /** fleetd/Orbit version, or null for a host that can't run scripts. */
  orbitVersion: string | null;
  /** False when fleetd runs with scripts disabled; null when the host hasn't said. */
  scriptsEnabled: boolean | null;
  /** Whether it's one of the QA VMs rather than a simulation — see {@link HostKind}. */
  real: boolean;
}

/**
 * Every host in a fleet (0 for Unassigned), optionally narrowed by status. The
 * hosts list is the one listing that fills in `orbit_version`.
 */
export async function listFleetHosts(
  request: APIRequestContext,
  fleetId: number,
  opts: { status?: 'online' | 'offline' } = {},
): Promise<ListedHost[]> {
  const params: Record<string, string> = { fleet_id: String(fleetId), per_page: '1000' };
  if (opts.status) params.status = opts.status;
  const res = await request.get(apiUrl('hosts'), { headers: authHeaders(), params });
  await expect(res, `Failed to list the hosts of fleet ${fleetId}`).toBeOK();
  const hosts = (await res.json()).hosts as Array<{
    id: number;
    platform: string;
    orbit_version: string | null;
    scripts_enabled: boolean | null;
    hardware_model?: string;
  }>;
  return hosts.map((h) => ({
    id: h.id,
    platform: h.platform,
    orbitVersion: h.orbit_version ?? null,
    scriptsEnabled: h.scripts_enabled ?? null,
    real: REAL_DEVICE_MODEL.test(h.hardware_model ?? ''),
  }));
}

/** A real VM, with the fleet it's on (0 for Unassigned). */
export type RealHostRef = OnlineHostRef & { fleetId: number };

/**
 * The online real VM of `platform`, with its fleet (0 for Unassigned — every
 * host on free). Throws rather than returning null: a spec that needs a real
 * device has nothing to test without one, and the message says what to check.
 */
export async function requireRealHost(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
): Promise<RealHostRef> {
  const host = await findOnlineHost(request, platform, { kind: 'real' });
  if (!host) {
    throw new Error(
      `no online real ${platform} VM on ${process.env.FLEET_URL} — scripts, installs and MDM commands only ` +
        `reach a real device. Check the ${platform} VM is powered on and enrolled.`,
    );
  }
  return { ...host, fleetId: (await getHostFleetId(request, host.id)) ?? 0 };
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
  /** Reported hardware model — what {@link matchesKind} reads to tell a QA VM
   * from an osquery-perf simulation. Absent on a host that hasn't reported
   * vitals yet, which reads as "not a real device". */
  hardware_model?: string;
  /** The host's own hostname, which diverges from `display_name` on macOS
   * ("macos-prem's Virtual Machine" vs "macos-prems-Virtual-Machine.local").
   * fleetctl resolves `--host` / `--hosts` against this, not the display name. */
  hostname?: string;
  mdm?: { enrollment_status?: string | null; connected_to_fleet?: boolean | null };
  /** Set only when the simulation runs orbit — see {@link findSimulatedHostForMdm}. */
  orbit_version?: string | null;
  /** The host's fleet; null for Unassigned. */
  team_id?: number | null;
}

async function listOnlineHosts(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  perPage: number,
  direction: 'asc' | 'desc' = 'asc',
  page = 0,
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
      page: String(page),
      order_key: 'display_name',
      order_direction: direction,
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
