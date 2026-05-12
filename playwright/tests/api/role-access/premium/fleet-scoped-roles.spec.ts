/**
 * Premium • API fleet-scoped role access. A user assigned to Workstations
 * only must be able to act inside Workstations and not in other fleets.
 *
 * The `workstationsFleetId` and `qaFleetId` worker fixtures from
 * `@fixtures` resolve each fleet's id once per worker. Probes are built
 * from `fleetScopedProbes(id)`.
 */
import { test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  fleetScopedProbes,
  PROBES_ADMIN_ONLY,
  PROBES_MAINTAINER,
  staticUserBearerHeaders,
} from '@helpers/api';

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
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
  });
});
