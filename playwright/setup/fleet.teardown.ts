/**
 * Teardown for both smoke fleets created by the *.setup.ts specs.
 * Software fleet first restores its hosts to no-team (it owns them);
 * MDM fleet has no hosts and just gets deleted.
 */
import { test as teardown } from '@playwright/test';
import { teardownSmokeFleet } from './lifecycle';
import { SOFTWARE_FLEET_STATE_PATH, MDM_FLEET_STATE_PATH } from './fleet-state';

teardown('delete software smoke fleet', async ({ request }) => {
  await teardownSmokeFleet(request, SOFTWARE_FLEET_STATE_PATH, { restoreHosts: true });
});

teardown('delete mdm smoke fleet', async ({ request }) => {
  await teardownSmokeFleet(request, MDM_FLEET_STATE_PATH);
});
