/**
 * Configuration profiles: the fleet-side record (what a profile targets), the
 * host-side record (which hosts Fleet lists it for, and in what state), and what
 * the device itself reports.
 *
 * Those are three different questions, and the label-targeting specs ask all of
 * them:
 *
 *  - **Listed for a host** is Fleet's decision, taken server-side on its profile
 *    reconciler's 30-second tick: once a profile is listed on any host, the same
 *    tick has decided every other host in the fleet. A simulation answers this as
 *    well as a real VM (an MDM-enrolled one lists every profile that targets it —
 *    a macOS simulation even acknowledges the install — and none that doesn't).
 *  - **Verified** means the host installed it and reported it back.
 *  - **On the device** is read with a live query, filtered to the profile's own
 *    domain or policy value — never an unfiltered `managed_policies` read, which
 *    returns fleetd's configuration, enroll secret included. Only real VMs answer
 *    live queries truthfully.
 */
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';
import type { GeneratedProfile } from '../profiles';

/** Label scopes, by label name. `includeAll` and `includeAny` can't be combined. */
export interface ProfileTargets {
  includeAll?: string[];
  includeAny?: string[];
  excludeAny?: string[];
}

export interface ProfileRecord {
  uuid: string;
  name: string;
  platform: string;
  includeAll: string[];
  includeAny: string[];
  excludeAny: string[];
  /** Labels Fleet marks `broken` — deleted from under the profile. */
  broken: string[];
}

type LabelRef = { name: string; broken?: boolean };

function toRecord(p: {
  profile_uuid: string;
  name: string;
  platform: string;
  labels_include_all?: LabelRef[] | null;
  labels_include_any?: LabelRef[] | null;
  labels_exclude_any?: LabelRef[] | null;
}): ProfileRecord {
  const names = (ls?: LabelRef[] | null) => (ls ?? []).map((l) => l.name);
  const all = [...(p.labels_include_all ?? []), ...(p.labels_include_any ?? []), ...(p.labels_exclude_any ?? [])];
  return {
    uuid: p.profile_uuid,
    name: p.name,
    platform: p.platform,
    includeAll: names(p.labels_include_all),
    includeAny: names(p.labels_include_any),
    excludeAny: names(p.labels_exclude_any),
    broken: all.filter((l) => l.broken).map((l) => l.name),
  };
}

function targetsForm(form: FormData, targets: ProfileTargets): void {
  for (const name of targets.includeAll ?? []) form.append('labels_include_all', name);
  for (const name of targets.includeAny ?? []) form.append('labels_include_any', name);
  for (const name of targets.excludeAny ?? []) form.append('labels_exclude_any', name);
}

/** Uploads a profile to a fleet (0 for Unassigned) and returns its uuid. */
export async function uploadProfile(
  request: APIRequestContext,
  fleetId: number,
  profile: GeneratedProfile,
  targets: ProfileTargets = {},
): Promise<string> {
  const form = new FormData();
  form.append('profile', new File([profile.content], profile.fileName));
  if (fleetId) form.append('fleet_id', String(fleetId));
  targetsForm(form, targets);
  const res = await request.post(apiUrl('configuration_profiles'), { headers: authHeaders(), multipart: form });
  await expect(res, `Failed to upload profile ${profile.name}: ${await res.text()}`).toBeOK();
  return (await res.json()).profile_uuid;
}

export async function getProfile(request: APIRequestContext, uuid: string): Promise<ProfileRecord> {
  const res = await request.get(apiUrl(`configuration_profiles/${uuid}`), { headers: authHeaders() });
  await expect(res, `Failed to read profile ${uuid}`).toBeOK();
  return toRecord(await res.json());
}

/** A fleet's profiles (0 for Unassigned). */
export async function listProfiles(request: APIRequestContext, fleetId: number): Promise<ProfileRecord[]> {
  const res = await request.get(apiUrl('configuration_profiles'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), per_page: '200' },
  });
  await expect(res, `Failed to list fleet ${fleetId}'s profiles`).toBeOK();
  return ((await res.json()).profiles ?? []).map(toRecord);
}

