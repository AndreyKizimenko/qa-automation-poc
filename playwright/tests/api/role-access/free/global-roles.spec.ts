/**
 * Free-tier API role-access markers. Verifies that the three free roles
 * (admin, maintainer, observer) hit only the endpoints their role grants
 * and are rejected from the ones above. Each role is exercised through
 * the bearer token of its API-only static counterpart.
 */
import { test } from '@fixtures';
import {
  expectAllow,
  expectDeny,
  PROBES_ADMIN_ONLY,
  PROBES_MAINTAINER,
  PROBES_OBSERVER,
  staticUserBearerHeaders,
} from '@helpers/api';

test.describe('Free • API role access', { tag: '@free' }, () => {
  test('global admin can hit admin-only writes and reads', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-admin');
    await expectAllow(request, headers, PROBES_ADMIN_ONLY.createUser);
    await expectAllow(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
  });

  test('global maintainer can write policies but not users', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-maintainer');
    await expectAllow(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectAllow(request, headers, PROBES_MAINTAINER.createReport);
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
  });

  test('global observer can read but cannot write', async ({ request }) => {
    const headers = staticUserBearerHeaders('api-global-observer');
    await expectAllow(request, headers, PROBES_OBSERVER.listHosts);
    await expectAllow(request, headers, PROBES_OBSERVER.listGlobalPolicies);
    await expectDeny(request, headers, PROBES_MAINTAINER.createPolicy);
    await expectDeny(request, headers, PROBES_ADMIN_ONLY.createUser);
  });
});
