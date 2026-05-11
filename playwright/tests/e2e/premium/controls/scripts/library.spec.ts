/**
 * Controls > Scripts library lifecycle on premium. Runs every script case
 * (macOS, Linux, Windows) under both scopes (Unassigned + Workstations).
 * Each case: upload, preview-matches-source, edit + save through the
 * "Save changes?" modal, re-open to confirm persistence, delete.
 *
 * Filenames are scope-prefixed so parallel scope variants don't trip on
 * each other's "already exists" state.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';
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
  test.describe(`Controls • Scripts library lifecycle (${scope})`, () => {
    for (const script of SCRIPT_CASES) {
      test(`${script.os} — upload → preview → edit → confirm → delete`, async ({
        dashboard,
        controls,
        scriptsLibrary,
        request,
      }) => {
        await dashboard.goto();
        await dashboard.navbar.goToControls();
        await controls.goToScripts();
        await scriptsLibrary.teamDropdown.select(scope);

        await scriptsLibrary.deleteIfExists(script.baseName);

        await scriptsLibrary.uploadScript(script.filePath);
        await expect(scriptsLibrary.itemByName(script.baseName)).toBeVisible();
        await assertActivity(request, 'added_script', (d) => d.script_name === script.baseName);

        const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();

        await scriptsLibrary.openScript(script.baseName);
        const initialContent = await scriptsLibrary.openScriptContent();
        expect(initialContent).toBe(sourceContent);
        await scriptsLibrary.closeScript();

        const editedContent = `${sourceContent}\n${script.editAppend}\n`;
        await scriptsLibrary.editScript(script.baseName, editedContent);
        await assertActivity(request, 'updated_script', (d) => d.script_name === script.baseName);

        await scriptsLibrary.openScript(script.baseName);
        const persistedContent = await scriptsLibrary.openScriptContent();
        expect(persistedContent).toContain(script.editAppend);
        await scriptsLibrary.closeScript();

        await scriptsLibrary.deleteScript(script.baseName);
        await expect(scriptsLibrary.itemByName(script.baseName)).toBeHidden();
        await assertActivity(request, 'deleted_script', (d) => d.script_name === script.baseName);
      });
    }
  });
}
