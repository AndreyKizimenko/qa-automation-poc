/**
 * Scripts library lifecycle. Running scripts on actual hosts is covered by
 * separate host-flow specs.
 */
import * as path from 'path';
import { test, expect } from '@fixtures';

const SCRIPT_FILE = 'fleet-test-script.sh';
const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../test-data/apple/macos/scripts',
  SCRIPT_FILE,
);

test.describe('MDM • Scripts library', () => {
  test('upload → list → delete (smoke fleet)', async ({
    dashboard,
    controls,
    scriptsLibrary,
    mdmFleet,
  }) => {
    await dashboard.goto({ fleetId: mdmFleet.id });
    await dashboard.navbar.goToControls();
    await controls.goToScripts();

    await expect(scriptsLibrary.heading).toBeVisible();

    await scriptsLibrary.deleteIfExists(SCRIPT_FILE);

    await scriptsLibrary.uploadScript(SCRIPT_PATH);
    await expect(scriptsLibrary.itemByName(SCRIPT_FILE)).toBeVisible();

    await scriptsLibrary.deleteScript(SCRIPT_FILE);
  });
});
