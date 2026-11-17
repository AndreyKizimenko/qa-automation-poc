import type { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders, expectOk, type FleetRef } from './core';
import { deleteBootstrapPackage } from './mdm';
import { compareVersions } from './software';

/** What the helpers here read of a fleet's stored settings. */
interface FleetSettings {
  webhook_settings?: Record<string, unknown>;
  host_expiry_settings?: { host_expiry_enabled?: boolean; host_expiry_window?: number };
  features?: Record<string, unknown>;
  mdm?: {
    windows_settings?: { enable_disk_encryption?: boolean; require_bitlocker_pin?: boolean };
    macos_updates?: { minimum_version?: string; deadline?: string; deadline_days?: number | null };
    windows_updates?: { deadline_days?: number | null; grace_period_days?: number | null };
    macos_recovery_lock_password_enabled?: boolean;
  };
}

/** A fleet's stored settings, as `GET /fleets/:id` returns them under `fleet`. */
async function readFleet(request: APIRequestContext, fleetId: number): Promise<FleetSettings> {
  const res = await request.get(apiUrl(`fleets/${fleetId}`), { headers: authHeaders() });
  await expectOk(res, `Failed to read fleet ${fleetId}`);
  const { fleet } = await res.json();
  if (!fleet || typeof fleet !== 'object') throw new Error(`GET /fleets/${fleetId} returned no \`fleet\` object`);
  return fleet as FleetSettings;
}

/**
 * `value`, or an error naming `key` when the fleet's settings don't carry it.
 * Fleet returns every key the readers here take, so a missing one is a key the
 * running build renamed or removed. Read as off or empty instead, it would let
 * a check that a setting is off pass without reading the setting, and let the
 * cleanup leave Recovery Lock on.
 */
function setting<T>(value: T | undefined | null, fleetId: number, key: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Fleet ${fleetId}'s settings have no \`${key}\`: renamed or removed in this Fleet build?`);
  }
  return value;
}

/** Like {@link setting}, for a switch: anything but a boolean is an error. */
function switchSetting(value: unknown, fleetId: number, key: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Fleet ${fleetId}'s \`${key}\` is ${JSON.stringify(value)}, not a boolean: renamed or removed in this Fleet build?`);
  }
  return value;
}

/**
 * A fleet's whole `webhook_settings` subtree: its host-status, failing-policies
 * and host-activities webhooks. A PATCH replaces only the webhooks it carries
 * and leaves the others as they are, so a spec that changes one snapshots and
 * restores that key alone, as an object: Fleet takes a webhook sent as `null`
 * as not sent.
 */
export async function getFleetWebhookSettings(
  request: APIRequestContext,
  fleetId: number,
): Promise<Record<string, unknown>> {
  return setting((await readFleet(request, fleetId)).webhook_settings, fleetId, 'webhook_settings');
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
  return setting((await readFleet(request, fleetId)).host_expiry_settings, fleetId, 'host_expiry_settings');
}

/** Writes the webhooks given into a fleet's `webhook_settings`; the ones left out stay as they are. */
export async function setFleetWebhookSettings(
  request: APIRequestContext,
  fleetId: number,
  webhookSettings: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
    headers: authHeaders(),
    data: { webhook_settings: webhookSettings },
  });
  await expectOk(res, `Failed to update fleet ${fleetId} webhook settings`);
}

/**
 * A fleet's whole `features` subtree — `enable_host_users`,
 * `enable_software_inventory` and the `historical_data` collection switches the
 * dashboard's chart card reads.
 *
 * A PATCH merges the keys it carries (`enable_software_inventory`, and
 * `historical_data`'s `uptime` and `vulnerabilities`) and leaves the rest as
 * they are. A spec snapshots the object and writes it back, which restores
 * whichever of those it changed.
 */
export async function getFleetFeatures(
  request: APIRequestContext,
  fleetId: number,
): Promise<Record<string, unknown>> {
  return setting((await readFleet(request, fleetId)).features, fleetId, 'features');
}

/** Writes a snapshot of a fleet's `features` back: the keys a PATCH takes are restored, the others ignored. */
export async function setFleetFeatures(
  request: APIRequestContext,
  fleetId: number,
  features: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
    headers: authHeaders(),
    data: { features },
  });
  await expectOk(res, `Failed to update fleet ${fleetId} features`);
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
  await expectOk(res, `Failed to look up the fleet "${name}"`);
  const body = await res.json();
  const match = (body.fleets ?? []).find(
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
  await expectOk(res, `Failed to create fleet "${name}"`);
  const { fleet } = await res.json();
  return { id: fleet.id, name: fleet.name };
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
  await expectOk(res, `Failed to delete fleet ${id}`);
}

/**
 * Deletes every fleet whose name starts with `prefix` — the cleanup sweep for
 * the throwaway `pw-*` fleets a spec creates and a timed-out run can strand.
 * Never pass a prefix a gitops-declared fleet could match.
 */
