/**
 * Scripts library lifecycle (UI-only) for macOS, Linux, and Windows.
 *
 * Per platform: upload a marker-create script, open it to confirm the
 * preview matches the source, edit it (append a comment line), save
 * through the "Save changes?" warning modal, re-open to confirm the edit
 * persisted, then delete it. Filenames are platform-prefixed so the three
 * cases can run in parallel against the shared smoke fleet.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';

interface ScriptCase {
  os: 'macOS' | 'Linux' | 'Windows';
  fileName: string;
  filePath: string;
  /** A platform-appropriate comment line appended during the edit step. */
  editAppend: string;
}

const SCRIPT_CASES: ScriptCase[] = [
  {
    os: 'macOS',
    fileName: 'macos-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../test-data/apple/macos/scripts/macos-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Linux',
    fileName: 'linux-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../test-data/linux/scripts/linux-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Windows',
    fileName: 'windows-create-marker.ps1',
    filePath: path.resolve(
      __dirname,
      '../../../test-data/windows/scripts/windows-create-marker.ps1',
    ),
    editAppend: '# edited by playwright',
  },
];

test.describe('Software • Scripts library lifecycle', () => {
  for (const script of SCRIPT_CASES) {
    test(`${script.os} — upload → preview → edit → confirm → delete`, async ({
      dashboard,
      controls,
      scriptsLibrary,
      softwareFleet,
    }) => {
      await dashboard.goto({ fleetId: softwareFleet.id });
      await dashboard.navbar.goToControls();
      await controls.goToScripts();

      await scriptsLibrary.deleteIfExists(script.fileName);

      await scriptsLibrary.uploadScript(script.filePath);
      await expect(scriptsLibrary.itemByName(script.fileName)).toBeVisible();

      const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();

      await scriptsLibrary.openScript(script.fileName);
      const initialContent = await scriptsLibrary.openScriptContent();
      expect(initialContent).toBe(sourceContent);
      await scriptsLibrary.closeScript();

      const editedContent = `${sourceContent}\n${script.editAppend}\n`;
      await scriptsLibrary.editScript(script.fileName, editedContent);

      await scriptsLibrary.openScript(script.fileName);
      const persistedContent = await scriptsLibrary.openScriptContent();
      expect(persistedContent).toContain(script.editAppend);
      await scriptsLibrary.closeScript();

      await scriptsLibrary.deleteScript(script.fileName);
      await expect(scriptsLibrary.itemByName(script.fileName)).toBeHidden();
    });
  }
});
