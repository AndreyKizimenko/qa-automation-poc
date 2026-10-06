// Policy API helpers for seeding/tearing down preconditions.
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

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
  const res = await request.post(apiUrl('global/policies'), {
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

/** Delete global policies by id (bulk endpoint); safe on already-deleted ids. */
export async function deletePolicies(request: APIRequestContext, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await request
    .post(apiUrl('global/policies/delete'), { headers: authHeaders(), data: { ids } })
    .catch((err) => console.warn('[deletePolicies]', err));
}

/** A fleet's own policies (not inherited global ones). */
export async function listFleetPolicies(
  request: APIRequestContext,
  fleetId: number,
): Promise<Array<PolicyRef & { query: string }>> {
  const res = await request.get(apiUrl(`fleets/${fleetId}/policies`), { headers: authHeaders() });
  if (!res.ok()) throw new Error(`[listFleetPolicies] ${res.status()}: ${await res.text()}`);
  return ((await res.json()).policies ?? []).map((p: { id: number; name: string; query: string }) => ({
    id: p.id,
    name: p.name,
    query: p.query,
  }));
}

/** Delete a fleet's policies by id; safe on already-deleted ids. */
export async function deleteFleetPolicies(
  request: APIRequestContext,
  fleetId: number,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  const res = await request.post(apiUrl(`fleets/${fleetId}/policies/delete`), {
    headers: authHeaders(),
    data: { ids },
  });
  if (!res.ok()) throw new Error(`[deleteFleetPolicies] ${res.status()}: ${await res.text()}`);
}

/**
 * The ids of the policies Fleet runs on a host — its Policies tab, as data. A
 * policy's label target decides it server-side, so a simulation answers as well
 * as a VM.
 */
export async function listHostPolicyIds(request: APIRequestContext, hostId: number): Promise<number[]> {
  const res = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
  return (((await res.json()).host?.policies ?? []) as Array<{ id: number }>).map((p) => p.id).sort((a, b) => a - b);
}

/** A global policy as Fleet stores it — the fields the specs read back. */
export interface GlobalPolicy extends PolicyRef {
  query: string;
  /** Comma-separated platforms, `''` when the policy targets every platform. */
  platform: string;
}

/** One global policy, read back after a UI write. */
export async function getGlobalPolicy(request: APIRequestContext, id: number): Promise<GlobalPolicy> {
  const res = await request.get(apiUrl(`global/policies/${id}`), { headers: authHeaders() });
  await expect(res, `Failed to read global policy ${id}`).toBeOK();
  const { policy } = await res.json();
  return { id: policy.id, name: policy.name, query: policy.query, platform: policy.platform ?? '' };
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
  await expect(res, `Failed to read host ${hostId}`).toBeOK();
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
  await expect(res, `Failed to list the hosts ${response} policy ${policyId}`).toBeOK();
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
  /** `patch` ties the policy to `patch_software_title_id`, a Fleet-maintained app. */
  type?: 'dynamic' | 'patch';
  patch_software_title_id?: number;
  patch_when_closed?: boolean;
  notify_before_patching?: boolean;
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
  continuousAutomationsEnabled: boolean;
  patchWhenClosed: boolean;
  notifyBeforePatching: boolean;
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
  team_id: number | null;
  author_email?: string;
  platform?: string;
  type?: string;
  continuous_automations_enabled?: boolean;
  patch_when_closed?: boolean;
  notify_before_patching?: boolean;
  install_software?: { software_title_id: number } | null;
  run_script?: { id: number; name: string } | null;
  patch_software?: { software_title_id: number } | null;
}

function toFleetPolicy(p: RawFleetPolicy): FleetPolicy {
  return {
    id: p.id,
    name: p.name,
    query: p.query,
    teamId: p.team_id ?? 0,
    authorEmail: p.author_email ?? '',
    platform: p.platform ?? '',
    type: p.type ?? 'dynamic',
    continuousAutomationsEnabled: p.continuous_automations_enabled ?? false,
    patchWhenClosed: p.patch_when_closed ?? false,
    notifyBeforePatching: p.notify_before_patching ?? false,
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
  const res = await request.post(apiUrl(`fleets/${fleetId}/policies`), { headers: authHeaders(), data: fields });
  if (!res.ok()) {
    throw new Error(`[createFleetPolicy] ${res.status()} creating "${fields.name}": ${await res.text()}`);
  }
  return toFleetPolicy((await res.json()).policy);
}

/** Changes a fleet policy's fields; anything not passed stays as it was. */
export async function updateFleetPolicy(
  request: APIRequestContext,
  fleetId: number,
  policyId: number,
  fields: FleetPolicyFields,
): Promise<FleetPolicy> {
  const res = await request.patch(apiUrl(`fleets/${fleetId}/policies/${policyId}`), {
    headers: authHeaders(),
    data: fields,
  });
  if (!res.ok()) throw new Error(`[updateFleetPolicy] ${res.status()} on policy ${policyId}: ${await res.text()}`);
  return toFleetPolicy((await res.json()).policy);
}

/** A fleet policy as Fleet stores it now. */
export async function getFleetPolicy(
  request: APIRequestContext,
  fleetId: number,
  policyId: number,
): Promise<FleetPolicy> {
  const res = await request.get(apiUrl(`fleets/${fleetId}/policies/${policyId}`), { headers: authHeaders() });
  if (!res.ok()) throw new Error(`[getFleetPolicy] ${res.status()} on policy ${policyId}: ${await res.text()}`);
  return toFleetPolicy((await res.json()).policy);
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
  const res = await request.get(apiUrl(`fleets/${fleetId}/policies`), { headers: authHeaders() });
  if (!res.ok()) throw new Error(`[findPatchPolicy] ${res.status()}: ${await res.text()}`);
  const raw = ((await res.json()).policies ?? []) as RawFleetPolicy[];
  const found = raw.find((p) => p.type === 'patch' && p.patch_software?.software_title_id === titleId);
  return found ? toFleetPolicy(found) : null;
}
