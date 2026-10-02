/**
 * Premium • Reports • automations. The reports-list "Manage automations" modal
 * turns a report's automations on and off again (per-report
 * `automations_enabled`, sent to the configured log destination on the report's
 * interval), and the list's Automations column reads "On", then "Off". This is
 * per-report state — not global config — so the report is seeded + torn down
 * via the API.
 *
 * Grounded in frontend/pages/queries/ManageQueriesPage + its
 * ManageQueryAutomationsModal (a checkbox per report; Save PATCHes each
 * query's automations_enabled; toast "Successfully updated report automations.").
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching, findReportById } from '@helpers/api';

const MARKER = 'pw-report-auto';

test.describe('Premium • Reports • automations', () => {
  let name: string;
  let id: number;

  test.beforeEach(async ({ request }) => {
    name = `${MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // An interval makes the list read "On" rather than "Paused" (automations on
    // but never scheduled). Daily keeps the `SELECT 1;` it schedules on the
    // hosts in scope to one run a day.
    ({ id } = await createReport(request, { name, interval: 86_400 }));
  });

  test.afterEach(async ({ request }) => {
    await deleteReportsMatching(request, name);
  });

  test("a report's automations are turned on, then off again, and the list says so", async ({
    reportsList,
    request,
  }) => {
    await reportsList.goto();
    await reportsList.teamDropdown.select('All fleets');

    await reportsList.openManageAutomations();
    await reportsList.setReportAutomation(name, true);
    await reportsList.saveAutomations();
    await reportsList.toast.expectSuccess('Successfully updated report automations.');

    const report = await findReportById(request, id);
    expect(report?.automations_enabled).toBe(true);

    // The list's Automations column reads the stored state.
    await reportsList.search.fill(name);
    await expect(reportsList.automationsCell(name)).toHaveText('On');

    await reportsList.openManageAutomations();
    await expect(reportsList.reportAutomationCheckbox(name)).toBeChecked();
    await reportsList.setReportAutomation(name, false);
    await reportsList.saveAutomations();
    await reportsList.toast.expectSuccess('Successfully updated report automations.');

    expect((await findReportById(request, id))?.automations_enabled).toBe(false);
    await expect(reportsList.automationsCell(name)).toHaveText('Off');
  });
});