export async function deleteFleetsWithPrefix(request: APIRequestContext, prefix: string): Promise<void> {
  const res = await request.get(apiUrl('fleets'), { headers: authHeaders(), params: { per_page: '500' } });
  await expectOk(res, 'Failed to list fleets');
  const body = await res.json();
  const fleets = (body.fleets ?? []) as Array<{ id: number; name: string }>;
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

/** Reads `mdm.windows_settings` from `/fleets/:id`. Not for Unassigned (see `getGlobalDiskEncryption`). */
export async function getFleetWindowsDiskEncryption(
  request: APIRequestContext,
  fleetId: number,
): Promise<FleetWindowsDiskEncryption> {
  const mdm = setting((await readFleet(request, fleetId)).mdm, fleetId, 'mdm');
  const windows = setting(mdm.windows_settings, fleetId, 'mdm.windows_settings');
  return {
    enabled: switchSetting(windows.enable_disk_encryption, fleetId, 'mdm.windows_settings.enable_disk_encryption'),
    bitlockerPinRequired: switchSetting(windows.require_bitlocker_pin, fleetId, 'mdm.windows_settings.require_bitlocker_pin'),
  };
}

/**
 * Writes a fleet's disk-encryption settings, every platform at once: Linux key escrow and Windows enforcement
 * as given, the BitLocker PIN and both macOS settings off. Only for a throwaway `pw-*` fleet that holds the
 * lab hosts a disk-encryption spec moved there: Windows enforcement acts on every MDM-enrolled Windows host
 * on the fleet with nobody asked, the PIN would stop every boot of one at a prompt, and nothing in Fleet
 * undoes either.
 */
export async function setFleetDiskEncryption(
  request: APIRequestContext,
  fleetId: number,
  settings: { linuxEscrowEnabled?: boolean; windowsEnabled?: boolean },
): Promise<void> {
  const res = await request.post(apiUrl('disk_encryption'), {
    headers: authHeaders(),
    data: {
      fleet_id: fleetId,
      macos_settings: { enable_disk_encryption: false, enable_escrow_disk_encryption_key: false },
      windows_settings: { enable_disk_encryption: !!settings.windowsEnabled, require_bitlocker_pin: false },
      linux_settings: { enable_escrow_disk_encryption_key: !!settings.linuxEscrowEnabled },
    },
  });
  await expectOk(res, `Failed to set disk encryption on fleet ${fleetId}`);
}

/** The OS update settings a fleet enforces. */
export async function getFleetOsUpdates(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ macos: AppleOsUpdates; windows: WindowsOsUpdates }> {
  const mdm = setting((await readFleet(request, fleetId)).mdm, fleetId, 'mdm');
  const macos = setting(mdm.macos_updates, fleetId, 'mdm.macos_updates');
  const windows = setting(mdm.windows_updates, fleetId, 'mdm.windows_updates');
  // The two deadline counts are null while nothing is enforced; the two strings are empty.
  return {
    macos: {
      minimumVersion: setting(macos.minimum_version, fleetId, 'mdm.macos_updates.minimum_version'),
      deadline: setting(macos.deadline, fleetId, 'mdm.macos_updates.deadline'),
      deadlineDays: macos.deadline_days ?? null,
    },
    windows: {
      deadlineDays: windows.deadline_days ?? null,
      gracePeriodDays: windows.grace_period_days ?? null,
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
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
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
  await expectOk(res, `Failed to clear fleet ${fleetId}'s OS updates: ${await res.text()}`);
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
  await expectOk(res, "Couldn't read Apple's software lookup service");
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
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
    headers: authHeaders(),
    data: {
      mdm: { macos_updates: { minimum_version: updates.minimumVersion, deadline: updates.deadline, deadline_days: null } },
    },
  });
  await expectOk(res, `Failed to set fleet ${fleetId}'s macOS updates: ${await res.text()}`);
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
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
    headers: authHeaders(),
    data: {
      mdm: { windows_updates: { deadline_days: updates.deadlineDays, grace_period_days: updates.gracePeriodDays } },
    },
  });
  await expectOk(res, `Failed to set fleet ${fleetId}'s Windows updates: ${await res.text()}`);
}

/** Whether the fleet enforces Recovery Lock passwords (`mdm.macos_recovery_lock_password_enabled`). */
export async function getFleetRecoveryLock(request: APIRequestContext, fleetId: number): Promise<boolean> {
  const mdm = setting((await readFleet(request, fleetId)).mdm, fleetId, 'mdm');
  return switchSetting(mdm.macos_recovery_lock_password_enabled, fleetId, 'mdm.macos_recovery_lock_password_enabled');
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
  const res = await request.patch(apiUrl(`fleets/${fleetId}`), {
    headers: authHeaders(),
    data: { mdm: { macos_recovery_lock_password_enabled: enabled } },
  });
  await expectOk(res, `Failed to set fleet ${fleetId}'s Recovery Lock enforcement: ${await res.text()}`);
}
