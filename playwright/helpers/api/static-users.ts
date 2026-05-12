/**
 * Static-user catalog. Users in this file are pre-provisioned on each
 * Fleet instance and assumed to exist at test time — specs never create
 * or delete them. Provisioning is a one-shot manual step done against
 * the instance's REST API: `POST /users/admin` for humans (with a
 * password from `FLEET_STATIC_USER_PASSWORD`), `POST /users/api_only`
 * for API users (the response carries the bearer token, which lands in
 * `.env.<suite>` as `FLEET_STATIC_TOKEN_<KEY-UPPER>` — key with `-` →
 * `_` and uppercased).
 *
 * Emails sit outside {@link QA_TEST_EMAIL_RE} from `users.ts`, so the
 * `deleteAllQaTestUsers` cleanup never touches them. They are
 * deliberately descriptive and identical between free and premium so
 * the same spec body reads correctly under either tier.
 */
import type { UserRole } from './users';

export type SuiteTier = 'free' | 'premium';

export type StaticUserKey =
  // Shared between free + premium.
  | 'global-admin'
  | 'global-maintainer'
  | 'global-observer'
  | 'api-global-admin'
  | 'api-global-maintainer'
  | 'api-global-observer'
  // Premium-only humans.
  | 'global-observer-plus'
  | 'global-technician'
  | 'ws-maintainer'
  | 'ws-observer'
  // Premium-only API users.
  | 'api-global-observer-plus'
  | 'api-global-technician'
  | 'api-global-gitops'
  | 'api-ws-maintainer'
  | 'api-ws-observer'
  | 'api-ws-maint-qa-obs'
  | 'api-specific-endpoints-global'
  | 'api-specific-endpoints-ws';

export interface ApiEndpointRef {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
}

interface GlobalRoleSpec {
  kind: 'global';
  role: UserRole;
}
interface FleetsRoleSpec {
  kind: 'fleets';
  assignments: { fleet: string; role: UserRole }[];
}
type RoleSpec = GlobalRoleSpec | FleetsRoleSpec;

export interface StaticUserSpec {
  email: string;
  name: string;
  apiOnly: boolean;
  role: RoleSpec;
  /** Restricts the API-only user's authorization to the listed endpoints. */
  apiEndpoints?: ApiEndpointRef[];
  /** Suites where this user is expected to exist. */
  tiers: SuiteTier[];
}

// The provisioner uses the same constant — listed once here so a fleet
// rename only happens in one place.
export const WORKSTATIONS_FLEET = 'Workstations';
export const QA_FLEET = 'QA';

const FREE_AND_PREMIUM: SuiteTier[] = ['free', 'premium'];
const PREMIUM_ONLY: SuiteTier[] = ['premium'];

