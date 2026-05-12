/**
 * Controls > Scripts library lifecycle on premium. Runs every script case
 * (macOS, Linux, Windows) under both scopes (Unassigned + Workstations).
 * Each (scope, OS) cell is its own serial describe so a per-step failure
 * points at the broken action; a final test confirms the dashboard
 * activity feed surfaces all three lifecycle entries.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
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

      // Activity-feed scope suffix differs from the team-dropdown label:
      // Unassigned renders as "unassigned", Workstations as "the Workstations fleet".
      const addedSuffix = scope === 'Unassigned' ? 'unassigned' : `the ${scope} fleet`;
      const editedSuffix = addedSuffix;
      const deletedSuffix = addedSuffix;

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
        // Fleet renders script activity as "added script <name> to <scope>.",
        // "edited script <name> for <scope>.", "deleted script <name> from <scope>.".
        await dashboard.expectActivities([
          new RegExp(`added script ${script.baseName} to ${addedSuffix}\\.`),
          new RegExp(`edited script ${script.baseName} for ${editedSuffix}\\.`),
          new RegExp(`deleted script ${script.baseName} from ${deletedSuffix}\\.`),
        ]);
      });
    });
  }
}
