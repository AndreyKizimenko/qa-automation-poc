/**
 * Controls > Scripts library lifecycle on premium. Runs every script case
 * (macOS, Linux, Windows) under both scopes (Unassigned + Workstations).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
import { activityCopy } from '@helpers/activity-copy';
import { fleetIdFor } from '@helpers/team-scope';
import type { TeamScope } from '@pages';

interface ScriptCase {
  os: 'macOS' | 'Linux' | 'Windows';
  baseName: string;
  filePath: string;
  /** A platform-appropriate comment line appended during the edit step. */
  editAppend: string;
}

const SCRIPT_CASES: ScriptCase[] = [
  {
    os: 'macOS',
    baseName: 'macos-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/apple/macos/scripts/macos-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Linux',
    baseName: 'linux-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/linux/scripts/linux-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Windows',
    baseName: 'windows-create-marker.ps1',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/windows/scripts/windows-create-marker.ps1',
    ),
    editAppend: '# edited by playwright',
  },
];

const SCOPES: readonly TeamScope[] = ['Unassigned', 'Workstations'];

for (const scope of SCOPES) {
  for (const script of SCRIPT_CASES) {
    test.describe(`Scripts library lifecycle (${scope}) — ${script.os}`, () => {
      test.describe.configure({ mode: 'serial' });

      test('upload', async ({ dashboard, controls, scriptsLibrary, request }) => {
        await dashboard.goto();
        await dashboard.navbar.goToControls();
        await controls.goToScripts();
        await scriptsLibrary.teamDropdown.select(scope);

        // Defensive: a prior failed run may have left the script behind.
        await scriptsLibrary.deleteIfExists(script.baseName);

        await scriptsLibrary.uploadScript(script.filePath);
        await expect(scriptsLibrary.itemByName(script.baseName)).toBeVisible();
        await assertActivity(request, 'added_script', (d) => d.script_name === script.baseName);

        const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();
        await scriptsLibrary.openScript(script.baseName);
        const initialContent = await scriptsLibrary.openScriptContent();
        expect(initialContent).toBe(sourceContent);
        await scriptsLibrary.closeScript();
      });

      test('download matches source', async ({ scriptsLibrary, workstationsFleetId }) => {
        await scriptsLibrary.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
        await scriptsLibrary.teamDropdown.select(scope);
        const download = await scriptsLibrary.downloadScript(script.baseName);
        const downloadedContent = fs.readFileSync(await download.path(), 'utf-8').trim();
        const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();
        expect(downloadedContent).toBe(sourceContent);
      });

      test('edit', async ({ scriptsLibrary, request, workstationsFleetId }) => {
        await scriptsLibrary.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
        await scriptsLibrary.teamDropdown.select(scope);

        const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();
        const editedContent = `${sourceContent}\n${script.editAppend}\n`;
        await scriptsLibrary.editScript(script.baseName, editedContent);
        await assertActivity(request, 'updated_script', (d) => d.script_name === script.baseName);

        await scriptsLibrary.openScript(script.baseName);
        const persistedContent = await scriptsLibrary.openScriptContent();
        expect(persistedContent).toContain(script.editAppend);
        await scriptsLibrary.closeScript();
      });

      test('delete', async ({ scriptsLibrary, request, workstationsFleetId }) => {
        await scriptsLibrary.goto({ fleetId: fleetIdFor(scope, workstationsFleetId) });
        await scriptsLibrary.teamDropdown.select(scope);
        await scriptsLibrary.deleteScript(script.baseName);
        await expect(scriptsLibrary.itemByName(script.baseName)).toBeHidden();
        await assertActivity(request, 'deleted_script', (d) => d.script_name === script.baseName);
      });

      test('activity feed shows upload → edit → delete', async ({ dashboard }) => {
        await dashboard.goto();
        await dashboard.expectActivities([
          activityCopy.script.added({ name: script.baseName, scope }),
          activityCopy.script.edited({ name: script.baseName, scope }),
          activityCopy.script.deleted({ name: script.baseName, scope }),
        ]);
      });
    });
  }
}

// Fleet caps library scripts at 500,000 characters. Generated at runtime so
// no ~500 KB junk fixture is committed. Negative path → own describe.
test.describe('Scripts library — upload validation', () => {
  test('rejects a script larger than 500,000 characters', async ({
    dashboard,
    controls,
    scriptsLibrary,
    pageHealth,
  }) => {
    // The intentional oversize rejection is a 4xx the app may log to console.
    pageHealth.disable();

    const oversizedPath = path.join(os.tmpdir(), 'playwright-oversized-script.sh');
    fs.writeFileSync(oversizedPath, `#!/bin/bash\n# ${'x'.repeat(500_001)}\n`);

    await dashboard.goto();
    await dashboard.navbar.goToControls();
    await controls.goToScripts();
    await scriptsLibrary.teamDropdown.select('Unassigned');

    await scriptsLibrary.submitScriptUpload(oversizedPath);
    await scriptsLibrary.toast.expectError(/Script is too large\. It's limited to 500,000 characters/);
  });
});
