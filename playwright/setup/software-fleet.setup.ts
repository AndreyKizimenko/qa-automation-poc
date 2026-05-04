/**
 * Creates the software smoke fleet and writes its id+name to
 * `.auth/software-fleet.json` for the `softwareFleet` worker fixture.
 * Idempotent — any pre-existing fleet with the same name is deleted.
 *
 * Online hosts get transferred onto this fleet so future host-execution
 * tests have a known set of hosts. The teardown spec moves them back to
 * no-team before deleting the fleet.
 */
import { test as setup } from '@playwright/test';
import { createSmokeFleet } from './lifecycle';
import { SOFTWARE_FLEET_NAME, SOFTWARE_FLEET_STATE_PATH } from './fleet-state';

setup('create software smoke fleet', async ({ request }) => {
  await createSmokeFleet(request, SOFTWARE_FLEET_NAME, SOFTWARE_FLEET_STATE_PATH, {
    transferOnlineHosts: true,
  });
});
