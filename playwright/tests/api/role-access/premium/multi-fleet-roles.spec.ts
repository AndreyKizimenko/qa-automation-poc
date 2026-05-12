/**
 * Premium • API multi-fleet user (Maintainer on Workstations, Observer on
 * QA). Confirms that per-fleet roles compose correctly: writes are
 * allowed where the user is Maintainer and only reads where the user is
 * Observer, with no cross-team escalation.
 */
import { test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  fleetScopedProbes,
  PROBES_ADMIN_ONLY,
  staticUserBearerHeaders,
} from '@helpers/api';

test.describe('Premium • API multi-fleet role composition', () => {
  test('Maintainer on Workstations + Observer on QA — writes only where Maintainer', async ({
    request,
    workstationsFleetId,
    qaFleetId,
  }) => {
    const headers = staticUserBearerHeaders('api-ws-maint-qa-obs');
    const ws = fleetScopedProbes(workstationsFleetId);
    const qa = fleetScopedProbes(qaFleetId);

    // Workstations — maintainer access.
    await expectAllow(request, headers, ws.listPolicies);
    await expectAllow(request, headers, ws.createPolicy);
    // QA — observer access: can read, cannot write.
    await expectAllow(request, headers, qa.listPolicies);
    await expectDeny(request, headers, qa.createPolicy);
    // Global admin actions are still off-limits.
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
  });
});
