import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';
import { apiLatestUrl, apiUrl, authHeaders, expectOk, type HostRef } from './core';
import { simClaim, TRANSFER_POOL_END, type SimClaimKey } from '../claims';
import { labHostFleet, labHostNamed, poolHostsOfRun, type LabHost } from '../lab-hosts';

/**
 * Every value Fleet records as a Linux host's `platform`: `HostLinuxOSs` in
 * Fleet's `server/fleet/hosts.go`. A distribution missing here matches no
 * platform at all, so no picker and no guard sees its hosts. Fedora reports
 * `rhel` and Kubuntu `ubuntu`; Zorin, openSUSE Leap and Omarchy report their own.
 */
const LINUX_PLATFORMS = new Set([
  'linux', 'ubuntu', 'zorin', 'debian', 'parrot', 'rhel', 'centos', 'sles', 'kali', 'gentoo',
  'amzn', 'pop', 'arch', 'linuxmint', 'void', 'nixos', 'endeavouros', 'manjaro', 'manjaro-arm',
  'opensuse-leap', 'opensuse-tumbleweed', 'tuxedo', 'neon', 'archarm', 'flatcar', 'coreos',
  'cachyos', 'omarchy', 'amd-ryzen-ai-developer-platform',
]);

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
  return LINUX_PLATFORMS.has(hostPlatform);
}

/**
 * A host's display name by id — what the UI's host pickers search and list.
 * Pairs with {@link findSimulations}, which hands out ids.
 */
export async function getHostDisplayName(request: APIRequestContext, hostId: number): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host.display_name as string;
}

/**
 * A host's platform as Fleet records it — osquery's `os_version.platform`
 * (`darwin`, `windows`, `ubuntu`, …), which is what a live query of that column
 * returns on a real host.
 */
export async function getHostPlatform(request: APIRequestContext, hostId: number): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host.platform as string;
}

/** A host's CPU architecture as osquery reports it: `x86_64`, `aarch64`, `arm64e`. */
export async function getHostCpuType(request: APIRequestContext, hostId: number): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host.cpu_type as string;
}

/** What the Hosts list shows of a host and searches it by. */
export interface HostSummary {
  id: number;
  displayName: string;
  /** One of the identifiers the Hosts list search matches, beside the name, hostname, serial and IPs. */
  uuid: string;
  /** The raw value the Operating system column shows and sorts by (`os_version`). */
  osVersion: string;
}

/** A host's name, UUID and OS version, read from `GET /hosts/:id`. */
export async function getHostSummary(request: APIRequestContext, hostId: number): Promise<HostSummary> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  const host = (await res.json()).host;
  return { id: host.id, displayName: host.display_name, uuid: host.uuid, osVersion: host.os_version };
}

/** What a host reports of its OS and its agent: the identity a per-OS smoke asserts. */
export interface HostAgentReport {
  /** osquery's `os_version.platform`: `ubuntu`, `rhel`, `amzn`, `windows`, `darwin`. */
  platform: string;
  /** "Ubuntu 24.04.5 LTS", "Red Hat Enterprise Linux 9.9.0". */
  osVersion: string;
  osqueryVersion: string;
  /** fleetd's version; empty for a host that runs osquery without it. */
  orbitVersion: string;
}

/** The OS and agent versions a host reports, read from `GET /hosts/:id`. */
export async function getHostAgentReport(request: APIRequestContext, hostId: number): Promise<HostAgentReport> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  const host = (await res.json()).host;
  return {
    platform: host.platform ?? '',
    osVersion: host.os_version ?? '',
    osqueryVersion: host.osquery_version ?? '',
    orbitVersion: host.orbit_version ?? '',
  };
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
  await expectOk(res, 'Failed to list hosts');
  const body = await res.json();
  const hosts = (body.hosts ?? []) as Array<{ id: number; display_name: string }>;

  for (const host of hosts) {
    const swRes = await request.get(apiUrl(`hosts/${host.id}/software`), {
      headers: authHeaders(),
      params: { per_page: '1' },
    });
    await expectOk(swRes, `Failed to read the software of host ${host.id}`);
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
  /** The OS the host reports (`os_version`): "macOS 26.6.2", "Ubuntu 24.04.5 LTS". */
  osVersion: string;
}

