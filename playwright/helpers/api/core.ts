/**
 * Shared API primitives: URL versioning, auth header builders, and the
 * cross-cutting reference types reused by the domain-specific modules
 * under `helpers/api/`.
 *
 * Domain modules (hosts, fleets, software, fma, app-store, mdm,
 * activities) import from this file rather than from `@playwright/test`
 * directly so the auth contract stays in one place.
 */
import type { APIRequestContext } from '@playwright/test';
import { request as apiRequest } from '@playwright/test';
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

// ── Hook-friendly request context ────────────────────────────────────────────

/**
 * Wraps a function in a short-lived `APIRequestContext` for use inside
 * `test.beforeAll` / `test.afterAll` hooks, which only receive
 * worker-scoped fixtures (the regular `request` fixture is test-scoped).
 *
 * Auth flows through Bearer-token headers from `authHeaders()`, so a
 * fresh request context with no cookies still works for every helper in
 * this module.
 *
 * @example
 *   test.beforeAll(async () => {
 *     await withApiRequest(async (request) => {
 *       const { user } = await createUser(request, ...);
 *     });
 *   });
 */
export async function withApiRequest<T>(
  fn: (request: APIRequestContext) => Promise<T>,
): Promise<T> {
  const ctx = await apiRequest.newContext({ baseURL: process.env.FLEET_URL });
  try {
    return await fn(ctx);
  } finally {
    await ctx.dispose();
  }
}
