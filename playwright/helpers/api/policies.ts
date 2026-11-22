// Policy API helpers for seeding/tearing down preconditions.
//
// Every scope's policies are served from `/policies` (Fleet 5, fleetdm/fleet#58995; the old
// `/global/policies` and `/fleets/:id/policies` routes answer 410 since #59255). The scope is
// `fleet_id`: absent for "All fleets", `0` for Unassigned, a fleet's id otherwise; a policy's own
// routes (`/policies/:id`) take no scope.
import type { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders, expectOk } from './core';

export interface PolicyRef {
  id: number;
  name: string;
}

/**
 * Create a global (no-team) policy. SQL defaults to a trivially-valid
 * statement since most preconditions only care that a policy exists.
 */
export async function createPolicy(
  request: APIRequestContext,
  opts: {
    name: string;
    query?: string;
    description?: string;
    resolution?: string;
    /** Comma-separated `darwin` / `windows` / `linux` / `chrome`; omitted, the policy targets every platform. */
    platform?: string;
  },
): Promise<PolicyRef> {
  const res = await request.post(apiUrl('policies'), {
    headers: authHeaders(),
    data: {
      name: opts.name,
      query: opts.query ?? 'SELECT 1;',
      description: opts.description ?? '',
      resolution: opts.resolution ?? '',
      ...(opts.platform !== undefined ? { platform: opts.platform } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`[createPolicy] ${res.status()} creating "${opts.name}": ${await res.text()}`);
  }
  const { policy } = await res.json();
  return { id: policy.id, name: policy.name };
}

/**
 * Deletes global policies by id; an id already gone is not an error. Fleet
 * refuses the whole batch with a 404 when any one id is missing
 * (`PoliciesByID`), deleting none of them, so a batch that meets a 404 is sent
 * again an id at a time.
 */
export async function deletePolicies(request: APIRequestContext, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const res = await request.post(apiUrl('policies/delete'), { headers: authHeaders(), data: { ids } });
  if (res.status() === 404) {
    if (ids.length > 1) for (const id of ids) await deletePolicies(request, [id]);
    return;
  }
  await expectOk(res, `Failed to delete global policies ${ids.join(', ')}`);
}

/**
 * A fleet's own policies (not inherited global ones). `type` is Fleet's: `dynamic` for a policy someone wrote,
 * `patch` for one Fleet made for a Fleet-maintained app (Deploy → Patch), which Fleet names itself.
 */
export async function listFleetPolicies(
  request: APIRequestContext,
  fleetId: number,
): Promise<Array<PolicyRef & { query: string; type: string }>> {
  const res = await request.get(apiUrl('policies'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), per_page: '1000' },
  });
  if (!res.ok()) throw new Error(`[listFleetPolicies] ${res.status()}: ${await res.text()}`);
  return ((await res.json()).policies ?? []).map((p: { id: number; name: string; query: string; type?: string }) => ({
    id: p.id,
    name: p.name,
    query: p.query,
    type: p.type ?? 'dynamic',
  }));
}

/**
 * Deletes a fleet's policies by id; an id already gone is not an error. Fleet
 * deletes by id whatever the policy's scope, so `fleetId` names the fleet the
 * caller made them on, for the reader and the error. As with
 * {@link deletePolicies}, Fleet refuses the whole batch with a 404 when any one
 * id is missing, so such a batch is sent again an id at a time.
 */
export async function deleteFleetPolicies(
  request: APIRequestContext,
  fleetId: number,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  const res = await request.post(apiUrl('policies/delete'), { headers: authHeaders(), data: { ids } });
  if (res.status() === 404) {
    if (ids.length > 1) for (const id of ids) await deleteFleetPolicies(request, fleetId, [id]);
    return;
  }
  if (!res.ok()) throw new Error(`[deleteFleetPolicies] ${res.status()} on fleet ${fleetId}: ${await res.text()}`);
}

/**
 * The ids of the policies Fleet runs on a host — its Policies tab, as data. A
 * policy's label target decides it server-side, so a simulation answers as well
 * as a VM.
 */
export async function listHostPolicyIds(request: APIRequestContext, hostId: number): Promise<number[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  return (((await res.json()).host?.policies ?? []) as Array<{ id: number }>).map((p) => p.id).sort((a, b) => a - b);
}

/**
 * A policy's automation, as Fleet's `automation_type` names it. A policy has at
 * most one; a global policy (and every policy on free) can have only
 * `webhook_or_ticket`.
 */
export type PolicyAutomationType =
  | 'webhook_or_ticket'
  | 'software'
  | 'script'
  | 'configuration_profile'
  | 'calendar'
  | 'conditional_access';

