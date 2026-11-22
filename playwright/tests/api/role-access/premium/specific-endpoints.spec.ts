/**
 * Premium • API specific-endpoints users. The `api_endpoints` field on a
 * user restricts that user's bearer token to the listed `{method, path}`
 * pairs. Endpoints outside the allow list reject with 401/403 regardless
 * of the user's underlying role.
 *
 * Two static users exercise the feature:
 *   - api-specific-endpoints-global  → Admin globally, restricted to
 *     `GET /hosts` + `GET /policies`. Even admin-level writes are
 *     denied because the endpoint isn't on the list.
 *   - api-specific-endpoints-ws  → Maintainer on Workstations, restricted
 *     to `GET /hosts` + `GET /policies`. Allow-listed reads still honor the
 *     fleet-scope filter on top.
 *
 * `GET /policies` serves every scope, the fleet named by `fleet_id` (Fleet 5),
 * so one grant covers a fleet's policies and the global ones alike; the role
 * still decides which fleets'. Fleet carries no grant over from the removed
 * `/global/policies` and `/fleets/:id/policies` routes (fleetdm/fleet#58574):
 * both users' grants were moved by hand, as `helpers/api/static-users.ts` says.
 */
import { apiTest as test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  fleetScopedProbes,
  PROBES_ADMIN_ONLY,
  PROBES_MAINTAINER,
  PROBES_OBSERVER,
  staticUserBearerHeaders,
} from '@helpers/api';

test.describe('Premium • API specific-endpoints restriction', () => {
  test('global admin restricted to GET /hosts + GET /policies', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-specific-endpoints-global');
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectAllow(request, headers, PROBES_OBSERVER.listGlobalPolicies);
    // Endpoints outside the allow list reject even though the user is admin.
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createFleet);
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
  });

  test('Workstations maintainer restricted to fleet policies stays fleet-scoped', async ({
    request,
    workstationsFleetId,
    qaFleetId,
  }) => {
    const headers = staticUserBearerHeaders('api-specific-endpoints-ws');
    const ws = fleetScopedProbes(workstationsFleetId);
    const qa = fleetScopedProbes(qaFleetId);

    // Allowed read is fleet-bound: Workstations works, QA is denied.
    await expectAllow(request, headers, ws.listPolicies);
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectDeny(request, headers, qa.listPolicies);
    // The same grant reads the global policies, which a fleet maintainer may (its fleet inherits them).
    await expectAllow(request, headers, PROBES_OBSERVER.listGlobalPolicies);
    // Endpoints off the list reject even where the role grants them on Workstations.
    await expectDeny(request, headers, ws.listReports);
    await expectDeny(request, headers, ws.createPolicy);
  });
});
