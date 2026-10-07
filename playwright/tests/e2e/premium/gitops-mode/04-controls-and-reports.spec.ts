/**
 * Gated controls on Controls and Reports, each beside the control that must
 * stay open. With gitops mode on, a page that greys out everything passes a
 * naive test, so every test here also asserts something gitops mode leaves
 * alone.
 *
 * - Disk encryption: "Enable disk encryption" reads the flag itself, with no
 *   wrapper or tip, and only Save goes through the wrapper. The checkbox would
 *   also be disabled with MDM off, so Save's wrapper is the half that fails when
 *   gitops mode stops gating this page.
 * - A profile row: Delete is gated. View, Edit and Download aren't, Edit on
 *   purpose: its modal is the only place to read a profile's targets, so the
 *   modal gates its own *Update profile* instead.
 * - Variables: *Add variable* is gated, while deleting a variable stays allowed
 *   in gitops mode.
 * - A report: Save and Save as new are gated; Live report is an operation, not
 *   config, and stays open.
 *
 * None of these wrappers names an entity, so no exception lifts them, and the
 * exceptions are left as the instance holds them: writing them would only widen
 * what a dead run can leave behind.
 *
 * Everything is on Workstations, which has no real host. A gated control is
 * asserted, never pressed.
 */
import { test, expect } from '@fixtures';
import {
  createVariable,
  deleteProfile,
  deleteVariablesMatching,
  getGitOpsMode,
  listReports,
  uploadProfile,
  withApiRequest,
  withGitOpsMode,
} from '@helpers/api';
import { inertMobileconfig, runNonce } from '@helpers/profiles';
import { expectGatedByGitOps, expectNotGatedByGitOps } from '@pages';

/**
 * A report gitops declares on Workstations in both the full and the min config,
 * so it's there whichever one the instance rests on.
 */
const GITOPS_REPORT = 'Collect default browser on macOS';

test.describe('Premium • gitops mode — Controls and Reports', () => {
  let repoUrl = '';
  let restoreGitOpsMode: (() => Promise<void>) | undefined;
  // Set only by the test that seeds each one, so a hook never deletes anything
  // another test made.
  let seededProfileUuid: string | undefined;
  let seededVariable: string | undefined;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      restoreGitOpsMode = await withGitOpsMode(request, { gitops_mode_enabled: true });
      repoUrl = (await getGitOpsMode(request)).repository_url;
    });
    expect(repoUrl, 'the instance has no gitops repository_url configured').not.toBe('');
  });

  test.afterEach(async ({ request }) => {
    if (seededProfileUuid) await deleteProfile(request, seededProfileUuid);
    seededProfileUuid = undefined;
    if (seededVariable) await deleteVariablesMatching(request, seededVariable);
    seededVariable = undefined;
  });

  test.afterAll(async () => {
    await restoreGitOpsMode?.();
  });

  test('Disk encryption — enforcement is locked and Save is gated', async ({
    diskEncryption,
    workstationsFleetId,
  }) => {
    await diskEncryption.goto({ fleetId: workstationsFleetId });

    // The form renders once the fleet's settings load; disabled on a control
    // that isn't there yet would wait for nothing.
    await expect(diskEncryption.enforceCheckbox).toBeVisible();
    await expect(diskEncryption.enforceCheckbox).toBeDisabled();
    await expectGatedByGitOps(diskEncryption.saveButton, repoUrl);
  });

  test('Configuration profiles — Add and Delete are gated, View, Edit and Download stay open', async ({
    configurationProfiles: profiles,
    request,
    workstationsFleetId,
  }) => {
    const name = `pw-gitops-${runNonce()}`;
    // Gitops mode locks the UI only, so the seed goes through the API with it on.
    seededProfileUuid = await uploadProfile(request, workstationsFleetId, inertMobileconfig(name));

    await profiles.goto({ fleetId: workstationsFleetId });
    await expectGatedByGitOps(profiles.addProfileButton, repoUrl);

    // The row's buttons render only while it's hovered, and each tooltip check
    // ends by moving the pointer away, so every check starts with a hover.
    const row = profiles.itemByName(name);
    await row.hover();
    await expectGatedByGitOps(profiles.rowButton(name, 'Delete'), repoUrl);
    for (const action of ['View', 'Edit', 'Download'] as const) {
      await row.hover();
      await expectNotGatedByGitOps(profiles.rowButton(name, action));
    }

    await profiles.openEdit(name);
    await expectGatedByGitOps(profiles.editUpdateButton, repoUrl);
    await profiles.editCancelButton.click();
    await expect(profiles.editModal).toBeHidden();
  });

  test('Variables — Add variable is gated, Delete stays open', async ({ variables, request }) => {
    seededVariable = `PW_VAR_GITOPS_${Date.now()}`;
    await createVariable(request, seededVariable, 'gitops-mode');

    await variables.goto();
    await expect(variables.variableRow(seededVariable)).toBeVisible();

    await expectGatedByGitOps(variables.addVariableButton, repoUrl);
    await expectNotGatedByGitOps(variables.deleteButton(seededVariable));
  });

  test('Reports — Save and Save as new are gated, Live report stays open', async ({
    reportEdit,
    request,
    workstationsFleetId,
  }) => {
    const report = (await listReports(request, workstationsFleetId)).find(
      (r) => r.name === GITOPS_REPORT,
    );
    expect(report, `gitops declares "${GITOPS_REPORT}" on Workstations`).toBeDefined();

    await reportEdit.gotoEdit(report!.id, { fleetId: workstationsFleetId });

    await expectGatedByGitOps(reportEdit.saveButton, repoUrl);
    await expectGatedByGitOps(reportEdit.saveAsNewButton, repoUrl);
    await expectNotGatedByGitOps(reportEdit.liveReportButton);
  });
});