/**
 * Which population of hosts to draw from. The QA instances carry the device
 * lab's machines and a large **simulated** (osquery-perf) load fleet, and they
 * suit opposite purposes:
 *
 *  - `'real'` — one of the lab's **pool** hosts of the run's tier
 *    (`helpers/lab-hosts.ts`): the interchangeable machines the real-host specs
 *    run on. It runs real osquery, so it answers live queries with the query's
 *    actual results, reports real local users and agent versions, and supports
 *    MDM-gated features. Use for any spec asserting real device behaviour. Each
 *    worker is handed one pool host per platform and keeps it
 *    ({@link findOnlineHost}).
 *  - `'simulated'` — the disposable load fleet. Plentiful and self-regenerating,
 *    but it ignores live-query SQL, returns no rows for a fraction of runs, and
 *    reports contradictory label membership. Use where the test needs *volume*
 *    (bulk select/transfer/delete) and the individual host is incidental.
 *
 * The lab's other machines (the OS-flavour and special-purpose hosts on
 * premium's **OS matrix** fleet, a physical machine) are neither: no real-host
 * spec is handed one, and no simulation picker may move, delete, lock or run
 * anything on it.
 *
 * A lab machine is one the lab's manifest **lists by name**, and the manifest's
 * role says what it is for. A host the manifest doesn't list yet is still told
 * from a simulation by its **hardware**: the lab's VMs run on virtualized
 * hardware, while osquery-perf reports fixed consumer models (`MacBookPro11,4`,
 * `Surface Laptop 2`) or none at all (its Linux hosts). So a machine the lab
 * enrolled a minute ago is out of every simulation picker's reach, and waits
 * for its manifest entry to be anything more. A physical machine reports a
 * real hardware model, and only the manifest knows it.
 *
 * MDM enrollment is deliberately *not* the discriminator. It used to be, on the
 * premise that only real VMs were enrolled — which stopped being true once the
 * `perf-hosts` tooling began enrolling a share of the simulations, at which
 * point `'real'` started returning simulations and `'simulated'` could return a
 * VM. A host's enrollment also flaps independently of what kind of host it is.
 */
export type HostKind = 'real' | 'simulated';

/** What the hosts list reports of a host that tells a lab machine from a simulation. */
interface HostIdentity {
  display_name?: string;
  hardware_model?: string;
  hardware_vendor?: string;
}

/**
 * The hardware of a lab VM: the macOS ones report the model `VirtualMac2,1`,
 * and the Linux and Windows ones the vendor `QEMU` with the model `Standard PC
 * (Q35 + ICH9, 2009)` or `QEMU Virtual Machine`. A host that has reported no
 * hardware yet, and that the manifest doesn't list, reads as a simulation.
 */
const LAB_HARDWARE_MODEL = /virtual|qemu|standard pc/i;
const LAB_HARDWARE_VENDOR = /qemu/i;

function isLabMachine(host: HostIdentity): boolean {
  return (
    !!labHostNamed(host.display_name) ||
    LAB_HARDWARE_MODEL.test(host.hardware_model ?? '') ||
    LAB_HARDWARE_VENDOR.test(host.hardware_vendor ?? '')
  );
}

/**
 * The manifest entry of a host a real-host spec may be handed: a pool host of
 * the run's tier, sitting on the fleet its role puts it on (VMs on premium,
 * beside the durable software and settings the specs count on). A pool host
 * found anywhere else is not handed out: the cleanup returns it before a run,
 * and the lab preflight names one that is still astray.
 */