export const STATIC_USERS: Readonly<Record<StaticUserKey, StaticUserSpec>> = {
  // ── Global humans, shared across tiers ─────────────────────────────────────
  'global-admin': {
    email: 'global-admin@fleetdm.com',
    name: 'QA Static Global Admin',
    apiOnly: false,
    role: { kind: 'global', role: 'admin' },
    tiers: FREE_AND_PREMIUM,
  },
  'global-maintainer': {
    email: 'global-maintainer@fleetdm.com',
    name: 'QA Static Global Maintainer',
    apiOnly: false,
    role: { kind: 'global', role: 'maintainer' },
    tiers: FREE_AND_PREMIUM,
  },
  'global-observer': {
    email: 'global-observer@fleetdm.com',
    name: 'QA Static Global Observer',
    apiOnly: false,
    role: { kind: 'global', role: 'observer' },
    tiers: FREE_AND_PREMIUM,
  },

  // ── Global API users, shared across tiers ──────────────────────────────────
  'api-global-admin': {
    email: 'api-global-admin@fleetdm.com',
    name: 'QA Static API Global Admin',
    apiOnly: true,
    role: { kind: 'global', role: 'admin' },
    tiers: FREE_AND_PREMIUM,
  },
  'api-global-maintainer': {
    email: 'api-global-maintainer@fleetdm.com',
    name: 'QA Static API Global Maintainer',
    apiOnly: true,
    role: { kind: 'global', role: 'maintainer' },
    tiers: FREE_AND_PREMIUM,
  },
  'api-global-observer': {
    email: 'api-global-observer@fleetdm.com',
    name: 'QA Static API Global Observer',
    apiOnly: true,
    role: { kind: 'global', role: 'observer' },
    tiers: FREE_AND_PREMIUM,
  },

  // ── Premium-only global humans ─────────────────────────────────────────────
  'global-observer-plus': {
    email: 'global-observer-plus@fleetdm.com',
    name: 'QA Static Global Observer+',
    apiOnly: false,
    role: { kind: 'global', role: 'observer_plus' },
    tiers: PREMIUM_ONLY,
  },
  'global-technician': {
    email: 'global-technician@fleetdm.com',
    name: 'QA Static Global Technician',
    apiOnly: false,
    role: { kind: 'global', role: 'technician' },
    tiers: PREMIUM_ONLY,
  },

  // ── Premium fleet-scoped humans ────────────────────────────────────────────
  'ws-maintainer': {
    email: 'ws-maintainer@fleetdm.com',
    name: 'QA Static Workstations Maintainer',
    apiOnly: false,
    role: { kind: 'fleets', assignments: [{ fleet: WORKSTATIONS_FLEET, role: 'maintainer' }] },
    tiers: PREMIUM_ONLY,
  },
  'ws-observer': {
    email: 'ws-observer@fleetdm.com',
    name: 'QA Static Workstations Observer',
    apiOnly: false,
    role: { kind: 'fleets', assignments: [{ fleet: WORKSTATIONS_FLEET, role: 'observer' }] },
    tiers: PREMIUM_ONLY,
  },

  // ── Premium-only global API users ──────────────────────────────────────────
  'api-global-observer-plus': {
    email: 'api-global-observer-plus@fleetdm.com',
    name: 'QA Static API Global Observer+',
    apiOnly: true,
    role: { kind: 'global', role: 'observer_plus' },
    tiers: PREMIUM_ONLY,
  },
  'api-global-technician': {
    email: 'api-global-technician@fleetdm.com',
    name: 'QA Static API Global Technician',
    apiOnly: true,
    role: { kind: 'global', role: 'technician' },
    tiers: PREMIUM_ONLY,
  },
  'api-global-gitops': {
    email: 'api-global-gitops@fleetdm.com',
    name: 'QA Static API Global GitOps',
    apiOnly: true,
    role: { kind: 'global', role: 'gitops' },
    tiers: PREMIUM_ONLY,
  },

  // ── Premium fleet-scoped API users ─────────────────────────────────────────
  'api-ws-maintainer': {
    email: 'api-ws-maintainer@fleetdm.com',
    name: 'QA Static API Workstations Maintainer',
    apiOnly: true,
    role: { kind: 'fleets', assignments: [{ fleet: WORKSTATIONS_FLEET, role: 'maintainer' }] },
    tiers: PREMIUM_ONLY,
  },
  'api-ws-observer': {
    email: 'api-ws-observer@fleetdm.com',
    name: 'QA Static API Workstations Observer',
    apiOnly: true,
    role: { kind: 'fleets', assignments: [{ fleet: WORKSTATIONS_FLEET, role: 'observer' }] },
    tiers: PREMIUM_ONLY,
  },
  'api-ws-maint-qa-obs': {
    email: 'api-ws-maint-qa-obs@fleetdm.com',
    name: 'QA Static API WS Maintainer + QA Observer',
    apiOnly: true,
    role: {
      kind: 'fleets',
      assignments: [
        { fleet: WORKSTATIONS_FLEET, role: 'maintainer' },
        { fleet: QA_FLEET, role: 'observer' },
      ],
    },
    tiers: PREMIUM_ONLY,
  },

  // ── Premium specific-endpoints API users ───────────────────────────────────
  'api-specific-endpoints-global': {
    email: 'api-specific-endpoints-global@fleetdm.com',
    name: 'QA Static API Specific Endpoints (Global)',
    apiOnly: true,
    role: { kind: 'global', role: 'admin' },
    apiEndpoints: [
      { method: 'GET', path: '/api/v1/fleet/hosts' },
      { method: 'GET', path: '/api/v1/fleet/global/policies' },
    ],
    tiers: PREMIUM_ONLY,
  },
  'api-specific-endpoints-ws': {
    email: 'api-specific-endpoints-ws@fleetdm.com',
    name: 'QA Static API Specific Endpoints (Workstations)',
    apiOnly: true,
    role: { kind: 'fleets', assignments: [{ fleet: WORKSTATIONS_FLEET, role: 'maintainer' }] },
    // Path templates use `:id` placeholders to match Fleet's api_endpoints
    // catalog — concrete fleet ids are rejected by the catalog validator.
    apiEndpoints: [
      { method: 'GET', path: '/api/v1/fleet/hosts' },
      { method: 'GET', path: '/api/v1/fleet/fleets/:id/policies' },
    ],
    tiers: PREMIUM_ONLY,
  },
};

