import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders, type FleetRef } from './core';

/**
 * A fleet's whole `webhook_settings` subtree. Specs that touch one webhook
 * snapshot and restore the **entire** object: Fleet replaces the subtree
 * wholesale on PATCH, so sending back only the key you changed would wipe the
 * fleet's other webhooks (Workstations carries a failing-policies webhook with
 * gitops-provisioned policy ids).
 */
export async function getFleetWebhookSettings(
  request: APIRequestContext,
  fleetId: number,
): Promise<Record<string, unknown>> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  return ((await res.json()).team?.webhook_settings ?? {}) as Record<string, unknown>;
}

/**
 * A fleet's own `host_expiry_settings`. Fleet-level expiry stacks on top of the
 * global setting rather than replacing it, so reading the UI's expected state
 * needs both this and `getAppConfig`.
 */
export async function getFleetHostExpirySettings(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ host_expiry_enabled?: boolean; host_expiry_window?: number }> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  return (await res.json()).team?.host_expiry_settings ?? {};
}

/** Writes a fleet's `webhook_settings` subtree back verbatim. */
export async function setFleetWebhookSettings(
  request: APIRequestContext,
  fleetId: number,
  webhookSettings: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: { webhook_settings: webhookSettings },
  });
  await expect(res, `Failed to update fleet ${fleetId} webhook settings`).toBeOK();
}

/**
 * A fleet's whole `features` subtree — `enable_host_users`,
 * `enable_software_inventory` and the `historical_data` collection switches the
 * dashboard's chart card reads.
 *
 * Snapshot and restore the **entire** object, same as `webhook_settings`: a
 * PATCH replaces the subtree wholesale, so sending back only `historical_data`
 * would silently turn off the fleet's host-users and software-inventory
 * collection.
 */
export async function getFleetFeatures(
  request: APIRequestContext,
  fleetId: number,
): Promise<Record<string, unknown>> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  return ((await res.json()).team?.features ?? {}) as Record<string, unknown>;
}

/** Writes a fleet's `features` subtree back verbatim. */
export async function setFleetFeatures(
  request: APIRequestContext,
  fleetId: number,
  features: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: { features },
  });
  await expect(res, `Failed to update fleet ${fleetId} features`).toBeOK();
}

/**
 * Whether a fleet is still collecting each historical dataset. `true` means
 * collecting — the UI's checkboxes are phrased the other way round ("Disable
 * hosts online historical reporting"), so don't read one as the other.
 */
export async function getFleetHistoricalData(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ uptime: boolean; vulnerabilities: boolean }> {
  const historical = ((await getFleetFeatures(request, fleetId)).historical_data ?? {}) as {
    uptime?: boolean;
    vulnerabilities?: boolean;
  };
  return {
    uptime: historical.uptime ?? true,
    vulnerabilities: historical.vulnerabilities ?? true,
  };
}

/** Exact name match. The `query` API param is fuzzy, so we filter client-side. */
export async function findFleetByName(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef | null> {
  const res = await request.get(apiUrl('fleets'), {
    headers: authHeaders(),
    params: { query: name, per_page: '50' },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const match = (body.fleets ?? body.teams ?? []).find(
    (t: { id: number; name: string }) => t.name === name,
  );
  return match ? { id: match.id, name: match.name } : null;
}

export async function createFleet(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef> {
  const res = await request.post(apiUrl('fleets'), {
    headers: authHeaders(),
    data: { name },
  });
  await expect(res, `Failed to create fleet "${name}"`).toBeOK();
  const body = await res.json();
  // The teams→fleets rename is in transition; prefer `fleet`, fall back to `team`.
  const ref = body.fleet ?? body.team;
  return { id: ref.id, name: ref.name };
}

export async function deleteFleet(
  request: APIRequestContext,
  id: number,
  opts: { ignoreMissing?: boolean } = {},
): Promise<void> {
  const res = await request.delete(apiUrl(`fleets/${id}`), {
    headers: authHeaders(),
  });
  if (opts.ignoreMissing && res.status() === 404) return;
  await expect(res, `Failed to delete fleet ${id}`).toBeOK();
}

/** Delete-then-create. Use in setup specs to clear stale state from prior runs. */
export async function recreateFleet(
  request: APIRequestContext,
  name: string,
): Promise<FleetRef> {
  const existing = await findFleetByName(request, name);
  if (existing) await deleteFleet(request, existing.id, { ignoreMissing: true });
  return createFleet(request, name);
}