function poolEntryOf(host: { display_name?: string; team_name?: string | null }): LabHost | undefined {
  const entry = labHostNamed(host.display_name);
  if (!entry || entry.role !== 'pool' || entry.tier !== process.env.SUITE) return undefined;
  return (host.team_name ?? null) === labHostFleet(entry) ? entry : undefined;
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
   * With `kind: 'real'`: only the pool hosts of this manifest `os` (`macos-26`),
   * for a spec whose assertions depend on the OS version. The macOS pool holds
   * two versions, and a worker's Mac is otherwise either.
   */
  os?: string;
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
 * An online host of the given platform that meets `requirements` — the resolver
 * behind the `liveMacosHost` fixture and any spec needing a host that actually
 * answers live reports, refetches, and transfers.
 *
 * **`kind: 'real'` is the worker's own pool host** of the platform
 * ({@link leasePoolHost}): the same one for every test the worker runs, and a
 * different one from the neighbouring worker's while the pool has a host each.
 *
 * Otherwise it is the first match by display name. Fleet's `platform` param
 * filters by *label group*, which can return hosts of other platforms, so
 * results are re-filtered on each host's own `platform` field, and ordering by
 * display name keeps the pick stable across calls in a run. The hosts are
 * **paged** rather than read off one window, since `kind: 'simulated'` is
 * decided client-side, and each page's candidates are tried before the next
 * page is fetched, so the walk stops on the page holding the first match.
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
  if (requirements.kind === 'real') {
    const host = await leasePoolHost(request, platform, requirements.os);
    if (!host) return null;
    if (requirements.withUsers && host.usernames.length === 0) return null;
    if (requirements.withOrbit && !host.orbitVersion) return null;
    return host;
  }

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
      if (requirements.kind === 'simulated' && isLabMachine(candidate)) continue;

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

/** One record Fleet holds of a host the lab's manifest lists. */
export interface LabHostRecord {
  /** The manifest's entry for it. */
  entry: LabHost;
  id: number;
  displayName: string;
  /** `online`, `offline`, …, as the hosts list reports it. */
  status: string;
  seenTime: string;
  /** Its fleet, null for Unassigned. */
  fleetId: number | null;
  fleetName: string | null;
  /** The OS it reports: "Ubuntu 24.04.5 LTS". */
  osVersion: string;
}

/**
 * Every record Fleet holds of the given manifest hosts, online or not, on
 * whatever fleet. One search per host: Fleet's `query` matches the hostname,
 * which carries the manifest's name whatever its case or domain suffix, and a
 * hit is kept only when its display name is the entry's. A host that
 * re-enrolled can leave a second, older record under the same name, so an
 * entry may come back more than once ({@link newestRecord}) or not at all.
 */
export async function listLabHostRecords(
  request: APIRequestContext,
  entries: readonly LabHost[],
): Promise<LabHostRecord[]> {
  const found = await Promise.all(
    entries.map(async (entry) => {
      const res = await request.get(apiUrl('hosts'), {
        headers: authHeaders(),
        params: { query: entry.name, per_page: '50' },
      });
      await expectOk(res, `Failed to look up the lab host ${entry.name}`);
      const hosts = ((await res.json()).hosts ?? []) as Array<{
        id: number;
        display_name?: string;
        status: string;
        seen_time: string;
        team_id?: number | null;
        team_name?: string | null;
        os_version?: string;
      }>;
      return hosts
        .filter((h) => (h.display_name ?? '').toLowerCase() === entry.name)
        .map((h): LabHostRecord => ({
          entry,
          id: h.id,
          displayName: h.display_name!,
          status: h.status,
          seenTime: h.seen_time,
          fleetId: h.team_id ?? null,
          fleetName: h.team_name ?? null,
          osVersion: h.os_version ?? '',
        }));
    }),
  );
  return found.flat();
}

/** The record of a manifest host that checked in last: the live one, where a re-enrollment left an older record behind. */
export function newestRecord(entry: LabHost, records: readonly LabHostRecord[]): LabHostRecord | undefined {
  return records
    .filter((r) => r.entry.name === entry.name)
    .sort((a, b) => b.seenTime.localeCompare(a.seenTime))[0];
}

/**
 * What keeps a manifest host from being used, or null when it is online on the
 * fleet its role puts it on: not enrolled (deleted, or expired after its fleet's
 * host-expiry window offline), on another fleet (a host that re-enrolled lands
 * on VMs, whose enroll secret every lab host carries), or offline since its
 * last check-in. The lab preflight and the real-host pickers' errors both say
 * this, so one host's outage reads the same wherever it shows.
 */
export function labHostProblem(entry: LabHost, records: readonly LabHostRecord[]): string | null {
  const record = newestRecord(entry, records);
  if (!record) return `"${entry.name}" is not enrolled (deleted or expired, and not re-enrolled since)`;
  const fleet = labHostFleet(entry);
  if (fleet !== undefined && record.fleetName !== fleet) {
    return `"${entry.name}" (id ${record.id}) is on ${record.fleetName ?? 'Unassigned'}, not on ${fleet ?? 'Unassigned'}, where a ${entry.role} host belongs`;
  }
  if (record.status !== 'online') {
    return `"${entry.name}" (id ${record.id}) is ${record.status}, last seen ${record.seenTime}`;
  }
  return null;
}

/**
 * The records of the given manifest hosts that sit on another fleet than the
 * one their role puts them on, each with the fleet it belongs on. Every lab
 * host carries the VMs fleet's enroll secret, so that is where one that
 * re-enrolled turns up. A host whose role names no fleet (a physical machine)
 * is never astray, and neither is anything on free, which has no fleets. The
 * cleanup moves what this returns; an older record a re-enrollment left behind
 * is listed too, and goes with its host.
 */
export async function listLabHostsAstray(
  request: APIRequestContext,
  entries: readonly LabHost[],
): Promise<Array<LabHostRecord & { belongsOn: string }>> {
  const placed = entries.filter((entry) => typeof labHostFleet(entry) === 'string');
  return (await listLabHostRecords(request, placed))
    .map((record) => ({ ...record, belongsOn: labHostFleet(record.entry) as string }))
    .filter((record) => record.fleetName !== record.belongsOn);
}

/**
 * The online record of a lab host outside the pool: a matrix host
 * (`matrixHostOfRun('rhel-9')`) or a special one (`specialHostOfRun('LUKS key
 * escrow')`), from `helpers/lab-hosts.ts`. Throws with what is wrong with it
 * ({@link labHostProblem}) when it isn't online on its role's fleet. A pool
 * host is never asked for by name: a worker gets its own from
 * {@link requireRealHost}.
 */
export async function requireLabHost(request: APIRequestContext, entry: LabHost): Promise<LabHostRecord> {
  if (entry.role === 'pool') {
    throw new Error(`[requireLabHost] ${entry.name} is a pool host: take the worker's own from requireRealHost`);
  }
  const records = await listLabHostRecords(request, [entry]);
  const problem = labHostProblem(entry, records);
  if (problem) throw new Error(`the ${entry.role} host for ${entry.purpose ?? entry.os} can't be used: ${problem}`);
  return newestRecord(entry, records)!;
}

/**
 * The pool of a platform as it stands now: this tier's pool hosts that are
 * online and on their fleet, by name. With `os`, only the hosts of that
 * manifest `os`. The cleanup and the lab preflight work through every member;
 * a test gets one of them from {@link requireRealHost}.
 */
export async function listPoolHosts(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  opts: { os?: string } = {},
): Promise<LabHostRecord[]> {
  const entries = poolHostsOfRun(platform, opts.os);
  const records = await listLabHostRecords(request, entries);
  return entries
    .filter((entry) => labHostProblem(entry, records) === null)
    .map((entry) => newestRecord(entry, records)!);
}

/**
 * Online hosts on the lab's virtualized hardware that the manifest doesn't
 * list: machines the lab enrolled after the suite's copy of the manifest was
 * last synced with the lab's. Each is out of every simulation picker's reach
 * already ({@link HostKind}) and is nothing more until it has an entry.
 */
export async function listUnlistedLabMachines(
  request: APIRequestContext,
): Promise<Array<HostRef & { fleetName: string | null }>> {
  const perPage = 500;
  const unlisted: Array<HostRef & { fleetName: string | null }> = [];
  for (let page = 0; page < 10; page++) {
    const res = await request.get(apiUrl('hosts'), {
      headers: authHeaders(),
      params: { status: 'online', per_page: String(perPage), page: String(page) },
    });
    await expectOk(res, 'Failed to list the online hosts');
    const batch = ((await res.json()).hosts ?? []) as OnlineHost[];
    unlisted.push(
      ...batch
        .filter((h) => isLabMachine(h) && !labHostNamed(h.display_name))
        .map((h) => ({ id: h.id, displayName: h.display_name, fleetName: h.team_name ?? null })),
    );
    if (batch.length < perPage) break;
  }
  return unlisted;
}

/**
 * The pool host each lease of this worker process holds, by platform and `os`.
 * A worker process runs one test at a time, so its host's one queue of scripts
 * and installs is never shared with a test of the same worker.
 */
const leases = new Map<string, number>();

/**
 * The worker's pool host of a platform: the pool's online members by name, and
 * `pool[parallelIndex % pool.length]`. A worker keeps its host for as long as
 * it stays online on its fleet, so a test and the fixtures beside it name the
 * same machine; one that drops out is replaced from the pool as it then stands,
 * which is how a dead member shrinks the pool instead of failing every test
 * that wanted its platform. Two workers share a host only when the platform
 * has fewer members than the run has workers.
 *
 * `parallelIndex` is the worker's slot (0 to workers - 1): unlike the worker
 * index, it stays the same when Playwright replaces a worker after a failure.
 */
async function leasePoolHost(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  os?: string,
): Promise<RealHostRef | null> {
  const key = `${platform}/${os ?? 'any'}`;
  const held = leases.get(key);
  if (held !== undefined) {
    const host = await readPoolHost(request, held);
    if (host) return recordVmOnReport(host);
    leases.delete(key);
  }

  const pool = await listPoolHosts(request, platform, { os });
  const slot = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
  // From the worker's own member on: one that left the pool since the listing gives way to the next.
  for (let i = 0; i < pool.length; i++) {
    const member = pool[(slot + i) % pool.length];
    const host = await readPoolHost(request, member.id);
    if (!host) continue;
    leases.set(key, member.id);
    return recordVmOnReport(host);
  }
  return null;
}

/** A pool host with its vitals, or null once it is gone, offline or off its fleet. */
async function readPoolHost(request: APIRequestContext, hostId: number): Promise<RealHostRef | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  if (res.status() === 404) return null;
  await expectOk(res, `Failed to read host ${hostId}`);
  const { host } = await res.json();
  if (host.status !== 'online' || !poolEntryOf(host)) return null;
  return { ...vitalsOf(host), fleetId: host.team_id ?? 0 };
}

