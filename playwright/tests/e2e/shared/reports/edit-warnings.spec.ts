/**
 * Shared • Reports • what an edit warns about. A report that stores its results
 * keeps one stored answer per host, and some edits make those answers wrong, so
 * Fleet deletes them on save. The edit form asks first ("Save changes?") for
 * exactly those edits, and says why (`EditQueryForm`'s `confirmChanges`):
 *
 * | edit | prompt |
 * |---|---|
 * | description only | none: the results still answer the query |
 * | the SQL | "Changing this report's **Query** will delete its previous results…" |
 * | Store data turned off | "The changes you are making to this report will delete its previous results." |
 * | Store data turned back on | none: nothing is stored, so nothing is lost |
 *
 * Each save is read back through the API, and the details page's empty state
 * follows Store data: "not stored in Fleet" while it's off, "does not collect
 * data on a schedule" once it's back on. That the stored rows are really
 * deleted needs hosts that have answered; the server side of it
 * (`server/service/queries.go`) isn't asserted here.
 *
 * The report is reached through the list; each edit then loads the edit page
 * afresh and starts only once the form shows the report as last saved.
 * The form fills from report state that survives a client-side navigation,
 * then fills again when its own fetch of the report returns, so after clicking
 * "Edit report" a value typed in between is overwritten — the edit then saves
 * nothing, without a prompt. A fresh load starts from Fleet's defaults, so the
 * saved values appearing is the sign the fetch has landed.
 *
 * The report is seeded through the API with no interval, so no host ever runs
 * it, and deleted in an afterEach. Identical on both tiers (the same form, a
 * global report), so the spec is shared.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReport, getReport } from '@helpers/api';
import { runNonce } from '@helpers/profiles';

const SQL_PROMPT =
  "Changing this report's Query will delete its previous results, since the existing results do not reflect the updated Query.";
const GENERIC_PROMPT = 'The changes you are making to this report will delete its previous results.';

test.describe('Shared • Reports • edit warnings', () => {
  let reportId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (reportId !== undefined) await deleteReport(request, reportId);
    reportId = undefined;
  });

  test("an edit that would delete a report's stored results asks first, and one that wouldn't saves straight away", async ({
    dashboard,
    reportsList,
    reportDetails,
    reportEdit,
    request,
  }) => {
    const name = `pw-report-edit-warnings-${runNonce()}`;
    const report = await createReport(request, { name, query: 'SELECT 1;' });
    reportId = report.id;
    // Fleet guards edits only while the report stores results: Store data on
    // and snapshot logging, which is what a new report gets.
    const seeded = await getReport(request, report.id);
    expect(seeded.discardData, 'the seeded report stores its results').toBe(false);
    expect(seeded.logging).toBe('snapshot');

    await dashboard.goto();
    await dashboard.navbar.goToReports();
    await reportsList.teamDropdown.select('All fleets');
    await reportsList.searchByName(name);
    await reportsList.openReport(name);

    await expect(reportDetails.nameHeading).toHaveText(name);

    await test.step('a description-only edit saves without asking', async () => {
      await reportEdit.gotoEdit(report.id);
      await expect(reportEdit.nameInput).toHaveValue(name);
      await expect.poll(() => reportEdit.sqlText()).toBe('SELECT 1;');
      await reportEdit.descriptionInput.fill('Edited by Playwright');
      await reportEdit.saveExisting({ prompt: false });
      expect((await getReport(request, report.id)).description).toBe('Edited by Playwright');
    });

    await test.step('an SQL edit warns that the results go with the old query', async () => {
      await reportEdit.gotoEdit(report.id);
      await expect(reportEdit.descriptionInput).toHaveValue('Edited by Playwright');
      await expect.poll(() => reportEdit.sqlText()).toBe('SELECT 1;');
      await reportEdit.setSql('SELECT 2;');
      await reportEdit.saveButton.click();
      await expect(reportEdit.confirmSaveModal).toContainText(SQL_PROMPT);
      await reportEdit.confirmSaveButton.click();
      await reportEdit.toast.expectSuccess('Report updated.');
      expect((await getReport(request, report.id)).query).toBe('SELECT 2;');
    });

    await test.step('turning Store data off warns that the results are deleted', async () => {
      await reportEdit.gotoEdit(report.id);
      await expect.poll(() => reportEdit.sqlText()).toBe('SELECT 2;');
      await reportEdit.openAdvancedOptions();
      await expect(reportEdit.storeDataCheckbox).toBeChecked();
      await reportEdit.setStoreData(false);
      await reportEdit.saveButton.click();
      await expect(reportEdit.confirmSaveModal).toContainText(GENERIC_PROMPT);
      await reportEdit.confirmSaveButton.click();
      await reportEdit.toast.expectSuccess('Report updated.');

      expect((await getReport(request, report.id)).discardData).toBe(true);
      await expect(reportDetails.emptyStateHeading).toHaveText('Nothing to report');
      await expect(reportDetails.emptyStateInfo).toHaveText('Results from this report are not stored in Fleet.');
    });

    await test.step('turning Store data back on saves without asking', async () => {
      await reportEdit.gotoEdit(report.id);
      await reportEdit.openAdvancedOptions();
      await expect(reportEdit.storeDataCheckbox).not.toBeChecked();
      await reportEdit.setStoreData(true);
      await reportEdit.saveExisting({ prompt: false });

      expect((await getReport(request, report.id)).discardData).toBe(false);
      await expect(reportDetails.emptyStateInfo).toContainText('This report does not collect data on a schedule.');
    });
  });
});