// ── Lookups ──────────────────────────────────────────────────────────────────

export function staticUser(key: StaticUserKey): StaticUserSpec {
  const spec = STATIC_USERS[key];
  if (!spec) throw new Error(`[static-users] Unknown key "${key}"`);
  return spec;
}

export function staticUsersForTier(
  tier: SuiteTier,
): { key: StaticUserKey; spec: StaticUserSpec }[] {
  return (Object.keys(STATIC_USERS) as StaticUserKey[])
    .filter((k) => STATIC_USERS[k].tiers.includes(tier))
    .map((key) => ({ key, spec: STATIC_USERS[key] }));
}

// ── Secrets ──────────────────────────────────────────────────────────────────

/** Env-var name carrying the bearer token for an API-only static user. */
export function staticTokenEnvVar(key: StaticUserKey): string {
  return `FLEET_STATIC_TOKEN_${key.replace(/-/g, '_').toUpperCase()}`;
}

export function staticUserPassword(): string {
  const pw = process.env.FLEET_STATIC_USER_PASSWORD;
  if (!pw) {
    throw new Error(
      '[static-users] FLEET_STATIC_USER_PASSWORD env var is required. Set it to the shared static-user password in .env.<suite>.',
    );
  }
  return pw;
}

export function staticUserBearerToken(key: StaticUserKey): string {
  const spec = staticUser(key);
  if (!spec.apiOnly) {
    throw new Error(`[static-users] "${key}" is a human user — no bearer token`);
  }
  const envName = staticTokenEnvVar(key);
  const token = process.env[envName];
  if (!token) {
    throw new Error(
      `[static-users] ${envName} env var is required for static user "${key}". Provision the user via POST /api/v1/fleet/users/api_only and copy the returned bearer token into .env.<suite>.`,
    );
  }
  return token;
}

export function staticUserBearerHeaders(key: StaticUserKey): { Authorization: string } {
  return { Authorization: `Bearer ${staticUserBearerToken(key)}` };
}

// ── Display strings ──────────────────────────────────────────────────────────
//
// Mirrors Fleet's `capitalizeRole` and `generateRole` / `generateTeam`
// helpers (`frontend/utilities/helpers.tsx`). Specs use these to compute
// the role + fleets text the My Account side panel should show for a
// given static user.

const ROLE_DISPLAY: Record<UserRole, string> = {
  admin: 'Admin',
  maintainer: 'Maintainer',
  observer: 'Observer',
  observer_plus: 'Observer+',
  technician: 'Technician',
  gitops: 'GitOps',
};

export function expectedRoleDisplay(spec: StaticUserSpec): string {
  if (spec.role.kind === 'global') return ROLE_DISPLAY[spec.role.role];
  const roles = spec.role.assignments.map((a) => a.role);
  if (roles.length === 1) return ROLE_DISPLAY[roles[0]];
  return roles.every((r) => r === roles[0]) ? ROLE_DISPLAY[roles[0]] : 'Various';
}

export function expectedFleetsDisplay(spec: StaticUserSpec): string {
  if (spec.role.kind === 'global') return 'Global';
  const count = spec.role.assignments.length;
  if (count === 1) return spec.role.assignments[0].fleet;
  return `${count} fleets`;
}