/**
 * Notes on the running test's report which VM it ran on and the OS that VM
 * reports (`vm: prem-macos26-01 (macOS 26.6.2)`). The pool's members differ by
 * OS version, and a worker's host is its slot's, so the report is where a
 * failure on one of them shows as that. Outside a test (a worker fixture's
 * setup) there is no report to note it on.
 */
export function recordVmOnReport<T extends { displayName: string; osVersion: string }>(host: T): T {
  let info: ReturnType<typeof test.info>;
  try {
    info = test.info();
  } catch {
    return host;
  }
  const description = `${host.displayName} (${host.osVersion})`;
  if (!info.annotations.some((a) => a.type === 'vm' && a.description === description)) {
    info.annotations.push({ type: 'vm', description });
  }
  return host;
}

/**
 * Simulated hosts of a platform — the disposable pool for specs that mutate or
 * destroy hosts. Excludes every lab machine, whatever fleet it's on, so one can
 * never be selected (see {@link HostKind}).
 *
 * Drawn from the **end** of the display-name ordering on purpose: the read-only
 * pickers other specs use (`findOnlineHost`, `findHostWithSoftware`) all take the
 * first hosts ascending, so mutating from the other end keeps a parallel worker
 * from having a host moved out from under it mid-assertion.
 *
 * The slice is the claim's (`helpers/claims.ts`, pool `transfer`): the suite runs
 * fully parallel, so two mutating specs on the same platform must not be handed
 * the same hosts, and the registry's check holds the claims apart.
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
  claim: SimClaimKey<'transfer'>,
): Promise<HostRef[]> {
  const { platform, count, offset } = simClaim(claim);
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
        (h) => matchesPlatform(h.platform, platform) && !isLabMachine(h),
      ),
    );
    if (batch.length < perPage) break;
  }

  return matches
    .slice(offset, offset + count)
    .map((h) => ({ id: h.id, displayName: h.display_name }));
}

/**
 * How far into the end of the display-name ordering the borrowing specs start:
 * the `transfer` pool's claims sit below it, so a borrowed simulation is never
 * one a transfer or delete spec moves or deletes mid-test.
 */
