/**
 * Premium • API role-access markers for the six global roles. Each role
 * is exercised through the bearer token of its API-only static
 * counterpart from helpers/api/static-users.ts.
 */
import { test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  PROBES_ADMIN_ONLY,
  PROBES_GITOPS,
  PROBES_MAINTAINER,
  PROBES_OBSERVER,
  staticUserBearerHeaders,
} from '@helpers/api';

test.describe('Premium • API global role access', () => {
  test('global admin can hit admin-only writes and observer reads', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-admin');
    await expectAllow(request, headers, PROBES_ADMIN_ONLY.createUser);
    await expectAllow(request, headers, PROBES_ADMIN_ONLY.createFleet);
    await expectAllow(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
  });

  test('global maintainer can write policies/reports but not users or fleets', async ({
    request,
  }) => {
    const headers = staticUserBearerHeaders('api-global-maintainer');
    await expectAllow(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectAllow(request, headers, PROBES_MAINTAINER.createReport);
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createFleet);
  });

  test('global technician can read hosts but cannot author policies or reports', async ({
    request,
  }) => {
    const headers = staticUserBearerHeaders('api-global-technician');
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectDeny(request, headers, PROBES_MAINTAINER.createReport);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
  });

  test('global observer+ cannot author policies or reports', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-observer-plus');
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectDeny(request, headers, PROBES_MAINTAINER.createReport);
  });

  test('global observer can read but cannot write', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-observer');
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectAllow(request, headers, PROBES_OBSERVER.listGlobalPolicies);
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectDeny(request, headers, PROBES_MAINTAINER.createReport);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
  });

  test('global gitops can hit the for-update config and admin writes but not host reads', async ({
    request,
  }) => {
    const headers = staticUserBearerHeaders('api-global-gitops');
    await expectAllow(request, headers, PROBES_GITOPS.configForUpdate);
    await expectAllow(request, headers, PROBES_ADMIN_ONLY.createFleet);
    await expectDeny(request, headers, PROBES_OBSERVER.listHosts);
  });
});
