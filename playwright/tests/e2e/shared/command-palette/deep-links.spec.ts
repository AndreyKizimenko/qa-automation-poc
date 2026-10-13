/**
 * Command palette • deep links. Several palette rows don't open a page but a
 * modal on one: the row's path carries a one-shot flag (`?add_hosts=1`,
 * `?manage_automations=1`, …), the destination page opens the modal when it
 * reads the flag, and then rewrites its own query string without it so a
 * reload or a shared URL doesn't reopen the modal. Each case asserts that
 * contract — the modal opens, the flag is gone — and nothing about the modal
 * itself, which its own page's specs own.
 *
 * Every destination re-checks the role and waits for its data before honouring
 * the flag, so a page that drops the flag *without* opening the modal looks
 * the same in the URL. The modal being visible is the half that proves the
 * flag was read; the URL is the half that proves it was consumed.
 *
 * Tier-agnostic, hence a shared spec: these rows render for an admin at
 * premium's default All-fleets scope and on free alike, with the same paths.
 * `Add script` and `Add custom variable` need a specific fleet on premium, so
 * they live in the premium and free deep-link specs instead.
 *
 * Two destinations refuse to open their modal when there is nothing in scope to
 * automate: the Reports and Policies pages count the global reports and
 * policies first. The `cleanup-setup` project drains both before the suite
 * runs, so those two tests seed a `pw-` report or policy and delete it in the
 * same test, and again in an `afterEach` in case the test times out.
 */
import { test, expect } from '@fixtures';
import { createPolicy, createReport, deletePolicies, deleteReport } from '@helpers/api';

test.describe('Command palette • deep links', () => {
  let seededReportId: number | undefined;
  let seededPolicyId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (seededReportId !== undefined) await deleteReport(request, seededReportId);
    if (seededPolicyId !== undefined) await deletePolicies(request, [seededPolicyId]);
    seededReportId = undefined;
    seededPolicyId = undefined;
  });

  test('Add hosts opens the Add hosts modal and drops its flag', async ({
    palette,
    dashboard,
    hostsList,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Add hosts');

    await expect(page).toHaveURL(/\/hosts\/manage/);
    await expect(hostsList.addHostsModal.modal).toBeVisible();
    await expect(page).not.toHaveURL(/add_hosts=/);
  });

  test('a reload after the Add hosts deep link does not reopen the modal', async ({
    palette,
    dashboard,
    hostsList,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Add hosts');
    await expect(hostsList.addHostsModal.modal).toBeVisible();
    await expect(page).not.toHaveURL(/add_hosts=/);

    // A cosmetic URL edit (history state only) would survive into the reload
    // and reopen the modal; the page rewrote the query, so the reload lands on
    // the plain list. Waiting for the list's own controls gives the page the
    // render in which a still-present flag would have opened the modal.
    await page.reload();
    await expect(hostsList.exportHostsButton).toBeVisible();
    await expect(hostsList.table.firstRowWithLink).toBeVisible();
    await expect(hostsList.addHostsModal.modal).toHaveCount(0);
  });

  test('Manage enroll secrets opens the enroll secrets modal and drops its flag', async ({
    palette,
    dashboard,
    hostsList,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Manage enroll secrets');

    await expect(page).toHaveURL(/\/hosts\/manage/);
    await expect(hostsList.enrollSecrets.modal).toBeVisible();
    await expect(page).not.toHaveURL(/manage_enroll_secrets=/);
  });

  test('Manage activity automations opens the dashboard automations modal and drops its flag', async ({
    palette,
    hostsList,
    dashboard,
    page,
  }) => {
    // Entered from Hosts so the jump to the Dashboard is a real navigation.
    await hostsList.goto();
    await palette.open();
    await palette.selectItem('Manage activity automations');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboard.automationsModal).toBeVisible();
    await expect(page).not.toHaveURL(/manage_automations=/);
  });

  test('Manage report automations opens the reports automations modal and drops its flag', async ({
    palette,
    dashboard,
    reportsList,
    page,
    request,
  }) => {
    const report = await createReport(request, { name: `pw-palette-deeplink-report-${Date.now()}` });
    seededReportId = report.id;

    try {
      await dashboard.goto();
      await palette.open();
      await palette.selectItem('Manage report automations');

      await expect(page).toHaveURL(/\/reports\/manage/);
      await expect(reportsList.manageAutomationsModal).toBeVisible();
      await expect(page).not.toHaveURL(/manage_automations=/);
    } finally {
      await deleteReport(request, report.id);
      seededReportId = undefined;
    }
  });

  test('Manage policy automations opens the policies automations modal and drops its flag', async ({
    palette,
    dashboard,
    policiesList,
    page,
    request,
  }) => {
    const policy = await createPolicy(request, { name: `pw-palette-deeplink-policy-${Date.now()}` });
    seededPolicyId = policy.id;

    try {
      await dashboard.goto();
      await palette.open();
      await palette.selectItem('Manage policy automations');

      await expect(page).toHaveURL(/\/policies\/manage/);
      await expect(policiesList.automationsModal).toBeVisible();
      await expect(page).not.toHaveURL(/manage_automations=/);
    } finally {
      await deletePolicies(request, [policy.id]);
      seededPolicyId = undefined;
    }
  });

  test('Manage software automations opens the software automations modal and drops its flag', async ({
    palette,
    dashboard,
    softwareTitles,
    page,
  }) => {
    // Fleet races itself here: the inventory table rewrites the page's query on
    // its first render and keeps only the params it knows, while the deep-link
    // effect waits for the software config to load before it reads the flag. If
    // the rewrite lands first, the flag is gone without the modal ever opening
    // (`SoftwareInventoryTable.tsx` `onQueryChange`, `SoftwarePage.tsx`).
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('Manage software automations');

    await expect(page).toHaveURL(/\/software\/inventory/);
    await expect(softwareTitles.manageAutomationsModal).toBeVisible();
    await expect(page).not.toHaveURL(/manage_automations=/);
  });
});