const BORROW_SKIP = TRANSFER_POOL_END;

/**
 * Online, MDM-enrolled simulations — hosts a label-targeting spec can move onto
 * the VMs fleet as the "same platform, outside the label" host beside the real
 * VM. Only an MDM-enrolled host is one Fleet decides profile targeting for,
 * which is what makes it outside the label rather than merely outside MDM; a
 * simulation answers that server-side decision as well as a VM does (it lists
 * every profile that targets it, and none that doesn't).
 *
 * The enrolled simulations are scarce — about a quarter of the pool, and only 8
 * macOS ones sit past the transfer specs' part of it — so only specs about
 * profiles draw here. Everything else uses {@link findSimulations}, whose pool is
 * the rest: the two can't hand out the same host.
 *
 * The slice is the claim's (`helpers/claims.ts`, pool `mdm`). The ordering
 * covers every fleet, so a host another spec has borrowed keeps its place and
 * the slices stay apart. Returns fewer than the claim's `count` when the pool
 * can't cover it — callers assert on the length they need. `borrowSims` with
 * `mdm` is this, moved onto a fleet and returned after the test.
 */
export async function findMdmSimulations(request: APIRequestContext, claim: SimClaimKey<'mdm'>): Promise<number[]> {
  const { platform, count, offset } = simClaim(claim);
  return findBorrowableSimulations(request, platform, count, offset, (h) => !!h.mdm?.connected_to_fleet);
}

/**
 * Online simulations **not** enrolled in MDM — for what Fleet decides without
 * MDM: which hosts are offered a software title, which a policy or report
 * targets, who a label holds. Disjoint from {@link findMdmSimulations}' pool;
 * same slicing.
 *
 * The slice is the claim's (`helpers/claims.ts`, pool `plain`), which says
 * what the spec does to its hosts: several only read theirs (a label's
 * members, a search target), and only those may share one.
 */
export async function findSimulations(request: APIRequestContext, claim: SimClaimKey<'plain'>): Promise<number[]> {
  const { platform, count, offset } = simClaim(claim);
  return findBorrowableSimulations(request, platform, count, offset, (h) => !h.mdm?.connected_to_fleet);
}

/**
 * Offline simulations on Unassigned: the pool for a spec that needs many hosts
 * and must not shift anyone else's. At their daily refresh
 * (`tools/perf-hosts/com.fleetqa.perf.refresh.plist`, 09:00 VM-local time) the perf
 * daemons enroll a fresh set of ~300 simulations and abandon the previous one,
 * which stays offline until host expiry (`host_expiry_window: 1`) deletes it a
 * day later. Every other picker takes online hosts, so nothing else reads or
 * moves these.
 *
 * The most recently seen come first: they belong to the newest abandoned set,
 * a day from expiry, rather than to an older one expiry is about to delete.
 * Lab machines are excluded, as everywhere. Returns fewer than `count`
 * when the set is thin (a refresh that didn't run) — callers assert on the
 * length they need.
 *
 * The claim (`helpers/claims.ts`, pool `offline`) gives the platform and how
 * many: the set has no offsets, so two claims on one platform would get the
 * same hosts, and the registry's check refuses that unless both only read.
 */
export async function findOfflineSimulations(request: APIRequestContext, claim: SimClaimKey<'offline'>): Promise<number[]> {
  const { platform, count } = simClaim(claim);
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: {
      fleet_id: '0',
      status: 'offline',
      order_key: 'seen_time',
      order_direction: 'desc',
      per_page: '1000',
    },
  });
  await expectOk(res, 'Failed to list the offline hosts on Unassigned');
  const hosts = (await res.json()).hosts as Array<HostIdentity & { id: number; platform: string }>;
  return hosts
    .filter((h) => matchesPlatform(h.platform, platform) && !isLabMachine(h))
    .slice(0, count)
    .map((h) => h.id);
}

async function findBorrowableSimulations(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  count: number,
  offset: number,
  keep: (h: OnlineHost) => boolean,
): Promise<number[]> {
  const perPage = 100;
  const maxPages = 10;
  const simulated: OnlineHost[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'desc', page);
    simulated.push(...batch.filter((h) => matchesPlatform(h.platform, platform) && !isLabMachine(h)));
    const eligible = simulated.slice(BORROW_SKIP).filter(keep);
    if (eligible.length >= offset + count || batch.length < perPage) {
      return eligible.slice(offset, offset + count).map((h) => h.id);
    }
  }
  return [];
}

