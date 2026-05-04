/**
 * Creates the MDM smoke fleet and writes its id+name to
 * `.auth/mdm-fleet.json` for the `mdmFleet` worker fixture. Idempotent.
 *
 * Hosts are not transferred to this fleet — current MDM smokes don't
 * need real hosts, and host transfer happens on the software fleet
 * instead.
 */
import { test as setup } from '@playwright/test';
import { createSmokeFleet } from './lifecycle';
import { MDM_FLEET_NAME, MDM_FLEET_STATE_PATH } from './fleet-state';

setup('create mdm smoke fleet', async ({ request }) => {
  await createSmokeFleet(request, MDM_FLEET_NAME, MDM_FLEET_STATE_PATH);
});
