/**
 * User-management API helpers. Used by specs that need to pre-create users
 * for edit/delete/search/pagination flows without paying for the UI create
 * each time, and by `setup/cleanup.steps.ts` to wipe leftover test users
 * between runs.
 *
 * All users this module creates carry an email in the form
 * `qa-test-<timestamp>-<suffix>@fleetdm.com`. The cleanup helper
 * `deleteAllQaTestUsers` only ever touches addresses that match
 * {@link QA_TEST_EMAIL_RE} — real admin users with normal emails can
 * never be deleted by this code, no matter what.
 */
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

export type UserRole =
  | 'observer'
  | 'observer_plus'
  | 'maintainer'
  | 'technician'
  | 'admin'
  | 'gitops';

export interface FleetRoleAssignment {
  id: number;
  role: UserRole;
}

export interface UserRef {
  id: number;
  name: string;
  email: string;
  global_role: UserRole | null;
  api_only: boolean;
  teams?: FleetRoleAssignment[];
  fleets?: FleetRoleAssignment[];
}

export interface CreateUserParams {
  name: string;
  email: string;
  /** Required for human users. Ignored for `api_only` users. */
  password?: string;
  /** Mutually exclusive with `fleets`. */
  global_role?: UserRole | null;
  /** Premium-only. Mutually exclusive with `global_role`. */
  fleets?: FleetRoleAssignment[];
  api_only?: boolean;
  /** Default true on Fleet; pass false to skip the first-login reset. */
  admin_forced_password_reset?: boolean;
}

export interface CreateUserResult {
  user: UserRef;
  /** Only present when `api_only: true`. */
  token?: string;
}

// ── QA email + password scheme ───────────────────────────────────────────────

/**
 * Strict regex matching emails this module is allowed to create or delete.
 * Anchored on both ends and locked to the `@fleetdm.com` domain so a
 * real user's address can't collide with it.
 */
export const QA_TEST_EMAIL_RE = /^qa-test-\d+-[a-z0-9]+@fleetdm\.com$/;

/**
 * Password used for every test user the user-management specs create.
 * Sourced from `FLEET_TEST_USER_PASSWORD` so future "can log in" specs
 * can reach the same secret. Throws at first use rather than letting
 * the API reject the create with an opaque 422.
 */
export function qaTestPassword(): string {
  const pw = process.env.FLEET_TEST_USER_PASSWORD;
  if (!pw) {
    throw new Error(
      '[users helper] FLEET_TEST_USER_PASSWORD env var is required for the User-management specs. Set it in .env.<suite> to satisfy Fleet password policy (12-48 chars, 1+ digit, 1+ symbol).',
    );
  }
  return pw;
}

/** Bulk-delete safety cap. A normal run creates a few dozen at most. */
const QA_TEST_DELETE_CAP = 200;

/**
 * Generates a unique `qa-test-<ms>-<rand>@fleetdm.com` address. Pass `slug`
 * to embed a short tag (e.g. role name) into the local-part so logs are
 * easier to scan; the slug is sanitized to `[a-z0-9]+`.
 */
