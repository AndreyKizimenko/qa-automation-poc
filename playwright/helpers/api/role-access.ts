/**
 * Role-access probe helpers. Sends a single HTTP request from a given
 * bearer-token-holding actor against a Fleet endpoint and classifies the
 * outcome as "allowed" or "denied" purely from the response status:
 *
 *   - denied  = status is 401 or 403
 *   - allowed = anything else (including 400/422 validation errors)
 *
 * Probes here are chosen so the auth check runs *before* request-body
 * validation — sending an empty body to a write endpoint produces 403
 * for an unauthorized actor and 400/422 for an authorized one, both of
 * which are meaningful without creating real resources. Endpoints that
 * validate body shape before authorization (e.g. POST /scripts,
 * POST /scripts/run) are deliberately excluded from this catalog
 * because they do not cleanly separate the two outcomes.
 */
import { APIRequestContext, expect } from '@playwright/test';
import { apiUrl } from './core';

export type ProbeMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface Probe {
  label: string;
  method: ProbeMethod;
  /** Path relative to FLEET_URL, including any query string. */
  path: string;
  /**
   * Body sent for write methods. Optional — auth runs before validation
   * for every probe in the catalog, so the body shape does not affect
   * the allow/deny outcome.
   */
  body?: unknown;
}

const AUTH_REJECT_STATUSES = new Set([401, 403]);

async function sendProbe(
  request: APIRequestContext,
  headers: Record<string, string>,
  probe: Probe,
): Promise<{ status: number }> {
  // Write probes always carry a JSON body — Fleet rejects bodyless POST/PATCH
  // with 400 "Expected JSON Body" before running auth, which would erase the
  // allow/deny signal. An empty object is enough since validation happens
  // after auth for the endpoints in this catalog.
  const data = probe.body ?? {};
  const opts = { headers, data };
  const res =
    probe.method === 'GET' ? await request.get(probe.path, { headers }) :
    probe.method === 'POST' ? await request.post(probe.path, opts) :
    probe.method === 'PATCH' ? await request.patch(probe.path, opts) :
    await request.delete(probe.path, { headers });
  return { status: res.status() };
}

export async function expectAllow(
  request: APIRequestContext,
  headers: Record<string, string>,
  probe: Probe,
): Promise<void> {
  const { status } = await sendProbe(request, headers, probe);
  expect(
    AUTH_REJECT_STATUSES.has(status),
    `Expected ${probe.label} to be allowed (status ∉ {401,403}), got ${status}`,
  ).toBe(false);
}

export async function expectDeny(
  request: APIRequestContext,
  headers: Record<string, string>,
  probe: Probe,
): Promise<void> {
  const { status } = await sendProbe(request, headers, probe);
  expect(
    AUTH_REJECT_STATUSES.has(status),
    `Expected ${probe.label} to be denied (status ∈ {401,403}), got ${status}`,
  ).toBe(true);
}

// ── Probe catalog ────────────────────────────────────────────────────────────

// Admin-only writes — denied to maintainer and below with a clean 403.
export const PROBES_ADMIN_ONLY = {
  createUser: {
    label: 'POST /users/admin (create user)',
    method: 'POST',
    path: apiUrl('users/admin'),
  },
  createFleet: {
    label: 'POST /fleets (create fleet)',
    method: 'POST',
    path: apiUrl('fleets'),
  },
} as const satisfies Record<string, Probe>;

// Maintainer-or-higher writes — denied to technician / observer_plus / observer.
export const PROBES_MAINTAINER = {
  createPolicy: {
    label: 'POST /global/policies (create global policy)',
    method: 'POST',
    path: apiUrl('global/policies'),
  },
  createReport: {
    label: 'POST /reports (create report)',
    method: 'POST',
    path: apiUrl('reports'),
  },
} as const satisfies Record<string, Probe>;

// Observer-or-higher reads — denied only to gitops.
export const PROBES_OBSERVER = {
  listHosts: {
    label: 'GET /hosts (list hosts)',
    method: 'GET',
    path: apiUrl('hosts'),
  },
  listGlobalPolicies: {
    label: 'GET /global/policies (list global policies)',
    method: 'GET',
    path: apiUrl('global/policies'),
  },
} as const satisfies Record<string, Probe>;

// GitOps marker — allowed for gitops, denied for read-only roles.
export const PROBES_GITOPS = {
  configForUpdate: {
    label: 'GET /config?for_update=true (gitops bootstrap)',
    method: 'GET',
    path: apiUrl('config?for_update=true'),
  },
} as const satisfies Record<string, Probe>;

// Fleet-scoped probes for the given fleet id. Uses the path-style endpoints
// `/fleets/{id}/policies` rather than the flat `/policies?team_id=...`, since
// only the path-style form yields a clean 403 for cross-fleet denial; the
// query-param form returns 404 from the router instead.
export function fleetScopedProbes(fleetId: number) {
  return {
    listPolicies: {
      label: `GET /fleets/${fleetId}/policies (fleet-scoped policy list)`,
      method: 'GET',
      path: apiUrl(`fleets/${fleetId}/policies`),
    } satisfies Probe,
    createPolicy: {
      label: `POST /fleets/${fleetId}/policies (fleet-scoped policy create)`,
      method: 'POST',
      path: apiUrl(`fleets/${fleetId}/policies`),
    } satisfies Probe,
  };
}
