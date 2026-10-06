import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { apiUrl, authHeaders } from './core';

// ── Bootstrap package ────────────────────────────────────────────────────────

/**
 * Get bootstrap package metadata for a fleet. Returns null when no package is
 * uploaded (Fleet returns 404 in that case).
 *
 * `fleet_id=0` returns metadata for the "Unassigned" (no-team) bootstrap.
 */
export async function getBootstrapMetadata(
  request: APIRequestContext,
  fleetId: number,
): Promise<{ name: string; sha256: string; token: string } | null> {
  const res = await request.get(apiUrl(`bootstrap/${fleetId}/metadata`), {
    headers: authHeaders(),
  });
  if (res.status() === 404) return null;
  await expect(res, `Failed to get bootstrap metadata for fleet ${fleetId}`).toBeOK();
  return res.json();
}

/**
 * Safe to call when no package is uploaded (404 is treated as success) or
 * when the tier doesn't support MDM bootstrap (402 "Requires Premium" on
 * free). The cleanup pipeline runs on both tiers and there is no
 * tier-aware branching in `cleanup.steps.ts`, so the helper itself absorbs
 * the license rejection.
 */
export async function deleteBootstrapPackage(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl(`bootstrap/${fleetId}`), {
    headers: authHeaders(),
  });
  if (res.status() === 404 || res.status() === 402) return;
  await expect(res, `Failed to delete bootstrap for fleet ${fleetId}`).toBeOK();
}

/**
 * Uploads a bootstrap package to a fleet, as the Bootstrap package card's
 * uploader does. For a spec whose subject is what the package unlocks, not the
 * upload itself (`bootstrap-package.spec.ts` drives that through the UI).
 */
export async function uploadBootstrapPackage(
  request: APIRequestContext,
  fleetId: number,
  filePath: string,
): Promise<void> {
  const res = await request.post(apiUrl('bootstrap'), {
    headers: authHeaders(),
    multipart: {
      package: {
        name: path.basename(filePath),
        mimeType: 'application/octet-stream',
        buffer: fs.readFileSync(filePath),
      },
      fleet_id: String(fleetId),
    },
  });
  await expect(res, `Failed to upload a bootstrap package to fleet ${fleetId}`).toBeOK();
}

// ── Setup Experience ─────────────────────────────────────────────────────────

/** The `macos_setup` settings the Users and Bootstrap package cards save. */
export interface MacosSetupSettings {
  endUserAuthentication: boolean;
  lockEndUserInfo: boolean;
  /** "Create hidden admin" (`enable_managed_local_account`). */
  managedLocalAccount: boolean;
  manualAgentInstall: boolean;
}

/**
 * A fleet's stored `mdm.macos_setup` settings: from `/config` for `fleetId` 0
 * (Unassigned), from `/teams/:id` otherwise. What a setup-experience save is
 * read back against.
 */
export async function getMacosSetupSettings(
  request: APIRequestContext,
  fleetId: number,
): Promise<MacosSetupSettings> {
  const res = await request.get(apiUrl(fleetId === 0 ? 'config' : `teams/${fleetId}`), {
    headers: authHeaders(),
  });
  await expect(res, `Failed to read fleet ${fleetId}'s setup experience`).toBeOK();
  const body = await res.json();
  const setup = (fleetId === 0 ? body.mdm : body.team?.mdm)?.macos_setup ?? {};
  return {
    endUserAuthentication: setup.enable_end_user_authentication ?? false,
    lockEndUserInfo: setup.lock_end_user_info ?? false,
    managedLocalAccount: setup.enable_managed_local_account ?? false,
    manualAgentInstall: setup.manual_agent_install ?? false,
  };
}

/**
 * `PATCH /setup_experience` for one fleet (`fleetId` 0 is Unassigned) — the
 * endpoint every setup-experience card saves through, and the only one that
 * reads `macos_manual_agent_install`. Returns the response, so a spec can assert
 * a refusal as well as a write.
 */
export async function patchSetupExperience(
  request: APIRequestContext,
  fleetId: number,
  settings: Record<string, unknown>,
): Promise<APIResponse> {
  return request.patch(apiUrl('setup_experience'), {
    headers: authHeaders(),
    data: { fleet_id: fleetId, ...settings },
  });
}

/**
 * Turns "Install Fleet's agent (fleetd) manually" off for a fleet. While it is
 * on, the fleet's Install software (macOS) and Run script cards are disabled,
 * and deleting the bootstrap package doesn't clear it. Turning it off never
 * needs a package. Silent on 402 so the shared cleanup pipeline can call it on
 * both tiers.
 */