/**
 * The simulations in a {@link findSimulations} slice that can run a shell
 * script right now: online, on Unassigned, simulating fleetd (orbit) with
 * scripts enabled. Between a third and a half of the pool simulates orbit, so a
 * slice of `count` yields fewer; callers assert on the number they need.
 *
 * A simulation that runs a script reports a random exit code within about 35 s
 * (it polls every 30 s), so these answer *whether and when* a run reaches a host,
 * not what the script did. A batch fails outright if any host has left the
 * script's fleet, which is why the hosts come from a claimed slice nobody moves.
 */
export async function findScriptableSimulations(
  request: APIRequestContext,
  claim: SimClaimKey<'plain'>,
): Promise<HostRef[]> {
  const slice = new Set(await findSimulations(request, claim));
  const unassigned = await listFleetHosts(request, 0, { status: 'online' });
  return unassigned
    .filter((h) => slice.has(h.id) && !h.real && !!h.orbitVersion && h.scriptsEnabled !== false)
    .map((h) => ({ id: h.id, displayName: h.displayName }));
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
  await expectOk(res, `Failed to read host ${hostId}`);
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

/**
 * A simulated host suitable for a `fleetctl mdm` command.
 *
 * The claim (`helpers/claims.ts`, pool `fleetctl-mdm`) says which: MDM on or
 * off, orbit or not, and the offset. Reads the list endpoint alone — it carries
 * `hostname`, `mdm.connected_to_fleet` and `orbit_version`, so no per-host
 * detail fetch is needed. Draws from the
 * **end** of the display-name ordering, like {@link findSimulatedHostIds}, to stay
 * clear of the read-only pickers.
 */
export async function findSimulatedHostForMdm(
  request: APIRequestContext,
  claim: SimClaimKey<'fleetctl-mdm'>,
): Promise<MdmTargetHost | null> {
  const { platform, mdmConnected, withOrbit = false, offset } = simClaim(claim);
  if (mdmConnected === undefined) throw new Error(`[findSimulatedHostForMdm] claim ${claim} must say whether MDM is on`);
  const perPage = 100;
  const maxPages = 10;
  const matches: OnlineHost[] = [];

  for (let page = 0; matches.length <= offset && page < maxPages; page++) {
    const batch = await listOnlineHosts(request, platform, perPage, 'desc', page);
    matches.push(
      ...batch.filter(
        (h) =>
          matchesPlatform(h.platform, platform) &&
          !isLabMachine(h) &&
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
/**
 * When Fleet last stored each kind of collection. `policy_updated_at` moves when
 * the host's policy results land — after Fleet has queued whatever automations
 * those results fire, in the same request.
 */
export type HostCollectedAtField = 'detail_updated_at' | 'software_updated_at' | 'policy_updated_at';

/** When Fleet last stored `field` for the host (empty string if never). */
export async function getHostCollectedAt(
  request: APIRequestContext,
  hostId: number,
  field: HostCollectedAtField,
): Promise<string> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host?.[field] ?? '';
}

/** Asks Fleet to re-collect a host's vitals and software on its next check-in. */
export async function requestHostRefetch(request: APIRequestContext, hostId: number): Promise<void> {
  const res = await request.post(apiUrl(`hosts/${hostId}/refetch`), { headers: authHeaders() });
  await expectOk(res, `Failed to request a refetch of host ${hostId}`);
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
  await expectOk(res, `Failed to list host ${hostId}'s upcoming activities`);
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
    .poll(() => getHostRefetchRequested(request, hostId), {
      message: `host ${hostId} kept a refetch outstanding`,
      timeout,
      intervals: [5_000],
    })
    .toBe(false);
}

/**
 * Whether the host has a refetch outstanding (`refetch_requested`). Fleet sets
 * it when someone asks for a refetch and, on its own, when an install or an
 * uninstall succeeds; it clears it when the collection's results land. The flag
 * doesn't say who set it.
 */
export async function getHostRefetchRequested(request: APIRequestContext, hostId: number): Promise<boolean> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host?.refetch_requested ?? false;
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
  await expectOk(res, `Failed to read host ${hostId}`);
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
  await expectOk(res, `Failed to read certificates for host ${hostId}`);
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
  displayName: string;
  platform: string;
  /** fleetd/Orbit version, or null for a host that can't run scripts. */
  orbitVersion: string | null;
  /** False when fleetd runs with scripts disabled; null when the host hasn't said. */
  scriptsEnabled: boolean | null;
  /**
   * Whether it's one of the lab's machines rather than a simulation, on whatever
   * fleet the listing read — see {@link HostKind}.
   */
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
  await expectOk(res, `Failed to list the hosts of fleet ${fleetId}`);
  const hosts = (await res.json()).hosts as Array<
    HostIdentity & {
      id: number;
      display_name: string;
      platform: string;
      orbit_version: string | null;
      scripts_enabled: boolean | null;
    }
  >;
  return hosts.map((h) => ({
    id: h.id,
    displayName: h.display_name,
    platform: h.platform,
    orbitVersion: h.orbit_version ?? null,
    scriptsEnabled: h.scripts_enabled ?? null,
    real: isLabMachine(h),
  }));
}

/** A pool host a test was handed, with the fleet it's on (0 for Unassigned). */
export type RealHostRef = OnlineHostRef & { fleetId: number };

/**
 * The tag a test carries when it needs a platform's real VM online:
 * `{ tag: vmTag('darwin') }` on the test, or on its describe. A test that asks
 * {@link requireRealHost} or `liveMacosHost` for a VM without it fails, so the
 * tags select every test a VM outage takes down (`--grep @vm-macos`), and a
 * per-VM lane can take its tests by tag.
 */
export const VM_TAGS = { darwin: '@vm-macos', windows: '@vm-windows', linux: '@vm-linux' } as const;

export function vmTag(platform: 'darwin' | 'windows' | 'linux'): (typeof VM_TAGS)[typeof platform] {
  return VM_TAGS[platform];
}

/** Throws unless the running test carries the tag of the VM it is asking for. */
export function assertVmTagged(platform: 'darwin' | 'windows' | 'linux', asker: string): void {
  const info = test.info();
  const tag = VM_TAGS[platform];
  if (!info.tags.includes(tag)) {
    throw new Error(
      `[${asker}] "${info.title}" needs the ${platform} VM but isn't tagged ${tag}: add { tag: '${tag}' } ` +
        `(or \`vmTag('${platform}')\`) to the test or its describe.`,
    );
  }
}

/**
 * The worker's online real VM of `platform` (its pool host, see
 * {@link leasePoolHost}), with its fleet: VMs on premium, 0 for Unassigned on
 * free. With `os`, the pool is only the hosts of that manifest `os`, for a spec
 * that depends on the OS version. Throws rather than returning null: a spec
 * that needs a real device has nothing to test without one, and the message
 * says what to check. The calling test must carry the platform's
 * {@link VM_TAGS} tag, and its report notes the VM it was handed.
 */
export async function requireRealHost(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  opts: { os?: string } = {},
): Promise<RealHostRef> {
  assertVmTagged(platform, 'requireRealHost');
  const host = await leasePoolHost(request, platform, opts.os);
  if (!host) {
    throw new Error(
      `no online real ${platform} VM on ${process.env.FLEET_URL}: ${await missingRealHostReason(request, platform, opts.os)}. ` +
        'Scripts, installs and MDM commands only reach a real device.',
    );
  }
  return host;
}

/**
 * Why a platform's pool has no host to hand out, for the error a real-device
 * spec fails with: what is wrong with each pool host the manifest lists
 * ({@link labHostProblem}), or that it lists none.
 */
export async function missingRealHostReason(
  request: APIRequestContext,
  platform: 'darwin' | 'windows' | 'linux',
  os?: string,
): Promise<string> {
  const entries = poolHostsOfRun(platform, os);
  if (entries.length === 0) {
    return `lab-hosts.json lists no ${platform} pool host${os ? ` running ${os}` : ''} for the ${process.env.SUITE} tier`;
  }
  const records = await listLabHostRecords(request, entries);
  return entries
    .map((entry) => labHostProblem(entry, records) ?? `"${entry.name}" is online on its fleet, but its details didn't load`)
    .join('; ');
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
  await expectOk(res, `Failed to read host ${hostId}`);
  return (await res.json()).host?.team_id ?? null;
}

/**
 * Vitals for a single host, shaped for assertions. Null for a host that is
 * gone by the time it is read (deleted since the list was taken); any other
 * failure to read it throws.
 */
async function getOnlineHostVitals(
  request: APIRequestContext,
  candidate: OnlineHost,
): Promise<OnlineHostRef | null> {
  const res = await request.get(apiUrl(`hosts/${candidate.id}`), { headers: authHeaders() });
  if (res.status() === 404) return null;
  await expectOk(res, `Failed to read host ${candidate.id}`);
  return vitalsOf((await res.json()).host);
}

/** The vitals a host spec asserts against, from a `GET /hosts/:id` body's `host`. */
function vitalsOf(host: {
  id: number;
  display_name: string;
  users?: Array<{ username: string }> | null;
  orbit_version?: string | null;
  osquery_version?: string | null;
  os_version?: string;
}): OnlineHostRef {
  return {
    id: host.id,
    displayName: host.display_name,
    usernames: (host.users ?? []).map((u) => u.username),
    orbitVersion: host.orbit_version ?? null,
    osqueryVersion: host.osquery_version ?? null,
    osVersion: host.os_version ?? '',
  };
}

/**
 * A host as the hosts list reports it. Its display name, hardware model and
 * vendor are what {@link isLabMachine} reads to tell a lab machine from an
 * osquery-perf simulation.
 */
interface OnlineHost extends HostIdentity {
  id: number;
  display_name: string;
  platform: string;
  /** The host's own hostname, which can diverge from `display_name`: the lab's
   * Windows VMs show "PREM-WIN11-01" beside the hostname "prem-win11-01", and its
   * RHEL VMs report a fully qualified one ("prem-rhel9-01.px.lan"). fleetctl
   * resolves `--host` / `--hosts` against this, not the display name. */
  hostname?: string;
  mdm?: { enrollment_status?: string | null; connected_to_fleet?: boolean | null };
  /** Set only when the simulation runs orbit — see {@link findSimulatedHostForMdm}. */
  orbit_version?: string | null;
  /** The host's fleet; null for Unassigned. */
  team_id?: number | null;
  /** That fleet's name; null for Unassigned. */
  team_name?: string | null;
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
  // A failed list throws rather than reading as "no host": every real-device
  // spec would otherwise blame a VM for an API error.
  await expectOk(res, 'Failed to list the online hosts');
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
  await expectOk(res, `Failed to transfer hosts to fleet ${fleetId}`);
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
  await expectOk(res, `Failed to transfer hosts to fleet ${fleetId}`);
}

/**
 * The hosts of a fleet (0 for Unassigned) that Fleet's OS filter returns —
 * `os_name` + `os_version`, what "Current versions" → View all hosts links to —
 * each with the OS it reports ("macOS 15.2").
 */
export async function listHostsRunningOs(
  request: APIRequestContext,
  fleetId: number,
  osName: string,
  osVersion: string,
): Promise<Array<{ id: number; os: string }>> {
  const res = await request.get(apiUrl('hosts'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), os_name: osName, os_version: osVersion, per_page: '1000' },
  });
  await expectOk(res, `Failed to list hosts running ${osName} ${osVersion}`);
  return ((await res.json()).hosts ?? []).map((h: { id: number; os_version: string }) => ({ id: h.id, os: h.os_version }));
}

// ── End user (IdP username) ──────────────────────────────────────────────────

/** One entry of a host's `device_mapping` — an email and the source that reported it. */
export interface DeviceMapping {
  email: string;
  source: string;
}

/**
 * `PUT /hosts/:id/device_mapping` with `source: "idp"`: sets the host's IdP
 * username, which the host details **User** card shows as *Username (IdP)*.
 * Premium only; free answers 402 (`ErrMissingLicense`). Returns the raw response
 * so a spec can assert either outcome.
 */
export async function putHostIdpUsername(
  request: APIRequestContext,
  hostId: number,
  email: string,
): Promise<APIResponse> {
  return request.put(apiUrl(`hosts/${hostId}/device_mapping`), {
    headers: authHeaders(),
    data: { email, source: 'idp' },
  });
}

/**
 * `DELETE /hosts/:id/device_mapping/idp`: removes the host's IdP username.
 * Fleet answers 422 when the host has none; `ignoreMissing` treats that as done,
 * for a `finally` that may run after the test already removed it.
 */
export async function deleteHostIdpUsername(
  request: APIRequestContext,
  hostId: number,
  { ignoreMissing = false }: { ignoreMissing?: boolean } = {},
): Promise<APIResponse> {
  const res = await request.delete(apiUrl(`hosts/${hostId}/device_mapping/idp`), {
    headers: authHeaders(),
  });
  if (!(ignoreMissing && res.status() === 422)) {
    await expectOk(res, `Failed to remove the IdP username of host ${hostId}`);
  }
  return res;
}

/** The host's IdP username as `GET /hosts/:id` reports it (`end_users[0].idp_username`), or null. */
export async function getHostIdpUsername(
  request: APIRequestContext,
  hostId: number,
): Promise<string | null> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  const endUsers = ((await res.json()).host?.end_users ?? []) as Array<{ idp_username?: string }>;
  return endUsers.find((u) => u.idp_username)?.idp_username ?? null;
}

