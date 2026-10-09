import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders, type FleetRef } from './core';
import { deleteBootstrapPackage } from './mdm';
import { compareVersions } from './software';

/**
 * A fleet's whole `webhook_settings` subtree. Specs that touch one webhook
 * snapshot and restore the **entire** object: Fleet replaces the subtree
 * wholesale on PATCH, so sending back only the key you changed would wipe the
 * fleet's other webhooks (the failing-policies and host-activities ones).
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

/**
 * Deletes a fleet, and its bootstrap package first: Fleet leaves a deleted
 * fleet's bootstrap package behind (`mdm_apple_bootstrap_packages` isn't among
 * the tables a fleet delete clears), stored against an id nothing can reach.
 */
export async function deleteFleet(
  request: APIRequestContext,
  id: number,
  opts: { ignoreMissing?: boolean } = {},
): Promise<void> {
  await deleteBootstrapPackage(request, id);
  const res = await request.delete(apiUrl(`fleets/${id}`), {
    headers: authHeaders(),
  });
  if (opts.ignoreMissing && res.status() === 404) return;
  await expect(res, `Failed to delete fleet ${id}`).toBeOK();
}

/**
 * Deletes every fleet whose name starts with `prefix` — the cleanup sweep for
 * the throwaway `pw-*` fleets a spec creates and a timed-out run can strand.
 * Never pass a prefix a gitops-declared fleet could match.
 */
export async function deleteFleetsWithPrefix(request: APIRequestContext, prefix: string): Promise<void> {
  const res = await request.get(apiUrl('fleets'), { headers: authHeaders(), params: { per_page: '500' } });
  await expect(res, 'Failed to list fleets').toBeOK();
  const body = await res.json();
  const fleets = (body.fleets ?? body.teams ?? []) as Array<{ id: number; name: string }>;
  for (const fleet of fleets.filter((f) => f.name.startsWith(prefix))) {
    await deleteFleet(request, fleet.id, { ignoreMissing: true });
  }
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

/** A fleet's Apple OS update target, as Fleet stores it (`mdm.macos_updates`, …). */
export interface AppleOsUpdates {
  minimumVersion: string;
  deadline: string;
  deadlineDays: number | null;
}

/** A fleet's Windows update deadline (`mdm.windows_updates`). */
export interface WindowsOsUpdates {
  deadlineDays: number | null;
  gracePeriodDays: number | null;
}

/** A fleet's Windows disk-encryption settings, as the Windows tab saves them. */
export interface FleetWindowsDiskEncryption {
  enabled: boolean;
  bitlockerPinRequired: boolean;
}

/** Reads `mdm.windows_settings` from `/teams/:id`. Not for Unassigned (see `getGlobalDiskEncryption`). */
export async function getFleetWindowsDiskEncryption(
  request: APIRequestContext,
  fleetId: number,
): Promise<FleetWindowsDiskEncryption> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  const windows = (await res.json()).team?.mdm?.windows_settings ?? {};
  return {
    enabled: windows.enable_disk_encryption ?? false,
    bitlockerPinRequired: windows.require_bitlocker_pin ?? false,
  };
}

/** The OS update settings a fleet enforces. */
export async function getFleetOsUpdates(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ macos: AppleOsUpdates; windows: WindowsOsUpdates }> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  const mdm = (await res.json()).team?.mdm ?? {};
  return {
    macos: {
      minimumVersion: mdm.macos_updates?.minimum_version ?? '',
      deadline: mdm.macos_updates?.deadline ?? '',
      deadlineDays: mdm.macos_updates?.deadline_days ?? null,
    },
    windows: {
      deadlineDays: mdm.windows_updates?.deadline_days ?? null,
      gracePeriodDays: mdm.windows_updates?.grace_period_days ?? null,
    },
  };
}

/**
 * Enforces nothing: no Apple minimum version or deadline, no Windows deadline —
 * what the forms' "No updates enforced" and empty Windows fields save. **Only a
 * fleet without real hosts should ever be set otherwise** (see `OsUpdatesPage`).
 */
