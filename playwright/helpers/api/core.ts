/**
 * Shared API primitives: URL versioning, auth header builders, and the
 * cross-cutting reference types reused by the domain-specific modules
 * under `helpers/api/`.
 *
 * Domain modules (hosts, fleets, software, fma, app-store, mdm,
 * activities) import from this file rather than from `@playwright/test`
 * directly so the auth contract stays in one place.
 */
import * as fs from 'fs';
import * as path from 'path';

// ── API versioning ───────────────────────────────────────────────────────────

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}/fleet`;

/** apiUrl('fleets') → '/api/v1/fleet/fleets' */
export const apiUrl = (path: string): string =>
  `${API_PREFIX}/${path.replace(/^\//, '')}`;

// ── Cross-cutting reference types ────────────────────────────────────────────

export interface HostRef {
  id: number;
  displayName: string;
}

export interface FleetRef {
  id: number;
  name: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function authHeaders(): { Authorization: string } {
  return { Authorization: `Bearer ${process.env.FLEET_API_TOKEN}` };
}

/**
 * Reads the admin session token from `.auth/premium-admin.json` and returns
 * it as a Bearer header. Use for endpoints that 401/403 with the static
 * `FLEET_API_TOKEN` (api-only users currently lack some perms — see
 * fleetdm/fleet#38044). Falls back to `FLEET_API_TOKEN` when the storage
 * state isn't present.
 */
let _cachedSessionToken: string | null | undefined;

export function sessionAuthHeaders(): { Authorization: string } {
  if (_cachedSessionToken === undefined) {
    try {
      const statePath = path.resolve(__dirname, '../../.auth/premium-admin.json');
      const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      const cookie = data.cookies?.find((c: { name: string }) => c.name === '__Host-token');
      _cachedSessionToken = cookie?.value ?? null;
    } catch {
      _cachedSessionToken = null;
    }
  }
  return { Authorization: `Bearer ${_cachedSessionToken ?? process.env.FLEET_API_TOKEN}` };
}

/** Returns FLEET_API_TOKEN if it's still valid, otherwise logs in fresh. */
export async function getApiToken(baseURL: string): Promise<string> {
  if (process.env.FLEET_API_TOKEN) {
    const check = await fetch(`${baseURL}${apiUrl('me')}`, {
      headers: { Authorization: `Bearer ${process.env.FLEET_API_TOKEN}` },
    });
    if (check.ok) return process.env.FLEET_API_TOKEN;
  }

  const res = await fetch(`${baseURL}${apiUrl('login')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.FLEET_ADMIN_EMAIL,
      password: process.env.FLEET_ADMIN_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return (await res.json()).token;
}