// ── Recovery Lock password ───────────────────────────────────────────────────

/**
 * A Mac's Recovery Lock password as `GET /hosts/:id` reports it
 * (`mdm.os_settings.recovery_lock_password`). `status` is `pending` while Fleet
 * sets, rotates or clears it, `verified` once the Mac has confirmed, `failed`,
 * or null when the host has none. Reading it here is not a view: unlike
 * `GET /hosts/:id/recovery_lock_password`, it records no activity and schedules
 * no rotation.
 */
export interface HostRecoveryLockStatus {
  status: 'pending' | 'verified' | 'failed' | null;
  detail: string;
  passwordAvailable: boolean;
}

export async function getHostRecoveryLockStatus(
  request: APIRequestContext,
  hostId: number,
): Promise<HostRecoveryLockStatus> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  const rl = (await res.json()).host?.mdm?.os_settings?.recovery_lock_password ?? {};
  return { status: rl.status ?? null, detail: rl.detail ?? '', passwordAvailable: !!rl.password_available };
}

/**
 * Polls until the host's Recovery Lock status is `expected`. A `failed` along
 * the way isn't final — Fleet retries the command — so it keeps polling, and a
 * timeout reports the last status with Fleet's detail.
 */
export async function waitForRecoveryLockStatus(
  request: APIRequestContext,
  hostId: number,
  expected: HostRecoveryLockStatus['status'],
  timeout: number,
): Promise<HostRecoveryLockStatus> {
  let last: HostRecoveryLockStatus = { status: null, detail: '', passwordAvailable: false };
  try {
    await expect
      .poll(async () => (last = await getHostRecoveryLockStatus(request, hostId)).status, {
        timeout,
        intervals: [5_000],
        message: `host ${hostId}'s Recovery Lock status to become ${expected}`,
      })
      .toBe(expected);
  } catch (e) {
    throw new Error(`${(e as Error).message}\nFleet's last detail: ${last.detail || '(none)'}`);
  }
  return last;
}
