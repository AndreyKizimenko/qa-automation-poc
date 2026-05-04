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

/** Safe to call when no package is uploaded (404 is treated as success). */
export async function deleteBootstrapPackage(
  request: APIRequestContext,
  fleetId: number,
): Promise<void> {
  const res = await request.delete(apiUrl(`bootstrap/${fleetId}`), {
    headers: authHeaders(),
  });
  if (res.status() === 404) return;
  await expect(res, `Failed to delete bootstrap for fleet ${fleetId}`).toBeOK();
}
