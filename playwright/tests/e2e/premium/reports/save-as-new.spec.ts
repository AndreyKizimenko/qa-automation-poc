/**
 * Premium • Reports • Save as new. Editing a report and choosing "Save as new"
 * duplicates it: the modal pre-fills "Copy of <name>", a save creates a new
 * report, and reusing an existing name is rejected with an error toast. On
 * premium the modal also has a "Fleet" field, so the copy can land in another
 * fleet: a global report copied into Workstations is listed there.
 *
 * The base report is seeded via the API (global scope) and torn down — with
 * any global duplicate it spawns — after each test. A copy in a fleet is out of
 * `deleteReportsMatching`'s reach (it lists global reports), so that test
 * deletes its copy by id; `cleanup-setup`'s Workstations step sweeps a copy a
 * dead run left, by its `Copy of playwright-saveasnew-` prefix. Grounded in
 * frontend/pages/queries/edit/components/SaveAsNewQueryModal.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReport, deleteReportsMatching, findReportByName, getReport } from '@helpers/api';

const MARKER = 'playwright-saveasnew';

test.describe('Premium • Reports • Save as new', () => {
  let baseName: string;
  let baseId: number;

  test.beforeEach(async ({ request }) => {
    // Random suffix so parallel workers never collide on the same name, and
    // so per-test cleanup below only ever touches this test's own reports.
    baseName = `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    ({ id: baseId } = await createReport(request, { name: baseName }));
  });

  let fleetCopyId: number | undefined;

  test.afterEach(async ({ request }) => {
    // Matches this test's base report and any global "Copy of <baseName>" it spawned.
    await deleteReportsMatching(request, baseName);
    if (fleetCopyId !== undefined) await deleteReport(request, fleetCopyId);
    fleetCopyId = undefined;
  });

  test('pre-fills "Copy of <name>" and creates a duplicate', async ({ reportEdit }) => {
    await reportEdit.gotoEdit(baseId);

    expect(await reportEdit.openSaveAsNew()).toBe(`Copy of ${baseName}`);
    await reportEdit.submitSaveAsNew();

    await reportEdit.toast.expectSuccess(`Successfully added report Copy of ${baseName}.`);
    await expect(reportEdit.page).toHaveURL(/\/reports\/\d+/);
  });

  test('rejects a name that already exists', async ({ reportEdit }) => {
    await reportEdit.gotoEdit(baseId);

    await reportEdit.openSaveAsNew();
    await reportEdit.submitSaveAsNew(baseName);

    await reportEdit.toast.expectError(`A report called "${baseName}" already exists`);
  });

  test("copies into another fleet chosen in the modal's Fleet field", async ({
    reportEdit,
    reportsList,
    request,
    workstationsFleetId,
  }) => {
    await reportEdit.gotoEdit(baseId);

    const copyName = await reportEdit.openSaveAsNew();
    // The field starts on the report's own scope.
    await expect(reportEdit.saveAsNewFleetDropdown.currentValue).toHaveText('All fleets');
    await reportEdit.saveAsNewFleetDropdown.selectByLabel('Workstations');
    await reportEdit.submitSaveAsNew();
    await reportEdit.toast.expectSuccess(`Successfully added report ${copyName}.`);
    // Fleet opens the copy; its id comes off the URL first, so the afterEach can
    // delete it whatever the checks below find.
    await expect(reportEdit.page).toHaveURL(/\/reports\/\d+/);
    fleetCopyId = Number(new URL(reportEdit.page.url()).pathname.match(/\/reports\/(\d+)/)![1]);

    expect((await getReport(request, fleetCopyId)).fleetId).toBe(workstationsFleetId);
    expect((await findReportByName(request, copyName, workstationsFleetId))?.id).toBe(fleetCopyId);

    await reportsList.goto({ fleetId: workstationsFleetId });
    await reportsList.teamDropdown.select('Workstations');
    await reportsList.searchByName(copyName);
    await expect(reportsList.table.rowWith(copyName)).toBeVisible();
  });
});
