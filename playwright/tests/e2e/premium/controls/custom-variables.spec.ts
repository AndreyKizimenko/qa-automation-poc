/**
 * Premium • Controls • custom variables. Global custom variables (secrets) can
 * be added and deleted from Controls → Variables → Global variables, and the
 * add form validates the name (uppercase letters/numbers/underscores) and
 * requires a value. Self-contained: the variable is created + deleted in-test,
 * with an API purge in afterEach as a safety net.
 *
 * Grounded in frontend/pages/ManageControlsPage/Variables (GlobalVariables card
 * + AddCustomVariableModal + DeleteCustomVariableModal).
 */
import { test, expect } from '@fixtures';
import { deleteVariablesMatching } from '@helpers/api';

const MARKER = 'PW_VAR';

test.describe('Premium • Controls • custom variables', () => {
  // Tracks a variable a test created so afterEach can purge just that one
  // (a shared-marker purge would delete a sibling test's variable mid-run).
  let createdName: string | undefined;

  test.afterEach(async ({ request }) => {
    if (createdName) await deleteVariablesMatching(request, createdName);
    createdName = undefined;
  });

  test('add a custom variable and delete it', async ({ variables }) => {
    const name = `${MARKER}_${Date.now()}`;
    createdName = name;

    await variables.goto();
    await variables.openAddModal();
    await variables.fillVariable(name, 'pw-secret-value');
    await variables.saveVariable();

    const row = variables.variableRow(name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(`$FLEET_SECRET_${name}`);

    await variables.deleteVariable(name);
    await variables.toast.expectSuccess('Variable successfully deleted.');
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
});