/** A fleet's profile by the name Fleet lists it as, or null. */
export async function findProfileByName(
  request: APIRequestContext,
  fleetId: number,
  name: string,
): Promise<ProfileRecord | null> {
  return (await listProfiles(request, fleetId)).find((p) => p.name === name) ?? null;
}

/** Deletes a profile. Already gone is fine. */
export async function deleteProfile(request: APIRequestContext, uuid: string): Promise<void> {
  const res = await request.delete(apiUrl(`configuration_profiles/${uuid}`), { headers: authHeaders() });
  if (res.status() === 404) return;
  await expect(res, `Failed to delete profile ${uuid}`).toBeOK();
}

export type HostProfileStatus = 'pending' | 'verifying' | 'verified' | 'failed';

export interface HostProfile {
  name: string;
  uuid: string;
  status: HostProfileStatus | null;
  /** `install` or `remove`. A profile being removed is still listed until the host acknowledges it. */
  operation: string;
  detail: string;
}

/** The profiles Fleet lists for a host — its Controls tab, as data. */
export async function listHostProfiles(request: APIRequestContext, hostId: number): Promise<HostProfile[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  const profiles = ((await res.json()).host?.mdm?.profiles ?? []) as Array<{
    name: string;
    profile_uuid: string;
    status: HostProfileStatus | null;
    operation_type: string;
    detail?: string;
  }>;
  return profiles.map((p) => ({
    name: p.name,
    uuid: p.profile_uuid,
    status: p.status,
    operation: p.operation_type,
    detail: p.detail ?? '',
  }));
}

/**
 * Which of `hostIds` Fleet lists the profile for, as something to install. A set,
 * so a spec asserts membership — exactly these, none of the others — and never a
 * count on a fleet other specs share.
 */
export async function hostsListingProfile(
  request: APIRequestContext,
  hostIds: Iterable<number>,
  profileUuid: string,
): Promise<Set<number>> {
  const listed = new Set<number>();
  for (const hostId of hostIds) {
    const profiles = await listHostProfiles(request, hostId);
    if (profiles.some((p) => p.uuid === profileUuid && p.operation === 'install')) listed.add(hostId);
  }
  return listed;
}

/** Waits until the host lists the profile in one of `statuses`, and returns what it listed. */
export async function waitForHostProfileStatus(
  request: APIRequestContext,
  hostId: number,
  profileUuid: string,
  statuses: HostProfileStatus[],
  timeout = 300_000,
): Promise<HostProfile> {
  let seen: HostProfile | undefined;
  await expect
    .poll(
      async () => {
        seen = (await listHostProfiles(request, hostId)).find((p) => p.uuid === profileUuid && p.operation === 'install');
        return seen?.status ?? 'not listed';
      },
      {
        message: `host ${hostId} never listed profile ${profileUuid} as ${statuses.join(' or ')}`,
        timeout,
        intervals: [5_000],
      },
    )
    .toMatch(new RegExp(`^(${statuses.join('|')})$`));
  return seen!;
}

/** Waits until the host no longer lists the profile at all — removal acknowledged. */
export async function waitForHostProfileGone(
  request: APIRequestContext,
  hostId: number,
  profileUuid: string,
  timeout = 180_000,
): Promise<void> {
  await expect
    .poll(async () => (await listHostProfiles(request, hostId)).some((p) => p.uuid === profileUuid), {
      message: `host ${hostId} kept listing profile ${profileUuid}`,
      timeout,
      intervals: [5_000],
    })
    .toBe(false);
}

/**
 * Runs `sql` on one host now and returns its rows (`POST /hosts/:id/query`). Only
 * a real VM's answer means anything — a simulation ignores the SQL.
 */
