// App-config (global settings) helpers. Specs that mutate global settings via
// the UI use these to snapshot the affected subtree up front and restore it in
// teardown — Fleet's cleanup projects don't reset app config, and PATCH /config
// merges, so restoring just the touched fields is enough.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export interface OrgInfo {
  org_name?: string;
  // The "Organization support URL" field maps to `contact_url` in the API.
  contact_url?: string;
  /**
   * Custom org logo URLs. Fleet keeps two pairs: the mode-aware fields the UI
   * writes today (`*_light_mode` / `*_dark_mode`) and the deprecated aliases
   * they shadow (`org_logo_url_light_background` / `org_logo_url`). A logo
   * upload writes both members of a pair, and Fleet reads the alias when the
   * mode-aware field is empty — so anything clearing a logo must clear both.
   */
  org_logo_url_light_mode?: string;
  org_logo_url_light_background?: string;
  org_logo_url_dark_mode?: string;
  org_logo_url?: string;
  [key: string]: unknown;
}

/** The two logo variants Fleet stores and serves (`GET /logo?mode=`). */
export type OrgLogoMode = 'light' | 'dark';

/** One serving URL per mode; an empty string means "no custom logo". */
export type OrgLogoUrls = Record<OrgLogoMode, string>;

export interface VulnerabilitiesWebhook {
  enable_vulnerabilities_webhook?: boolean;
  destination_url?: string;
  [key: string]: unknown;
}

export interface FailingPoliciesWebhook {
  enable_failing_policies_webhook?: boolean;
  destination_url?: string;
  policy_ids?: number[];
  [key: string]: unknown;
}

export interface HostStatusWebhook {
  enable_host_status_webhook?: boolean;
  destination_url?: string;
  host_percentage?: number;
  days_count?: number;
  [key: string]: unknown;
}

/** Streams every activity-feed entry to a destination; the dashboard calls it "Manage automations". */
export interface ActivitiesWebhook {
  enable_activities_webhook?: boolean;
  destination_url?: string;
  [key: string]: unknown;
}

export interface WebhookSettings {
  vulnerabilities_webhook?: VulnerabilitiesWebhook;
  failing_policies_webhook?: FailingPoliciesWebhook;
  host_status_webhook?: HostStatusWebhook;
  activities_webhook?: ActivitiesWebhook;
  [key: string]: unknown;
}

/**
 * The disk-encryption fields a platform's settings subtree can carry. Which
 * ones are meaningful varies by platform: macOS uses enforcement and escrow,
 * Windows enforcement and the BitLocker PIN, Linux escrow only.
 */
export interface MdmPlatformSettings {
  enable_disk_encryption?: boolean;
  enable_escrow_disk_encryption_key?: boolean;
  require_bitlocker_pin?: boolean;
  [key: string]: unknown;
}

export interface MdmConfig {
  /**
   * Derived, not stored: Fleet reports `true` here only when every per-platform
   * disk-encryption setting is on, and a write to it fans out to all of them.
   * Snapshot and restore the per-platform subtrees instead — round-tripping
   * this field turns "macOS only" into "all platforms".
   */
  enable_disk_encryption?: boolean;
  macos_settings?: MdmPlatformSettings;
  windows_settings?: MdmPlatformSettings;
  linux_settings?: MdmPlatformSettings;
  [key: string]: unknown;
}

/** Global disk-encryption state, one field per control Fleet exposes. */
export interface DiskEncryptionSettings {
  macosEnabled: boolean;
  macosEscrowEnabled: boolean;
  windowsEnabled: boolean;
  windowsPinRequired: boolean;
  linuxEscrowEnabled: boolean;
}

export interface AppConfig {
  org_info?: OrgInfo;
  webhook_settings?: WebhookSettings;
  mdm?: MdmConfig;
  [key: string]: unknown;
}

/** Read global (no-fleet) disk-encryption state from the app config. */
export async function getGlobalDiskEncryption(
  request: APIRequestContext,
): Promise<DiskEncryptionSettings> {
  const mdm = (await getAppConfig(request)).mdm ?? {};
  const windowsEnabled = mdm.windows_settings?.enable_disk_encryption ?? false;
  return {
    macosEnabled: mdm.macos_settings?.enable_disk_encryption ?? false,
    macosEscrowEnabled: mdm.macos_settings?.enable_escrow_disk_encryption_key ?? false,
    windowsEnabled,
    // Fleet rejects a PIN requirement without Windows enforcement, so a PIN
    // flag left over from an earlier enforcement must not reach a write.
    windowsPinRequired: windowsEnabled && (mdm.windows_settings?.require_bitlocker_pin ?? false),
    linuxEscrowEnabled: mdm.linux_settings?.enable_escrow_disk_encryption_key ?? false,
  };
}

/**
 * Write global (no-fleet) disk-encryption state. Sends every platform, so this
 * restores a `getGlobalDiskEncryption` snapshot exactly. Omitting `fleet_id` is
 * what scopes the write to "No fleet" — sending `0` is rejected.
 */
