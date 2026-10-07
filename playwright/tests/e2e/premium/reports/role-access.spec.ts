/**
 * Premium • Reports • what each role is shown. One test per role over the
 * Reports list (its header button, Manage automations, row checkboxes, an
 * inherited row), a report's details page (Edit report, Live report), the live
 * target picker's fleets, Save as new's Fleet field, and the 403 a role gets on
 * `/reports/new`. Then the three writes whose UI path is the role's own.
 *
 * The cells come from Fleet's gating, not from the QA Wolf flows they replace
 * (round 1 C4 #F3–#P30, C7 #22), whose role checks were mostly stale copy:
 *   - `ManageQueriesPage`: "Add report" for GA, GM, TA, TM; "Live report" for an
 *     observer+; neither for GO, GT, TO. Manage automations for GA and TA; row
 *     checkboxes for the roles that may edit, never on an inherited row.
 *   - `QueryDetailsPage`: Edit for GA and GM, and for TA and TM on a fleet's
 *     report but never an inherited one — with **no authorship check**, in the
 *     UI or the rego, so "a report someone else wrote" (P21, P26) is any report
 *     of the fleet. Live report for every role but a plain observer, who gets it
 *     only on a report with "Observers can run".
 *   - `SelectTargets`: a global role is offered Unassigned and every fleet, a
 *     team role only its own; a plain global observer's fleet chips are enabled
 *     only for the report's own scope (all of them for a global report).
 *   - `SaveAsNewQueryModal`: a Fleet field for a user who can save into two or
 *     more fleets; a single-fleet maintainer gets the name only.
 *   - the router sends GO, GT and TO to the 403 page on `/reports/new`.
 *
 * Team flags follow the fleet in the URL, so a team role reads Workstations and
 * every report is opened from the list, as a user would. A team role's fleet
 * report is the gitops-declared "Collect default browser on macOS" on
 * Workstations (`gitops/premium-fleetqa/fleets/workstations.yml`): it has
 * "Observers can run" on, no static user wrote it, and it's only ever read —
 * its edit page is opened for Save as new, and never saved.
 *
 * Every absence is anchored on something the same role is shown on the same
 * screen — the seeded row, Show query, an open menu's other entries — so a page
 * that never rendered can't pass as a withheld control.
 *
 * Writes: a single-fleet maintainer's Save as new (P16), which lands in its
 * fleet without a Fleet field; a global observer's live run of a report it may
 * run (F3, P12) — the UI has to send the report's id, since Fleet refuses ad-hoc
 * SQL from an observer (`campaigns.go`); and an observer+'s ad-hoc run (P18).
 * The runs target one online simulation, which always answers, picked by name in
 * the picker's host search — never All hosts or a Platforms chip. Report edits,
 * deletes, schedules and automation toggles as a role (P9, P21, P23, P26, P30,
 * C7 #22) take the admin's form and endpoints, and are cut or kept as cells.
 *
 * Reports are this spec's own, made through the API per test and deleted in an
 * `afterEach`; a Workstations report survives `cleanup-setup`, so the Save-as-new
 * copy is deleted by id and, after a dead run, by the Workstations `pw-` sweep.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import {
  createReport,
  deleteReport,
  deleteReportsMatching,
  findOnlineHost,
  findReportByName,
  getReport,
  type StaticUserKey,
} from '@helpers/api';
import { runNonce } from '@helpers/profiles';
import {
  AccessDenied,
  ReportDetailsPage,
  ReportEditPage,
  ReportLivePage,
  ReportsListPage,
} from '@pages';

/** The gitops-declared Workstations report the team-role cells read. */
const FLEET_REPORT = 'Collect default browser on macOS';

interface RoleCase {
  key: StaticUserKey;
  scope: 'All fleets' | 'Workstations';
  /** A role on a single fleet gets no fleet picker, only the fleet's name as the page title. */
  singleFleet?: boolean;
  header: 'Add report' | 'Live report' | null;
  manageAutomations: boolean;
  /** Row checkboxes and Edit report on a report of `scope`. */
  edit: boolean;
  /** Live report on a report without "Observers can run". */
  liveReport: boolean;
  /** The fleet chips the live target picker offers (enabled), and those it must not show. */
  picker?: { offered: string[]; absent: string[] };
  /** Save as new's Fleet field, for a role that may save. */
  saveAsNewFleetField?: boolean;
}

