/**
 * Premium • Reports • Save as new. Editing a report and choosing "Save as new"
 * duplicates it: the modal pre-fills "Copy of <name>", a save creates a new
 * report, and reusing an existing name is rejected with an error toast.
 *
 * The base report is seeded via the API (global scope) and torn down — with
 * any duplicate it spawns — after each test. Grounded in
 * frontend/pages/queries/edit/components/SaveAsNewQueryModal.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching } from '@helpers/api';

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

  test.afterEach(async ({ request }) => {
    // Matches this test's base report and any "Copy of <baseName>" it spawned.
    await deleteReportsMatching(request, baseName);
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
});
