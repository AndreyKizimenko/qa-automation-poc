/**
 * Premium • Reports • automations. The reports-list "Manage automations" modal
 * enables a report's automations (per-report `automations_enabled`, sent to the
 * configured log destination on the report's interval). This is per-report
 * state — not global config — so the report is seeded + torn down via the API.
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
    ({ id } = await createReport(request, { name }));
  });

  test.afterEach(async ({ request }) => {
    await deleteReportsMatching(request, name);
  });

  test("enabling a report's automations persists", async ({ reportsList, request }) => {
    await reportsList.goto();
    await reportsList.teamDropdown.select('All fleets');

    await reportsList.openManageAutomations();
    await reportsList.setReportAutomation(name, true);
    await reportsList.saveAutomations();
    await reportsList.toast.expectSuccess('Successfully updated report automations.');

    const report = await findReportById(request, id);
    expect(report?.automations_enabled).toBe(true);
  });
});
