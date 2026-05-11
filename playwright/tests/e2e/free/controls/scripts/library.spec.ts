/**
 * Controls > Scripts library lifecycle on free — no team dropdown.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@fixtures';
import { assertActivity } from '@helpers/api';

interface ScriptCase {
  os: 'macOS' | 'Linux' | 'Windows';
  fileName: string;
  filePath: string;
  editAppend: string;
}

const SCRIPT_CASES: ScriptCase[] = [
  {
    os: 'macOS',
    fileName: 'macos-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/apple/macos/scripts/macos-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Linux',
    fileName: 'linux-create-marker.sh',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/linux/scripts/linux-create-marker.sh',
    ),
    editAppend: '# edited by playwright',
  },
  {
    os: 'Windows',
    fileName: 'windows-create-marker.ps1',
    filePath: path.resolve(
      __dirname,
      '../../../../../test-data/windows/scripts/windows-create-marker.ps1',
    ),
    editAppend: '# edited by playwright',
  },
];

test.describe('Controls • Scripts library lifecycle', { tag: '@free' }, () => {
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

      await scriptsLibrary.deleteIfExists(script.fileName);

      await scriptsLibrary.uploadScript(script.filePath);
      await expect(scriptsLibrary.itemByName(script.fileName)).toBeVisible();
      await assertActivity(request, 'added_script', (d) => d.script_name === script.fileName);

      const sourceContent = fs.readFileSync(script.filePath, 'utf-8').trim();

      await scriptsLibrary.openScript(script.fileName);
      const initialContent = await scriptsLibrary.openScriptContent();
      expect(initialContent).toBe(sourceContent);
      await scriptsLibrary.closeScript();

      const editedContent = `${sourceContent}\n${script.editAppend}\n`;
      await scriptsLibrary.editScript(script.fileName, editedContent);
      await assertActivity(request, 'updated_script', (d) => d.script_name === script.fileName);

      await scriptsLibrary.openScript(script.fileName);
      const persistedContent = await scriptsLibrary.openScriptContent();
      expect(persistedContent).toContain(script.editAppend);
      await scriptsLibrary.closeScript();

      await scriptsLibrary.deleteScript(script.fileName);
      await expect(scriptsLibrary.itemByName(script.fileName)).toBeHidden();
      await assertActivity(request, 'deleted_script', (d) => d.script_name === script.fileName);
    });
  }
});
