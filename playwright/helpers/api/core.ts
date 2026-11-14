/**
 * Shared API primitives: URL versioning, auth header builders, and the
 * cross-cutting reference types reused by the domain-specific modules
 * under `helpers/api/`.
 *
 * Domain modules (hosts, fleets, software, fma, app-store, mdm,
 * activities) import from this file rather than from `@playwright/test`
 * directly so the auth contract stays in one place.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { request as apiRequest } from '@playwright/test';
// ── API versioning ───────────────────────────────────────────────────────────

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}/fleet`;
export const API_LATEST_PREFIX = '/api/latest/fleet';

/** apiUrl('fleets') → '/api/v1/fleet/fleets' */
export const apiUrl = (path: string): string =>
  `${API_PREFIX}/${path.replace(/^\//, '')}`;

/**
 * apiLatestUrl('labels') → '/api/latest/fleet/labels'. The gitops-verify specs
 * read the `/latest` channel (apiUrl is pinned to v1), so they build URLs here
 * rather than inlining the path.
 */
export const apiLatestUrl = (path: string): string =>
  `${API_LATEST_PREFIX}/${path.replace(/^\//, '')}`;

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
 * Throws unless `res` is a 2xx, saying what was asked (`what`), Fleet's status
 * and its answer.
 *
 * Every helper and spec checks a response with this, never with
 * `expect(res).toBeOK()`: when that assertion fails, Playwright prints the
 * request's headers beside it, the bearer token among them, into the job log
 * and the report. Nothing here prints a header, and the URL is cut to its
 * path so the instance's address stays out too.
 */
export async function expectOk(res: APIResponse, what: string): Promise<void> {
  if (res.ok()) return;
  const url = new URL(res.url());
  const body = await res.text().catch(() => '');
  throw new Error(`${what}: HTTP ${res.status()} from ${url.pathname}${url.search}\n${body.slice(0, 2_000)}`);
}

/**
 * One line that says why a request failed, safe for a log or a report. A
 * Playwright request error carries a call log listing the request's headers,
 * the bearer token among them: only the first line is kept, and an address is
 * cut to its path, as in {@link expectOk}.
 */
export function failureSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0].replace(/https?:\/\/[^/\s]+/g, '');
}

/**
 * Sends one delete per item, all at once, and throws after the last has
 * answered, naming every one that failed with Fleet's status and answer. A
 * sweep goes past a delete that fails instead of stopping at it, and still
 * fails: what it couldn't remove is a finding, not "nothing there". A 404 is
 * an item already gone.
 */
export async function deleteEach<T>(
  what: string,
  items: readonly T[],
  name: (item: T) => string,
  send: (item: T) => Promise<APIResponse>,
): Promise<void> {
  const failures: string[] = [];
  await Promise.all(
    items.map(async (item) => {
      try {
        const res = await send(item);
        if (res.ok() || res.status() === 404) return;
        const body = await res.text().catch(() => '');
        failures.push(`${name(item)}: HTTP ${res.status()} ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
      } catch (error) {
        failures.push(`${name(item)}: ${failureSummary(error)}`);
      }
    }),
  );
  if (failures.length) {
    throw new Error(`[${what}] ${failures.length} of ${items.length} deletes failed:\n  ${failures.join('\n  ')}`);
  }
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