export function qaTestEmail(slug?: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const tag = slug ? `${slug.toLowerCase().replace(/[^a-z0-9]+/g, '')}` : rand;
  return `qa-test-${ts}-${tag}@fleetdm.com`;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createUser(
  request: APIRequestContext,
  params: CreateUserParams,
): Promise<CreateUserResult> {
  // Default human users to the env-provided QA password so specs don't have
  // to remember to pass it. API users have no password — leave undefined.
  const data: CreateUserParams = {
    ...params,
    password: params.api_only ? undefined : (params.password ?? qaTestPassword()),
  };
  const res = await request.post(apiUrl('users/admin'), {
    headers: authHeaders(),
    data,
  });
  await expect(res, `Failed to create user "${params.email}"`).toBeOK();
  const body = await res.json();
  return { user: body.user, token: body.token };
}

export async function getUser(
  request: APIRequestContext,
  id: number,
): Promise<UserRef> {
  const res = await request.get(apiUrl(`users/${id}`), { headers: authHeaders() });
  await expect(res, `Failed to fetch user ${id}`).toBeOK();
  return (await res.json()).user;
}

export async function listUsers(
  request: APIRequestContext,
  opts: { query?: string; perPage?: number; page?: number } = {},
): Promise<UserRef[]> {
  const params: Record<string, string> = {
    per_page: String(opts.perPage ?? 500),
  };
  if (opts.query) params.query = opts.query;
  if (opts.page !== undefined) params.page = String(opts.page);

  const res = await request.get(apiUrl('users'), { headers: authHeaders(), params });
  await expect(res, 'Failed to list users').toBeOK();
  return (await res.json()).users ?? [];
}

/** Server-side `query` is fuzzy, so we filter for an exact email match. */
export async function findUserByEmail(
  request: APIRequestContext,
  email: string,
): Promise<UserRef | null> {
  const users = await listUsers(request, { query: email });
  return users.find((u) => u.email === email) ?? null;
}

export async function updateUser(
  request: APIRequestContext,
  id: number,
  patch: Partial<{
    name: string;
    email: string;
    global_role: UserRole | null;
    fleets: FleetRoleAssignment[];
    sso_enabled: boolean;
    mfa_enabled: boolean;
  }>,
): Promise<UserRef> {
  const res = await request.patch(apiUrl(`users/${id}`), {
    headers: authHeaders(),
    data: patch,
  });
  await expect(res, `Failed to update user ${id}`).toBeOK();
  return (await res.json()).user;
}

export async function deleteUser(
  request: APIRequestContext,
  id: number,
  opts: { ignoreMissing?: boolean } = {},
): Promise<void> {
  const res = await request.delete(apiUrl(`users/${id}`), { headers: authHeaders() });
  if (opts.ignoreMissing && res.status() === 404) return;
  await expect(res, `Failed to delete user ${id}`).toBeOK();
}

export async function requirePasswordReset(
  request: APIRequestContext,
  id: number,
  require = true,
): Promise<void> {
  const res = await request.post(apiUrl(`users/${id}/require_password_reset`), {
    headers: authHeaders(),
    data: { require },
  });
  await expect(res, `Failed to set password-reset flag on user ${id}`).toBeOK();
}

export async function deleteUserSessions(
  request: APIRequestContext,
  id: number,
): Promise<void> {
  const res = await request.delete(apiUrl(`users/${id}/sessions`), {
    headers: authHeaders(),
  });
  await expect(res, `Failed to delete sessions for user ${id}`).toBeOK();
}

// ── Bulk cleanup ─────────────────────────────────────────────────────────────

/**
 * Deletes every user whose email matches {@link QA_TEST_EMAIL_RE}. Other
 * users — admins, SSO users, anything with a real address — are
 * unreachable from this helper by construction.
 *
 * Safety: if more than {@link QA_TEST_DELETE_CAP} accounts match, the
 * helper throws rather than continuing. That much accumulation suggests
 * something is misconfigured and silent deletion would hide the symptom.
 */
export async function deleteAllQaTestUsers(
  request: APIRequestContext,
): Promise<{ deleted: number }> {
  const all = await listUsers(request);
  const targets = all.filter((u) => QA_TEST_EMAIL_RE.test(u.email));

  if (targets.length === 0) return { deleted: 0 };
  if (targets.length > QA_TEST_DELETE_CAP) {
    throw new Error(
      `[deleteAllQaTestUsers] Refusing to delete ${targets.length} matching users — cap is ${QA_TEST_DELETE_CAP}. Investigate before clearing.`,
    );
  }

  for (const u of targets) {
    // Individual deletes (no bulk endpoint); ignoreMissing covers a parallel
    // worker racing us to the same address.
    await deleteUser(request, u.id, { ignoreMissing: true });
  }
  return { deleted: targets.length };
}
