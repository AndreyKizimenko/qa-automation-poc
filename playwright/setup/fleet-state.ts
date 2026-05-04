import * as path from 'path';

/**
 * Two smoke fleets so the software product group's lifecycle tests can
 * run in parallel with MDM specs without colliding on the same titles
 * list.
 *
 * - Software fleet: hosts the library-software, scripts-library, reports,
 *   policies (orchestration) flows. Currently-online hosts get
 *   transferred onto this fleet for future host-execution tests.
 * - MDM fleet: hosts every spec under tests/smoke/mdm/. No hosts —
 *   MDM smokes don't need real hosts.
 */
export const SOFTWARE_FLEET_NAME = 'Playwright Software Smoke';
export const SOFTWARE_FLEET_STATE_PATH = path.resolve(__dirname, '../.auth/software-fleet.json');

export const MDM_FLEET_NAME = 'Playwright MDM Smoke';
export const MDM_FLEET_STATE_PATH = path.resolve(__dirname, '../.auth/mdm-fleet.json');