export async function queryHost(
  request: APIRequestContext,
  hostId: number,
  sql: string,
): Promise<Array<Record<string, string>>> {
  const res = await request.post(apiUrl(`hosts/${hostId}/query`), {
    headers: authHeaders(),
    data: { query: sql },
    timeout: 120_000,
  });
  await expect(res, `Live query on host ${hostId} failed`).toBeOK();
  const body = await res.json();
  if (body.error) throw new Error(`Live query on host ${hostId} errored: ${body.error}`);
  return body.rows ?? [];
}

/**
 * The keys a macOS host holds under one managed preference domain — empty when
 * no profile manages it. Filtered by domain on purpose: see the module comment.
 */
export async function readManagedPreferenceDomain(
  request: APIRequestContext,
  hostId: number,
  domain: string,
): Promise<Record<string, string>> {
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) throw new Error(`refusing to query an unusual domain: ${domain}`);
  const rows = await queryHost(
    request,
    hostId,
    `SELECT name, value FROM managed_policies WHERE domain = '${domain}';`,
  );
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}

/**
 * One MDM policy value as a Windows host records it under
 * `HKLM\SOFTWARE\Microsoft\PolicyManager\current\device\<area>`, or null when the
 * value isn't there. Windows keeps the value at its default after a profile's
 * removal rather than deleting it, so "removed" is "no longer the applied value".
 */
export async function readWindowsPolicyValue(
  request: APIRequestContext,
  hostId: number,
  area: string,
  name: string,
): Promise<string | null> {
  if (!/^[A-Za-z0-9]+$/.test(area + name)) throw new Error(`refusing to query an unusual policy: ${area}/${name}`);
  const rows = await queryHost(
    request,
    hostId,
    `SELECT data FROM registry WHERE key = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\PolicyManager\\current\\device\\${area}' AND name = '${name}';`,
  );
  return rows[0]?.data ?? null;
}

/**
 * A target as the Add / Edit profile modal sets it (`ProfileTarget` in
 * `ConfigurationProfilesPage`) in the API's terms, sorted — so what the modal
 * sent and what Fleet stored compare with `toEqual`.
 */
export function targetsFor(target: {
  include?: { labels: string[]; mode?: 'any' | 'all' };
  exclude?: string[];
}): Required<ProfileTargets> {
  const labels = [...(target.include?.labels ?? [])].sort();
  const all = target.include?.mode === 'all';
  return {
    includeAll: all ? labels : [],
    includeAny: all ? [] : labels,
    excludeAny: [...(target.exclude ?? [])].sort(),
  };
}

/** What a profile record targets, sorted — the other side of {@link targetsFor}. */
export function targetsOf(p: ProfileRecord): Required<ProfileTargets> {
  return {
    includeAll: [...p.includeAll].sort(),
    includeAny: [...p.includeAny].sort(),
    excludeAny: [...p.excludeAny].sort(),
  };
}

/** Which of `hostIds` Fleet lists each profile for, keyed by profile name. */
export async function profileListings(
  request: APIRequestContext,
  hostIds: number[],
  profiles: ProfileRecord[],
): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  for (const p of profiles) out[p.name] = [...(await hostsListingProfile(request, hostIds, p.uuid))].sort();
  return out;
}

/**
 * Waits until Fleet lists each profile on exactly its expected hosts of
 * `hostIds` — set membership, over hosts the caller controls. One reconciler
 * tick decides every host for a profile, so once the expected hosts list it the
 * others have been decided too.
 */
export async function waitForProfileListings(
  request: APIRequestContext,
  hostIds: number[],
  expected: Array<{ profile: ProfileRecord; hosts: number[] }>,
  timeout = 180_000,
): Promise<void> {
  const want = Object.fromEntries(expected.map((e) => [e.profile.name, [...e.hosts].sort()]));
  await expect
    .poll(() => profileListings(request, hostIds, expected.map((e) => e.profile)), {
      message: `each profile should be listed on exactly its hosts of ${hostIds.join(', ')}`,
      timeout,
      intervals: [5_000],
    })
    .toEqual(want);
}
