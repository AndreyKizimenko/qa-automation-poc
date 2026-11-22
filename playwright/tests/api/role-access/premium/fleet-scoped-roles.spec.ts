/**
 * Premium • API fleet-scoped role access. A user assigned to Workstations
 * only must be able to act inside Workstations and not in other fleets.
 *
 * The `workstationsFleetId` and `qaFleetId` worker fixtures from
 * `@fixtures` resolve each fleet's id once per worker. Probes are built
 * from `fleetScopedProbes(id)`.
 *
 * An "All fleets" policy is out of reach for a user with only fleet roles,
 * whatever the role: Fleet answers its create with 422 and says `fleet_id` is
 * required, rather than a 403 (`NewPolicy`).
 */
import { apiTest as test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  expectRefused,
  fleetScopedProbes,
  PROBES_ADMIN_ONLY,
  PROBES_MAINTAINER,
  staticUserBearerHeaders,
} from '@helpers/api';

/** Fleet's reason for refusing a fleet-roles-only user an "All fleets" policy. */
const FLEET_ROLES_ONLY = /fleet_id is required for users who only have fleet roles/;

test.describe('Premium • API fleet-scoped role access', () => {
  test('Workstations maintainer can write inside Workstations but not in QA', async ({
    request,
    workstationsFleetId,
    qaFleetId,
  }) => {
    const headers = staticUserBearerHeaders('api-ws-maintainer');
    const ws = fleetScopedProbes(workstationsFleetId);
    const qa = fleetScopedProbes(qaFleetId);

    await expectAllow(request, headers, ws.listPolicies);
    await expectAllow(request, headers, ws.createPolicy);
    await expectDeny(request, headers, qa.listPolicies);
    await expectDeny(request, headers, qa.createPolicy);
    await expectRefused(request, headers, PROBES_MAINTAINER.createPolicy, 422, FLEET_ROLES_ONLY);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createFleet);
  });

  test('Workstations observer can read inside Workstations but cannot write', async ({
    request,
    workstationsFleetId,
    qaFleetId,
  }) => {
    const headers = staticUserBearerHeaders('api-ws-observer');
    const ws = fleetScopedProbes(workstationsFleetId);
    const qa = fleetScopedProbes(qaFleetId);

    await expectAllow(request, headers, ws.listPolicies);
    await expectDeny(request, headers, ws.createPolicy);
    await expectDeny(request, headers, qa.listPolicies);
    await expectRefused(request, headers, PROBES_MAINTAINER.createPolicy, 422, FLEET_ROLES_ONLY);
  });
});
