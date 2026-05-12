/**
 * Premium • API specific-endpoints users. The `api_endpoints` field on a
 * user restricts that user's bearer token to the listed `{method, path}`
 * pairs. Endpoints outside the allow list reject with 401/403 regardless
 * of the user's underlying role.
 *
 * Two static users exercise the feature:
 *   - api-specific-endpoints-global  → Admin globally, restricted to
 *     `GET /hosts` + `GET /global/policies`. Even admin-level writes are
 *     denied because the endpoint isn't on the list.
 *   - api-specific-endpoints-ws  → Maintainer on Workstations, restricted
 *     to `GET /hosts` + `GET /fleets/:id/policies`. Allow-listed reads
 *     still honor the fleet-scope filter on top.
 */
import { test } from '@fixtures';
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
  test('global admin restricted to GET /hosts + GET /global/policies', async ({ request }) => {
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
    // Non-allow-listed endpoints reject regardless of fleet.
    await expectDeny(request, headers, PROBES_OBSERVER.listGlobalPolicies);
    await expectDeny(request, headers, ws.createPolicy);
  });
});