export async function resetManualAgentInstall(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await patchSetupExperience(request, fleetId, { macos_manual_agent_install: false });
  if (res.status() === 402) return;
  if (!res.ok()) console.warn(`[manual agent install reset] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Delete the setup-experience run-script for a fleet, if one exists.
 * Used by teardown to clear any script left behind by a failed test.
 * Silent on 402 ("Requires Premium") so the shared cleanup pipeline can
 * call it on both tiers — mirrors deleteBootstrapPackage above.
 */
export async function deleteSetupExperienceScript(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl('setup_experience/script'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId) },
  });
  if (res.status() === 404 || res.status() === 402) return;
  if (!res.ok()) console.warn(`[setup-exp script cleanup] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Get metadata for the uploaded macOS EULA (shown during Apple automatic
 * enrollment). Returns null when none is uploaded (Fleet returns 404). The
 * EULA is a single global entity, so no fleet scoping.
 */
export async function getEulaMetadata(
  request: APIRequestContext,
): Promise<{ name: string; token: string } | null> {
  const res = await request.get(apiUrl('setup_experience/eula/metadata'), {
    headers: authHeaders(),
  });
  if (res.status() === 404) return null;
  await expect(res, 'Failed to get EULA metadata').toBeOK();
  return res.json();
}

/** Delete the EULA identified by `token`. 404 is treated as success. */
export async function deleteEula(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.delete(apiUrl(`setup_experience/eula/${token}`), {
    headers: authHeaders(),
  });
  if (res.status() === 404) return;
  await expect(res, `Failed to delete EULA ${token}`).toBeOK();
}

/**
 * Remove any uploaded EULA. `cleanup.steps.ts` does not wipe the EULA, so
 * specs that upload one clean up with this (as a precondition and in teardown).
 */
export async function deleteEulaIfPresent(request: APIRequestContext): Promise<void> {
  const meta = await getEulaMetadata(request);
  if (meta) await deleteEula(request, meta.token);
}

/**
 * Delete the setup-assistant (DEP) profile for a fleet, if one exists.
 * Used by teardown to clear any profile left behind by a failed test.
 * Silent on 402 ("Requires Premium") so the shared cleanup pipeline can
 * call it on both tiers — mirrors deleteBootstrapPackage above.
 */
export async function deleteSetupAssistant(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl('mdm/apple/enrollment_profile'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId) },
  });
  if (res.status() === 404 || res.status() === 402) return;
  if (!res.ok()) console.warn(`[setup-assistant cleanup] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Reset the macos_setup toggles (EUA + managed-local-account) to off for
 * a fleet. PATCH merges, so the other macos_setup fields (bootstrap,
 * setup-assistant, script, software) are untouched — those have their own
 * delete helpers above. For `fleet_id=0`, targets the global `/config`
 * endpoint; for any other id, targets `/teams/{id}`.
 * Silent on 402 ("Requires Premium") so the shared cleanup pipeline can
 * call it on both tiers — mirrors deleteBootstrapPackage above.
 */
export async function resetMacosSetupToggles(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const body = {
    mdm: {
      macos_setup: {
        enable_end_user_authentication: false,
        enable_managed_local_account: false,
      },
    },
  };
  const path = fleetId === 0 ? 'config' : `teams/${fleetId}`;
  const res = await request.patch(apiUrl(path), {
    headers: authHeaders(),
    data: body,
  });
  if (res.status() === 402) return;
  if (!res.ok()) console.warn(`[macos_setup reset] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Clear the setup-experience "install software" selection for a fleet on
 * every platform (the selection is stored per-platform). A software title
 * that's selected here can't be deleted — Fleet rejects the delete with
 * HTTP 409 "installed during new host setup" — so cleanup must clear this
 * before wiping install-software titles. Silent on 402 ("Requires Premium")
 * so the shared cleanup pipeline can call it on both tiers.
 */
export async function clearSetupExperienceSoftware(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const platforms = ['macos', 'windows', 'linux', 'ios', 'ipados', 'android'];
  for (const platform of platforms) {
    // fleet_id, platform, and the (empty) title list all go in the body —
    // matching Fleet's own UI. Passing fleet_id via the query string is
    // ignored, so a non-zero fleet would silently clear "Unassigned" instead.
    const res = await request.put(apiUrl('setup_experience/software'), {
      headers: authHeaders(),
      data: { software_title_ids: [], fleet_id: fleetId, platform },
    });
    // 402 means the tier is free — no per-platform state to clear on any of them.
    if (res.status() === 402) return;
    if (res.status() === 404) continue;
    if (!res.ok()) {
      console.warn(`[setup-exp software cleanup] fleet ${fleetId} ${platform}: HTTP ${res.status()}`);
    }
  }
}

/**
 * Replaces a fleet's setup-experience software selection for one platform, as
 * the Install software card's Save does. Returns the response, so a spec can
 * assert a refusal as well as a write.
 */
export async function setSetupExperienceSoftware(
  request: APIRequestContext,
  fleetId: number,
  platform: 'macos' | 'windows' | 'linux' | 'ios' | 'ipados' | 'android',
  titleIds: number[],
): Promise<APIResponse> {
  return request.put(apiUrl('setup_experience/software'), {
    headers: authHeaders(),
    data: { software_title_ids: titleIds, fleet_id: fleetId, platform },
  });
}

/**
 * One-shot reset of every setup-experience field a test can touch:
 * bootstrap package, setup-assistant DEP profile, setup-experience script,
 * the install-software selection, the macos_setup toggles (EUA +
 * managed-local-account) and manual agent install. Idempotent and safe to call
 * when no state is present. Intended for cleanup-setup / cleanup-teardown only —
 * test bodies still use the individual helpers for clearer per-test cleanup.
 */
export async function resetSetupExperience(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  await Promise.all([
    deleteBootstrapPackage(request, fleetId),
    deleteSetupAssistant(request, fleetId),
    deleteSetupExperienceScript(request, fleetId),
    clearSetupExperienceSoftware(request, fleetId),
    resetMacosSetupToggles(request, fleetId),
    resetManualAgentInstall(request, fleetId),
  ]);
}

/** The Apple Push Notification service certificate Fleet's Apple MDM runs on (`GET /mdm/apple`). */
export interface AppleApnsInfo {
  commonName: string;
  /** ISO timestamp. */
  renewDate: string;
}

/** Throws when Apple MDM isn't on. */
export async function getAppleApnsInfo(request: APIRequestContext): Promise<AppleApnsInfo> {
  const res = await request.get(apiUrl('mdm/apple'), { headers: authHeaders() });
  await expect(res, 'Failed to read the Apple MDM push certificate').toBeOK();
  const body = await res.json();
  return { commonName: body.common_name, renewDate: body.renew_date };
}

// ── Configuration profiles ───────────────────────────────────────────────────

/**
 * Delete every configuration profile on the given fleet. Useful as a
 * pre-test cleanup so a stale profile from a prior run can't trigger a
 * PayloadIdentifier collision on upload.
 */
export async function deleteAllConfigurationProfiles(
  request: APIRequestContext,
  fleetId: number,
  matching?: (name: string) => boolean,
): Promise<void> {
  const res = await request.get(apiUrl('configuration_profiles'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId), per_page: '200' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const profiles = (body.profiles ?? []) as Array<{ profile_uuid: string; name: string }>;
  const targets = matching ? profiles.filter((p) => matching(p.name)) : profiles;
  await Promise.all(
    targets.map((p) =>
      request
        .delete(apiUrl(`configuration_profiles/${p.profile_uuid}`), { headers: authHeaders() })
        .catch((err) => console.warn(`[profile cleanup] ${p.profile_uuid}:`, err)),
    ),
  );
}

// ── Scripts library ──────────────────────────────────────────────────────────

/**
 * Delete every script on the given fleet's library. Optional `matching`
 * predicate narrows the sweep to scripts created by tests.
 */
export async function deleteAllScripts(
  request: APIRequestContext,
  fleetId: number,
  matching?: (name: string) => boolean,
): Promise<void> {
  const res = await request.get(apiUrl('scripts'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId), per_page: '200' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const scripts = (body.scripts ?? []) as Array<{ id: number; name: string }>;
  const targets = matching ? scripts.filter((s) => matching(s.name)) : scripts;
  await Promise.all(
    targets.map((s) =>
      request
        .delete(apiUrl(`scripts/${s.id}`), { headers: authHeaders() })
        .catch((err) => console.warn(`[script cleanup] ${s.id}:`, err)),
    ),
  );
}

// ── MDM commands ─────────────────────────────────────────────────────────────

export interface HostMdmCommand {
  uuid: string;
  requestType: string;
  /** The profile a profile command is for; empty for other commands. */
  name: string;
  /** Acknowledged, Error, NotNow, Pending, … — as the device answered. */
  status: string;
  updatedAt: string;
}

/**
 * The MDM commands Fleet has sent one host, newest first, optionally of one
 * request type (`InstallProfile`, `RemoveProfile`, …). The endpoint takes the
 * host's UUID, not its id.
 */
export async function listHostMdmCommands(
  request: APIRequestContext,
  hostId: number,
  requestType?: string,
): Promise<HostMdmCommand[]> {
  const host = await request.get(apiUrl(`hosts/${hostId}`), { headers: authHeaders() });
  await expect(host, `Failed to read host ${hostId}`).toBeOK();
  const uuid = (await host.json()).host.uuid as string;
  const params: Record<string, string> = {
    host_identifier: uuid,
    per_page: '100',
    order_key: 'updated_at',
    order_direction: 'desc',
  };
  if (requestType) params.request_type = requestType;
  const res = await request.get(apiUrl('commands'), { headers: authHeaders(), params });
  await expect(res, `Failed to list host ${hostId}'s MDM commands`).toBeOK();
  const results = ((await res.json()).results ?? []) as Array<{
    command_uuid: string;
    request_type: string;
    name?: string | null;
    status: string;
    updated_at: string;
  }>;
  return results.map((c) => ({
    uuid: c.command_uuid,
    requestType: c.request_type,
    name: c.name ?? '',
    status: c.status,
    updatedAt: c.updated_at,
  }));
}
