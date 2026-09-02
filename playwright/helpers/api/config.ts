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
  [key: string]: unknown;
}

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