export async function setGlobalDiskEncryption(
  request: APIRequestContext,
  settings: DiskEncryptionSettings,
): Promise<void> {
  const res = await request.post(apiUrl('disk_encryption'), {
    headers: authHeaders(),
    data: {
      macos_settings: {
        enable_disk_encryption: settings.macosEnabled,
        enable_escrow_disk_encryption_key: settings.macosEscrowEnabled,
      },
      windows_settings: {
        enable_disk_encryption: settings.windowsEnabled,
        require_bitlocker_pin: settings.windowsPinRequired,
      },
      linux_settings: {
        enable_escrow_disk_encryption_key: settings.linuxEscrowEnabled,
      },
    },
  });
  if (!res.ok()) {
    throw new Error(`[setGlobalDiskEncryption] ${res.status()}: ${await res.text()}`);
  }
}

/**
 * The custom org-logo URL currently in force for each mode, resolved the same
 * way Fleet resolves it: the mode-aware field wins, the deprecated alias is
 * the fallback. Use as the snapshot a logo-mutating spec restores from.
 */
export async function getOrgLogoUrls(request: APIRequestContext): Promise<OrgLogoUrls> {
  const org = (await getAppConfig(request)).org_info ?? {};
  return {
    light: org.org_logo_url_light_mode || org.org_logo_url_light_background || '',
    dark: org.org_logo_url_dark_mode || org.org_logo_url || '',
  };
}

/**
 * Remove the stored logo for one mode (DELETE /logo?mode=). This is the only
 * call that clears *both* the mode-aware field and its deprecated alias and
 * drops the blob from the object store — a `PATCH /config` that empties one
 * field leaves the other pointing at the old URL.
 *
 * Tolerates "nothing stored": the endpoint is the restore path for a spec that
 * may have failed before it uploaded anything.
 */
export async function deleteOrgLogo(
  request: APIRequestContext,
  mode: OrgLogoMode,
): Promise<void> {
  const res = await request.delete(apiUrl('logo'), {
    headers: authHeaders(),
    params: { mode },
  });
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`[deleteOrgLogo:${mode}] ${res.status()}: ${await res.text()}`);
  }
}

/**
 * Put one mode's org logo back the way a snapshot found it: deleted if there
 * was none, patched back to its recorded URL if there was.
 *
 * Restores one mode, never both. The two logos are independent settings and a
 * spec that changed only one must leave the other alone — restoring a mode it
 * never touched would roll back whatever a parallel sibling is doing to it.
 *
 * Restoring a pre-existing logo restores its *URL*, not its bytes: an upload
 * overwrites the stored blob for that mode. Specs that upload a logo should
 * therefore only run where none is configured.
 */
export async function restoreOrgLogo(
  request: APIRequestContext,
  mode: OrgLogoMode,
  url: string,
): Promise<void> {
  if (!url) {
    await deleteOrgLogo(request, mode);
    return;
  }
  const restored: Record<string, string> =
    mode === 'light'
      ? { org_logo_url_light_mode: url, org_logo_url_light_background: url }
      : { org_logo_url_dark_mode: url, org_logo_url: url };
  await patchAppConfig(request, { org_info: restored });
}

/**
 * Whether the deployment is still collecting each historical dataset for the
 * dashboard's chart card. `true` means collecting.
 *
 * Read-only on purpose, and there is deliberately no setter: turning either
 * dataset off deletes the history of **every** fleet at once and cannot be
 * undone, which would empty the charts the dashboard specs assert against.
 * Per-fleet collection is `getFleetHistoricalData` / `setFleetFeatures`, and
 * the effective state is the AND of the two.
 */
export async function getGlobalHistoricalData(
  request: APIRequestContext,
): Promise<{ uptime: boolean; vulnerabilities: boolean }> {
  const features = (await getAppConfig(request)).features as
    | { historical_data?: { uptime?: boolean; vulnerabilities?: boolean } }
    | undefined;
  const historical = features?.historical_data ?? {};
  return {
    uptime: historical.uptime ?? true,
    vulnerabilities: historical.vulnerabilities ?? true,
  };
}

/** Fetch the full app config (GET /config). */
export async function getAppConfig(request: APIRequestContext): Promise<AppConfig> {
  const res = await request.get(apiUrl('config'), { headers: authHeaders() });
  if (!res.ok()) {
    throw new Error(`[getAppConfig] ${res.status()}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Merge-patch the app config (PATCH /config). Pass only the subtree(s) to
 * change, e.g. `{ org_info: { org_name: 'Fleet' } }`.
 */
export async function patchAppConfig(
  request: APIRequestContext,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await request.patch(apiUrl('config'), { headers: authHeaders(), data: patch });
  if (!res.ok()) {
    throw new Error(`[patchAppConfig] ${res.status()}: ${await res.text()}`);
  }
}

/**
 * Turns script execution back on (`server_settings.scripts_disabled: false`).
 * While it is off Fleet refuses every new script run and holds every queued one,
 * so a run that died while an exclusive spec had it off would break every
 * script spec in the next run. `cleanup-setup` calls this for the same reason
 * it clears gitops mode. A no-op when it is already on, which gitops declares.
 */
export async function enableScriptExecution(request: APIRequestContext): Promise<void> {
  await patchAppConfig(request, { server_settings: { scripts_disabled: false } });
}

/** Whether scripts may run — the inverse of `server_settings.scripts_disabled`. */
export async function isScriptExecutionEnabled(request: APIRequestContext): Promise<boolean> {
  const settings = (await getAppConfig(request)).server_settings as
    | { scripts_disabled?: boolean }
    | undefined;
  return !settings?.scripts_disabled;
}