const ROLES: RoleCase[] = [
  {
    key: 'global-maintainer',
    scope: 'All fleets',
    header: 'Add report',
    manageAutomations: false,
    edit: true,
    liveReport: true,
    picker: { offered: ['Unassigned', 'Workstations', 'VMs'], absent: [] },
    saveAsNewFleetField: true,
  },
  { key: 'global-observer', scope: 'All fleets', header: null, manageAutomations: false, edit: false, liveReport: false },
  {
    key: 'global-observer-plus',
    scope: 'All fleets',
    header: 'Live report',
    manageAutomations: false,
    edit: false,
    liveReport: true,
    picker: { offered: ['Unassigned', 'Workstations', 'VMs'], absent: [] },
  },
  {
    key: 'global-technician',
    scope: 'All fleets',
    header: null,
    manageAutomations: false,
    edit: false,
    liveReport: true,
    picker: { offered: ['Unassigned', 'Workstations', 'VMs'], absent: [] },
  },
  {
    key: 'team-admin',
    scope: 'Workstations',
    header: 'Add report',
    manageAutomations: true,
    edit: true,
    liveReport: true,
    picker: { offered: ['Workstations', 'VMs'], absent: ['Unassigned', 'QA'] },
    saveAsNewFleetField: true,
  },
  {
    key: 'ws-maintainer',
    scope: 'Workstations',
    singleFleet: true,
    header: 'Add report',
    manageAutomations: false,
    edit: true,
    liveReport: true,
    picker: { offered: ['Workstations'], absent: ['Unassigned', 'VMs'] },
    saveAsNewFleetField: false,
  },
  {
    key: 'ws-observer',
    scope: 'Workstations',
    singleFleet: true,
    header: null,
    manageAutomations: false,
    edit: false,
    liveReport: false,
    // The fleet report has "Observers can run" on, and it's the observer's own fleet.
    picker: { offered: ['Workstations'], absent: ['Unassigned', 'VMs'] },
  },
];

/** Global reports by name marker and fleet copies by id, for the `afterEach`. Per worker, reset per test. */
let globalMarkers: string[] = [];
let fleetReportIds: number[] = [];
let workstationsCopyName: string | undefined;

test.afterEach(async ({ request, workstationsFleetId }) => {
  for (const marker of globalMarkers) await deleteReportsMatching(request, marker);
  for (const id of fleetReportIds) await deleteReport(request, id);
  if (workstationsCopyName) {
    // A copy saved before the test failed, whose id the test never read.
    const left = await findReportByName(request, workstationsCopyName, workstationsFleetId);
    if (left) await deleteReport(request, left.id);
  }
  globalMarkers = [];
  fleetReportIds = [];
  workstationsCopyName = undefined;
});

async function openList(page: Page, role: RoleCase, workstationsFleetId: number): Promise<ReportsListPage> {
  const list = new ReportsListPage(page);
  if (role.scope === 'All fleets') {
    await list.goto();
    await list.teamDropdown.select('All fleets');
  } else {
    await list.goto({ fleetId: workstationsFleetId });
    if (role.singleFleet) {
      await expect(list.teamDropdown.trigger).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Workstations', level: 1 })).toBeVisible();
    } else {
      await list.teamDropdown.select('Workstations');
    }
  }
  return list;
}

/** Opens `name` from the list and checks its Edit report and Live report. */
async function expectDetails(
  page: Page,
  list: ReportsListPage,
  name: string,
  expected: { edit: boolean; liveReport: boolean },
): Promise<ReportDetailsPage> {
  const details = new ReportDetailsPage(page);
  await list.openReport(name);
  await expect(details.nameHeading).toContainText(name);
  await expect(details.showQueryButton).toBeVisible();
  await expect(details.editButton).toHaveCount(expected.edit ? 1 : 0);
  await expect(details.liveReportButton).toHaveCount(expected.liveReport ? 1 : 0);
  return details;
}