/** A global policy as Fleet stores it — the fields the specs read back. */
export interface GlobalPolicy extends PolicyRef {
  query: string;
  /** Comma-separated platforms, `''` when the policy targets every platform. */
  platform: string;
  /** Its automation, or null. */
  automationType: PolicyAutomationType | null;
}

/** The global policy of that exact name; throws when there is none. */
export async function findGlobalPolicyByName(request: APIRequestContext, name: string): Promise<GlobalPolicy> {
  const res = await request.get(apiUrl('policies'), { headers: authHeaders(), params: { per_page: '1000' } });
  await expectOk(res, 'Failed to list the global policies');
  const policies = ((await res.json()).policies ?? []) as RawGlobalPolicy[];
  const policy = policies.find((p) => p.name === name);
  if (!policy) throw new Error(`No global policy named "${name}"`);
  return toGlobalPolicy(policy);
}

/** One global policy, read back after a UI write. */
export async function getGlobalPolicy(request: APIRequestContext, id: number): Promise<GlobalPolicy> {
  const res = await request.get(apiUrl(`policies/${id}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read global policy ${id}`);
  return toGlobalPolicy((await res.json()).policy);
}

interface RawGlobalPolicy {
  id: number;
  name: string;
  query: string;
  platform?: string;
  automation_type?: PolicyAutomationType | null;
}

function toGlobalPolicy(p: RawGlobalPolicy): GlobalPolicy {
  return { id: p.id, name: p.name, query: p.query, platform: p.platform ?? '', automationType: p.automation_type ?? null };
}

/**
 * What a host last answered for each policy it runs: `'pass'`, `'fail'`, or
 * `''` until it has run the policy (hourly, or on a refetch). Only a policy
 * with an answer gets the Policies tab's "View all hosts".
 */
export async function getHostPolicyResponses(
  request: APIRequestContext,
  hostId: number,
): Promise<Map<number, string>> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read host ${hostId}`);
  const policies = ((await res.json()).host?.policies ?? []) as Array<{ id: number; response: string }>;
  return new Map(policies.map((p) => [p.id, p.response ?? '']));
}

/**
 * The hosts Fleet lists for a policy and response — what a policy's
 * "View all hosts" and the policies list's Pass / Fail links open. Read live,
 * unlike the list's counts, which an hourly job refreshes.
 */
export async function listPolicyHosts(
  request: APIRequestContext,
  policyId: number,
  response: 'passing' | 'failing',
  fleetId?: number,
): Promise<Array<{ id: number; displayName: string }>> {
  const params: Record<string, string> = {
    policy_id: String(policyId),
    policy_response: response,
    per_page: '1000',
  };
  if (fleetId !== undefined) params.fleet_id = String(fleetId);
  const res = await request.get(apiUrl('hosts'), { headers: authHeaders(), params });
  await expectOk(res, `Failed to list the hosts ${response} policy ${policyId}`);
  return ((await res.json()).hosts as Array<{ id: number; display_name: string }>).map((h) => ({
    id: h.id,
    displayName: h.display_name,
  }));
}

/** What a fleet policy's create or update can set — Fleet's own field names, snake_case. */
export interface FleetPolicyFields {
  name?: string;
  query?: string;
  description?: string;
  resolution?: string;
  /** Comma-separated `darwin` / `windows` / `linux`; empty targets every platform. */
  platform?: string;
  /** Label names: the policy runs only on hosts in any of them. */
  labels_include_any?: string[];
  /** The library script the policy runs on a failing host; `null` removes the automation. */
  script_id?: number | null;
  /** The title the policy installs on a failing host; `null` removes the automation. */
  software_title_id?: number | null;
  continuous_automations_enabled?: boolean;
  /** `patch` ties the policy to the Fleet-maintained app `software_title_id` names. */
  type?: 'dynamic' | 'patch';
  patch_when_closed?: boolean;
  notify_before_patching?: boolean;
  patch_deadline?: boolean;
}

/** A fleet policy as Fleet stores it — the fields the policy specs read back. */
export interface FleetPolicy {
  id: number;
  name: string;
  query: string;
  /** The fleet it belongs to; 0 for Unassigned. */
  teamId: number;
  /** Who created it — the signed-in user for a policy saved from the UI. */
  authorEmail: string;
  platform: string;
  type: string;
  /** Its automation, or null. */
  automationType: PolicyAutomationType | null;
  continuousAutomationsEnabled: boolean;
  patchWhenClosed: boolean;
  notifyBeforePatching: boolean;
  patchDeadline: boolean;
  /** The title its install automation installs, or null. */
  installSoftwareTitleId: number | null;
  /** The script its run-script automation runs, or null. */
  runScript: { id: number; name: string } | null;
  /** The Fleet-maintained title a patch policy checks, or null. */
  patchSoftwareTitleId: number | null;
}

interface RawFleetPolicy {
  id: number;
  name: string;
  query: string;
  fleet_id: number | null;
  author_email?: string;
  platform?: string;
  type?: string;
  automation_type?: PolicyAutomationType | null;
  continuous_automations_enabled?: boolean;
  patch_when_closed?: boolean;
  notify_before_patching?: boolean;
  patch_deadline?: boolean;
  install_software?: { software_title_id: number } | null;
  run_script?: { id: number; name: string } | null;
  patch_software?: { software_title_id: number } | null;
}

function toFleetPolicy(p: RawFleetPolicy): FleetPolicy {
  return {
    id: p.id,
    name: p.name,
    query: p.query,
    teamId: p.fleet_id ?? 0,
    authorEmail: p.author_email ?? '',
    platform: p.platform ?? '',
    type: p.type ?? 'dynamic',
    automationType: p.automation_type ?? null,
    continuousAutomationsEnabled: p.continuous_automations_enabled ?? false,
    patchWhenClosed: p.patch_when_closed ?? false,
    notifyBeforePatching: p.notify_before_patching ?? false,
    patchDeadline: p.patch_deadline ?? false,
    installSoftwareTitleId: p.install_software?.software_title_id ?? null,
    runScript: p.run_script ? { id: p.run_script.id, name: p.run_script.name } : null,
    patchSoftwareTitleId: p.patch_software?.software_title_id ?? null,
  };
}

/** Creates a policy on a fleet (premium). Throws on a refusal, with Fleet's message. */
export async function createFleetPolicy(
  request: APIRequestContext,
  fleetId: number,
  fields: FleetPolicyFields & { name: string },
): Promise<FleetPolicy> {
  const res = await request.post(apiUrl('policies'), { headers: authHeaders(), data: { ...fields, fleet_id: fleetId } });
  if (!res.ok()) {
    throw new Error(`[createFleetPolicy] ${res.status()} creating "${fields.name}": ${await res.text()}`);
  }
  return toFleetPolicy((await res.json()).policy);
}

/** A policy read through its own route, which takes no scope: throws when it isn't on `fleetId`. */
function onFleet(what: string, policy: FleetPolicy, fleetId: number): FleetPolicy {
  if (policy.teamId !== fleetId) {
    throw new Error(`[${what}] policy ${policy.id} is on fleet ${policy.teamId}, not ${fleetId}`);
  }
  return policy;
}

/** Changes a fleet policy's fields; anything not passed stays as it was. */
export async function updateFleetPolicy(
  request: APIRequestContext,
  fleetId: number,
  policyId: number,
  fields: FleetPolicyFields,
): Promise<FleetPolicy> {
  const res = await request.patch(apiUrl(`policies/${policyId}`), { headers: authHeaders(), data: fields });
  if (!res.ok()) throw new Error(`[updateFleetPolicy] ${res.status()} on policy ${policyId}: ${await res.text()}`);
  return onFleet('updateFleetPolicy', toFleetPolicy((await res.json()).policy), fleetId);
}

/** A fleet policy as Fleet stores it now. */
export async function getFleetPolicy(
  request: APIRequestContext,
  fleetId: number,
  policyId: number,
): Promise<FleetPolicy> {
  const res = await request.get(apiUrl(`policies/${policyId}`), { headers: authHeaders() });
  if (!res.ok()) throw new Error(`[getFleetPolicy] ${res.status()} on policy ${policyId}: ${await res.text()}`);
  return onFleet('getFleetPolicy', toFleetPolicy((await res.json()).policy), fleetId);
}

/**
 * The fleet's patch policy for a Fleet-maintained title, or null. Found by what
 * it patches, not by name: Fleet names it itself ("macOS - <title> up to date").
 */
export async function findPatchPolicy(
  request: APIRequestContext,
  fleetId: number,
  titleId: number,
): Promise<FleetPolicy | null> {
  const res = await request.get(apiUrl('policies'), {
    headers: authHeaders(),
    params: { fleet_id: String(fleetId), type: 'patch', per_page: '1000' },
  });
  if (!res.ok()) throw new Error(`[findPatchPolicy] ${res.status()}: ${await res.text()}`);
  const raw = ((await res.json()).policies ?? []) as RawFleetPolicy[];
  const found = raw.find((p) => p.type === 'patch' && p.patch_software?.software_title_id === titleId);
  return found ? toFleetPolicy(found) : null;
}
