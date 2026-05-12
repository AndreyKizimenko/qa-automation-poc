import { APIRequestContext, expect } from '@playwright/test';
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

// ── Setup Experience ─────────────────────────────────────────────────────────

/**
 * Delete the setup-experience run-script for a fleet, if one exists.
 * Used by teardown to clear any script left behind by a failed test.
 */
export async function deleteSetupExperienceScript(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl('setup_experience/script'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId) },
  });
  if (res.status() === 404) return;
  if (!res.ok()) console.warn(`[setup-exp script cleanup] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Delete the setup-assistant (DEP) profile for a fleet, if one exists.
 * Used by teardown to clear any profile left behind by a failed test.
 */
export async function deleteSetupAssistant(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl('mdm/apple/enrollment_profile'), {
    headers: authHeaders(),
    params: { team_id: String(fleetId) },
  });
  if (res.status() === 404) return;
  if (!res.ok()) console.warn(`[setup-assistant cleanup] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * Reset the macos_setup toggles (EUA + managed-local-account) to off for
 * a fleet. PATCH merges, so the other macos_setup fields (bootstrap,
 * setup-assistant, script, software) are untouched — those have their own
 * delete helpers above. For `fleet_id=0`, targets the global `/config`
 * endpoint; for any other id, targets `/teams/{id}`.
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
  if (!res.ok()) console.warn(`[macos_setup reset] fleet ${fleetId}: HTTP ${res.status()}`);
}

/**
 * One-shot reset of every setup-experience field a test can touch:
 * bootstrap package, setup-assistant DEP profile, setup-experience script,
 * and the macos_setup toggles (EUA + managed-local-account). Idempotent
 * and safe to call when no state is present. Intended for cleanup-setup
 * / cleanup-teardown only — test bodies still use the individual helpers
 * for clearer per-test cleanup.
 */
export async function resetSetupExperience(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  await Promise.all([
    deleteBootstrapPackage(request, fleetId),
    deleteSetupAssistant(request, fleetId),
    deleteSetupExperienceScript(request, fleetId),
    resetMacosSetupToggles(request, fleetId),
  ]);
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