export async function clearFleetOsUpdates(request: APIRequestContext, fleetId: number): Promise<void> {
  const none = { minimum_version: '', deadline: '', deadline_days: null };
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: {
      mdm: {
        macos_updates: none,
        ios_updates: none,
        ipados_updates: none,
        windows_updates: { deadline_days: null, grace_period_days: null },
      },
    },
  });
  await expect(res, `Failed to clear fleet ${fleetId}'s OS updates: ${await res.text()}`).toBeOK();
}

/**
 * The macOS versions Apple's software lookup service lists
 * (`gdmf.apple.com/v2/pmv`, `AssetSets.macOS`), oldest first — the list Fleet
 * checks a minimum version against, refusing anything not on it ("isn't
 * supported by Apple"). Apple rotates versions out, so a spec reads it rather
 * than hardcoding one.
 */
export async function appleListedMacosVersions(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('https://gdmf.apple.com/v2/pmv', { timeout: 30_000 });
  await expect(res, "Couldn't read Apple's software lookup service").toBeOK();
  const assets = ((await res.json()).AssetSets?.macOS ?? []) as Array<{ ProductVersion: string }>;
  return [...new Set(assets.map((a) => a.ProductVersion))].sort(compareVersions);
}

/**
 * Enforces a macOS minimum version and deadline on a fleet — what the macOS
 * form's "Custom version" saves. **Only on a fleet with no real hosts**
 * (Workstations): the VMs would download and install the update.
 */
export async function setFleetMacosUpdates(
  request: APIRequestContext,
  fleetId: number,
  updates: { minimumVersion: string; deadline: string },
): Promise<void> {
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: {
      mdm: { macos_updates: { minimum_version: updates.minimumVersion, deadline: updates.deadline, deadline_days: null } },
    },
  });
  await expect(res, `Failed to set fleet ${fleetId}'s macOS updates: ${await res.text()}`).toBeOK();
}

/**
 * Enforces a Windows update deadline and grace period on a fleet. **Only on a
 * fleet with no real hosts** (Workstations): the Windows VM would install
 * updates and restart.
 */
export async function setFleetWindowsUpdates(
  request: APIRequestContext,
  fleetId: number,
  updates: { deadlineDays: number; gracePeriodDays: number },
): Promise<void> {
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: {
      mdm: { windows_updates: { deadline_days: updates.deadlineDays, grace_period_days: updates.gracePeriodDays } },
    },
  });
  await expect(res, `Failed to set fleet ${fleetId}'s Windows updates: ${await res.text()}`).toBeOK();
}

/** Whether the fleet enforces Recovery Lock passwords (`mdm.enable_recovery_lock_password`). */
export async function getFleetRecoveryLock(request: APIRequestContext, fleetId: number): Promise<boolean> {
  const res = await request.get(apiUrl(`teams/${fleetId}`), { headers: authHeaders() });
  await expect(res, `Failed to read fleet ${fleetId}`).toBeOK();
  return !!(await res.json()).team?.mdm?.enable_recovery_lock_password;
}

/**
 * Turns the fleet's Recovery Lock password enforcement on or off — what the
 * Passwords card saves. On, Fleet sets an escrowed password on the fleet's
 * Apple silicon Macs within its 30-second cron; off, it clears them the same way.
 * **Only `recovery-lock.spec.ts` turns it on for the VMs fleet**, and the
 * resting-state step in `setup/cleanup.steps.ts` turns it off after a dead run.
 */
export async function setFleetRecoveryLock(
  request: APIRequestContext,
  fleetId: number,
  enabled: boolean,
): Promise<void> {
  const res = await request.patch(apiUrl(`teams/${fleetId}`), {
    headers: authHeaders(),
    data: { mdm: { enable_recovery_lock_password: enabled } },
  });
  await expect(res, `Failed to set fleet ${fleetId}'s Recovery Lock enforcement: ${await res.text()}`).toBeOK();
}
