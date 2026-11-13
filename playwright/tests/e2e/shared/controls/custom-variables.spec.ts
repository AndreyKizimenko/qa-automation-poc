/**
 * Shared • Controls • custom variables. Global custom variables (secrets) can
 * be added and deleted from Controls → Variables → Global variables, and the
 * add form validates the name (uppercase letters/numbers/underscores).
 *
 * Fleet also holds scripts and variables to each other:
 *   - a script that references `$FLEET_SECRET_<NAME>` is refused until that
 *     variable exists (`ValidateEmbeddedSecrets`, a 422 the upload modal shows
 *     as a toast), and the same upload goes through once it does;
 *   - a variable a script references can't be deleted (409), the error naming
 *     the script.
 * The two checks don't cover the same ground. The upload check covers library,
 * installer and setup-experience scripts and profiles, but not pre-install
 * queries; the delete refusal scans library scripts, profiles and host-name
 * templates, but not installer or setup-experience scripts, so a variable that
 * only an installer script uses can be deleted.
 * The scripts go to Unassigned, which on free is where the real VMs are:
 * uploading a script doesn't run it.
 *
 * Variables are global and the page isn't tier-gated (only its description
 * differs), so the spec runs on both tiers. Self-contained: everything is
 * created in the test, and each test registers its variable's delete before
 * its script's, so the `cleanup` fixture, which runs them newest first,
 * deletes the script first: Fleet refuses to delete a variable a script still
 * uses, and `deleteVariablesMatching` fails on the refusal. `cleanup.steps.ts`
 * sweeps `PW_VAR_*` after a killed run.
 *
 * Grounded in frontend/pages/ManageControlsPage/Variables (GlobalVariables card
 * + AddCustomVariableModal + DeleteCustomVariableModal), ScriptUploadModal, and
 * server/datastore/mysql/secret_variables.go.
 */
import { test, expect } from '@fixtures';
import { createVariable, deleteAllScripts, deleteVariablesMatching, listVariables } from '@helpers/api';
import { ownName } from '@helpers/own-name';
import { toastCopy } from '@helpers/toast-copy';
import { runNonce } from '@helpers/profiles';

const MARKER = 'PW_VAR';

/** Unassigned: the scripts library every tier has. */
const FLEET_ID = 0;

/** A variable name of this test's own: `PW_VAR_` and a nonce, the only shape Fleet allows. */
const variableName = (): string => `${MARKER}_${runNonce().toUpperCase()}`;

test.describe('Shared • Controls • custom variables', () => {
  test('add a custom variable and delete it', async ({ variables, cleanup }) => {
    const name = variableName();
    // By its own name only: a purge by the shared marker would delete a sibling test's variable.
    cleanup.add(`delete variable ${name}`, (r) => deleteVariablesMatching(r, name));

    await variables.goto();
    await variables.openAddModal();
    await variables.fillVariable(name, 'pw-secret-value');
    await variables.saveVariable();

    const row = variables.variableRow(name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(`$FLEET_SECRET_${name}`);

    await variables.deleteVariable(name);
    await variables.toast.expectSuccess(toastCopy.variables.deleted);
    await expect(variables.variableRow(name)).toHaveCount(0);
  });

  test('the add form auto-uppercases and validates the name', async ({ variables }) => {
    const formatError = 'Name may only include uppercase letters, numbers, and underscores';

    await variables.goto();
    await variables.openAddModal();

    // The name auto-uppercases as you type.
    await variables.nameInput.fill('pw_lowercase_only');
    await expect(variables.nameInput).toHaveValue('PW_LOWERCASE_ONLY');

    // Invalid characters surface the format error and disable Save.
    await variables.nameInput.fill('bad name!');
    await expect(variables.addModal.getByText(formatError)).toBeVisible();
    await expect(variables.saveButton).toBeDisabled();

    // A valid name clears the error and re-enables Save.
    await variables.nameInput.fill('PW_VALID_NAME');
    await expect(variables.addModal.getByText(formatError)).toHaveCount(0);
    await expect(variables.saveButton).toBeEnabled();
  });

  test('a script that uses a variable is refused until the variable exists', async ({
    scriptsLibrary,
    request,
    cleanup,
  }) => {
    const name = variableName();
    const scriptName = `${ownName('secret')}.sh`;
    // Both before anything exists, the variable's first so that it runs last.
    cleanup.add(`delete variable ${name}`, (r) => deleteVariablesMatching(r, name));
    cleanup.add(`delete script ${scriptName}`, (r) => deleteAllScripts(r, FLEET_ID, (n) => n === scriptName));
    const file = {
      name: scriptName,
      mimeType: 'text/x-sh',
      buffer: Buffer.from(`#!/bin/sh\necho "token: $FLEET_SECRET_${name}"\n`),
    };

    await scriptsLibrary.goto({ fleetId: FLEET_ID });
    await scriptsLibrary.submitScriptUpload(file);
    await scriptsLibrary.toast.expectError(toastCopy.variables.missingForScript(name));
    await expect(scriptsLibrary.uploadModal).toBeVisible();

    await createVariable(request, name, 'pw-secret-value');

    // The modal kept the file, so Add script sends the same upload again.
    await scriptsLibrary.uploadConfirmButton.click();
    await scriptsLibrary.toast.expectSuccess(toastCopy.scripts.uploaded);
    await expect(scriptsLibrary.uploadModal).toBeHidden();
    await expect(scriptsLibrary.itemByName(scriptName)).toBeVisible();
  });

  test("a variable a script uses can't be deleted", async ({ variables, request, cleanup, seed }) => {
    const name = variableName();
    await createVariable(request, name, 'pw-secret-value');
    cleanup.add(`delete variable ${name}`, (r) => deleteVariablesMatching(r, name));
    const { name: scriptName } = await seed.script('secret', {
      fleetId: FLEET_ID,
      content: `#!/bin/sh\necho "token: $FLEET_SECRET_${name}"\n`,
    });

    await variables.goto();
    await variables.deleteVariable(name);
    await variables.toast.expectError(toastCopy.variables.usedByUnassignedScript(name, scriptName));
    await expect(variables.variableRow(name)).toBeVisible();
    expect((await listVariables(request)).map((v) => v.name)).toContain(name);
  });
});
