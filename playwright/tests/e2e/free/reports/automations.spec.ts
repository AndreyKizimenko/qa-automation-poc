/**
 * Free • Reports • automations. Same per-report automations enable/persist as
 * premium (the feature exists on free); free has no team dropdown. The report
 * is seeded + torn down via the API.
 *
 * Grounded in frontend/pages/queries/ManageQueriesPage + its
 * ManageQueryAutomationsModal.
 */
import { test, expect } from '@fixtures';
import { createReport, deleteReportsMatching, findReportById } from '@helpers/api';

const MARKER = 'pw-report-auto';

test.describe('Free • Reports • automations', () => {
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

    await reportsList.openManageAutomations();
    await reportsList.setReportAutomation(name, true);
    await reportsList.saveAutomations();
    await reportsList.toast.expectSuccess('Successfully updated report automations.');

    const report = await findReportById(request, id);
    expect(report?.automations_enabled).toBe(true);
  });
});