test.describe('Premium • Reports • role access', () => {
  for (const role of ROLES) {
    test(`${role.key} is shown the report controls its role grants`, async ({
      browser,
      request,
      workstationsFleetId,
    }) => {
      const stamp = runNonce();
      const globalName = `pw-role-rep-${role.key}-${stamp}`;
      globalMarkers.push(globalName);
      await createReport(request, { name: globalName, interval: 3600 });
      if (role.scope === 'Workstations') {
        expect(
          await findReportByName(request, FLEET_REPORT, workstationsFleetId),
          `gitops report "${FLEET_REPORT}" is missing from Workstations — re-apply gitops/premium-fleetqa`,
        ).not.toBeNull();
      }
      const ownName = role.scope === 'Workstations' ? FLEET_REPORT : globalName;

      await withStaticUser(browser, role.key, async (page) => {
        const list = await openList(page, role, workstationsFleetId);

        const row = await list.narrowTo(ownName);
        await expect(row.getByRole('checkbox')).toHaveCount(role.edit ? 1 : 0);
        // The header is judged once the seeded row has rendered.
        await expect(list.addReportButton).toHaveCount(role.header === 'Add report' ? 1 : 0);
        await expect(list.liveReportButton).toHaveCount(role.header === 'Live report' ? 1 : 0);
        await expect(list.manageAutomationsButton).toHaveCount(role.manageAutomations ? 1 : 0);

        if (role.manageAutomations) {
          // A team admin may open its fleet's report automations (C7 #22); the
          // toggle itself is `automations.spec.ts`, as admin.
          await list.openManageAutomations();
          await expect(list.reportAutomationCheckbox(FLEET_REPORT)).toBeVisible();
          await list.page.keyboard.press('Escape');
          await expect(list.manageAutomationsModal).toBeHidden();
        }

        if (role.scope === 'Workstations') {
          // A global report seen from a fleet: tagged, never selectable, never
          // editable by a team role (P24, P25).
          const inherited = await list.narrowTo(globalName);
          await expect(inherited.getByText('Inherited', { exact: true })).toBeVisible();
          await expect(inherited.getByRole('checkbox')).toHaveCount(0);
          await expectDetails(page, list, globalName, { edit: false, liveReport: role.liveReport });
          await openList(page, role, workstationsFleetId);
          await list.narrowTo(ownName);
        }

        // The gitops report has "Observers can run" on, so every team role may
        // run it; the global one hasn't, so only the roles that run anything do.
        const liveOnOwn = role.scope === 'Workstations' ? true : role.liveReport;
        const details = await expectDetails(page, list, ownName, { edit: role.edit, liveReport: liveOnOwn });

        if (role.picker) {
          // P10, P22: which fleets the role may aim the report at.
          const live = new ReportLivePage(page);
          await details.clickLiveReport();
          await live.waitForReady();
          for (const fleet of role.picker.offered) await expect(live.targetChip(fleet)).toBeEnabled();
          for (const fleet of role.picker.absent) await expect(live.targetChip(fleet)).toHaveCount(0);
          await page.goBack();
          await expect(details.showQueryButton).toBeVisible();
        }

        if (role.saveAsNewFleetField !== undefined) {
          // P16, P25: whether Save as new asks which fleet. Cancelled: the source
          // may be a gitops report, which is never saved.
          const edit = new ReportEditPage(page);
          await details.clickEdit();
          await expect(edit.nameInput).toHaveValue(ownName);
          await edit.openSaveAsNew();
          await expect(edit.saveAsNewNameInput).toBeVisible();
          await expect(edit.saveAsNewFleetDropdown.trigger).toHaveCount(role.saveAsNewFleetField ? 1 : 0);
          await edit.saveAsNewCancelButton.click();
          await expect(edit.saveAsNewModal).toBeHidden();
        }

        if (role.header === null) {
          const fleetQuery = role.scope === 'Workstations' ? `?fleet_id=${workstationsFleetId}` : '';
          await new AccessDenied(page).expectAt(`/reports/new${fleetQuery}`);
        }
      });
    });
  }

  test('global-observer may target every scope only for a report observers can run', async ({
    browser,
    request,
    workstationsFleetId,
  }) => {
    // A plain observer's fleet chips follow the report: a global one it may run
    // offers every scope; a fleet's report offers only that fleet (P11).
    const name = `pw-role-rep-ocr-${runNonce()}`;
    globalMarkers.push(name);
    await createReport(request, { name, observerCanRun: true });

    await withStaticUser(browser, 'global-observer', async (page) => {
      const list = new ReportsListPage(page);
      const live = new ReportLivePage(page);
      await list.goto();
      await list.teamDropdown.select('All fleets');
      await list.narrowTo(name);
      const details = await expectDetails(page, list, name, { edit: false, liveReport: true });
      await details.clickLiveReport();
      await live.waitForReady();
      for (const fleet of ['Unassigned', 'Workstations', 'VMs']) await expect(live.targetChip(fleet)).toBeEnabled();

      await list.goto({ fleetId: workstationsFleetId });
      await list.teamDropdown.select('Workstations');
      await list.narrowTo(FLEET_REPORT);
      await (await expectDetails(page, list, FLEET_REPORT, { edit: false, liveReport: true })).clickLiveReport();
      await live.waitForReady();
      await expect(live.targetChip('Workstations')).toBeEnabled();
      await expect(live.targetChip('VMs')).toBeDisabled();
      await expect(live.targetChip('Unassigned')).toBeDisabled();
    });
  });

  test('ws-maintainer saves a copy of a fleet report into Workstations, with no Fleet field', async ({
    browser,
    request,
    workstationsFleetId,
  }) => {
    const copyName = `pw-role-rep-copy-${runNonce()}`;
    workstationsCopyName = copyName;

    const copyId = await withStaticUser(browser, 'ws-maintainer', async (page) => {
      const list = await openList(page, ROLES.find((r) => r.key === 'ws-maintainer')!, workstationsFleetId);
      const edit = new ReportEditPage(page);
      await list.narrowTo(FLEET_REPORT);
      await (await expectDetails(page, list, FLEET_REPORT, { edit: true, liveReport: true })).clickEdit();
      await expect(edit.nameInput).toHaveValue(FLEET_REPORT);
      await edit.openSaveAsNew();
      await expect(edit.saveAsNewFleetDropdown.trigger).toHaveCount(0);
      await edit.submitSaveAsNew(copyName);
      await edit.toast.expectSuccess(`Successfully added report ${copyName}.`);
      await expect(page).toHaveURL(/\/reports\/\d+/);
      const id = Number(new URL(page.url()).pathname.match(/\/reports\/(\d+)/)![1]);
      fleetReportIds.push(id);
      return id;
    });

    // The modal had no fleet to choose; the copy took the source report's.
    expect((await getReport(request, copyId)).fleetId).toBe(workstationsFleetId);
    expect((await findReportByName(request, copyName, workstationsFleetId))?.id).toBe(copyId);
  });

  test('global-observer runs a report observers can run, live, on one host', async ({ browser, request }) => {
    // Fleet's rest period bounds the run, not the host: give it room, so a slow
    // campaign fails on its own wait rather than on the test's timeout.
    test.setTimeout(180_000);
    const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
    expect(host, 'no online Linux simulation to target').not.toBeNull();
    const name = `pw-role-rep-run-${runNonce()}`;
    globalMarkers.push(name);
    await createReport(request, { name, query: "SELECT 'pw' AS role;", observerCanRun: true });

    await withStaticUser(browser, 'global-observer', async (page) => {
      const list = new ReportsListPage(page);
      const live = new ReportLivePage(page);
      await list.goto();
      await list.teamDropdown.select('All fleets');
      await list.narrowTo(name);
      await (await expectDetails(page, list, name, { edit: false, liveReport: true })).clickLiveReport();
      await live.waitForReady();
      await live.targetHost(host!.displayName);
      await live.run();
      await expect(live.finishedHeading).toBeVisible({ timeout: 90_000 });
      await expect(live.runSummary).toContainText('1 host targeted');
      await expect(live.runSummary).toContainText('100% responded');
    });
  });

  test('global-observer-plus runs ad-hoc SQL live, on one host', async ({ browser, request }) => {
    test.setTimeout(180_000);
    const host = await findOnlineHost(request, 'linux', { kind: 'simulated' });
    expect(host, 'no online Linux simulation to target').not.toBeNull();

    await withStaticUser(browser, 'global-observer-plus', async (page) => {
      const list = new ReportsListPage(page);
      const edit = new ReportEditPage(page);
      const live = new ReportLivePage(page);
      await list.goto();
      await list.teamDropdown.select('All fleets');
      await list.liveReportButton.click();
      await expect(page).toHaveURL(/\/reports\/new/);
      await expect(edit.editorContent).toBeVisible();
      // An observer+ may run what it writes, never save it.
      await expect(edit.saveButton).toHaveCount(0);
      await edit.clickLiveReport();
      await live.waitForReady();
      await live.targetHost(host!.displayName);
      await live.run();
      await expect(live.finishedHeading).toBeVisible({ timeout: 90_000 });
      await expect(live.runSummary).toContainText('1 host targeted');
      await expect(live.runSummary).toContainText('100% responded');
    });
  });
});
