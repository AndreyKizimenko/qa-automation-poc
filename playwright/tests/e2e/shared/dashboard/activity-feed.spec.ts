/**
 * Dashboard • Activity feed filters — search by actor, filter by type and date,
 * sort by time.
 *
 * The feed is written by every spec in the run, so nothing here reads it
 * unfiltered. The test makes an actor of its own: a throwaway `qa-test-*`
 * maintainer that logs in (`user_logged_in`), creates a global report and
 * deletes it (`created_saved_query`, `deleted_saved_query`), all through the
 * API with its own token. Searching its name — the feed's search is a prefix
 * match on the actor's name or email, done by the server — then yields exactly
 * those three rows, and each filter can be asserted against them:
 *
 * - type "Added report" leaves only the create;
 * - "Yesterday" (yesterday 00:00 – 23:59:59.999, browser time) leaves nothing,
 *   so the empty state shows; "Today" brings all three back. A run that crosses
 *   local midnight between the user's actions and the filter would see them
 *   under Yesterday — vanishingly rare, and a failure would say so;
 * - "Sort by oldest" reverses newest-first.
 *
 * QA Wolf's flow walked ten pages of whatever was in the feed and picked a
 * random actor; this asserts set membership over rows the test made.
 *
 * Shared: the feed and its filters aren't tier-gated. On premium it shows only
 * with no fleet selected, so the dashboard is put on All fleets.
 *
 * Grounded in frontend/pages/DashboardPage/cards/ActivityFeed
 * (ActivityFeedFilters, ActivityTypeDropdown, `generateDateFilter`) and
 * GlobalActivityItem.
 */
import { test, expect } from '@fixtures';
import { activityCopy } from '@helpers/activity-copy';
import { apiUrl, createUser, deleteReport, deleteUser, qaTestEmail, qaTestPassword } from '@helpers/api';

test.describe('Dashboard • activity feed filters', () => {
  let userId: number | undefined;
  let reportId: number | undefined;

  test.afterEach(async ({ request }) => {
    if (reportId !== undefined) await deleteReport(request, reportId);
    if (userId !== undefined) await deleteUser(request, userId, { ignoreMissing: true });
    reportId = undefined;
    userId = undefined;
  });

  test("search, type, date and sort narrow the feed to one actor's activities", async ({
    dashboard,
    request,
    playwright,
  }) => {
    const stamp = Date.now();
    const name = `QA Feed ${stamp}`;
    const email = qaTestEmail('feed');
    const reportName = `pw-feed-${stamp}`;
    ({
      user: { id: userId },
    } = await createUser(request, { name, email, global_role: 'maintainer', admin_forced_password_reset: false }));

    // The actor's own activities, through a cookie-less context so they are
    // logged as the user rather than the suite's admin.
    const api = await playwright.request.newContext({ baseURL: process.env.FLEET_URL, ignoreHTTPSErrors: true });
    try {
      const login = await api.post(apiUrl('login'), { data: { email, password: qaTestPassword() } });
      await expect(login).toBeOK();
      const headers = { Authorization: `Bearer ${(await login.json()).token as string}` };
      const created = await api.post(apiUrl('queries'), { headers, data: { name: reportName, query: 'SELECT 1;' } });
      await expect(created).toBeOK();
      reportId = (await created.json()).query.id as number;
      await expect(await api.delete(apiUrl(`queries/id/${reportId}`), { headers })).toBeOK();
      reportId = undefined;
    } finally {
      await api.dispose();
    }

    const loggedIn = /successfully logged in/;
    const createdReport = activityCopy.report.created({ name: reportName, scope: 'All fleets' });
    const deletedReport = activityCopy.report.deleted({ name: reportName, scope: 'All fleets' });

    await dashboard.goto();
    await dashboard.teamDropdown.select('All fleets');
    await dashboard.activityFeedCard.scrollIntoViewIfNeeded();

    // Search: exactly the actor's three activities, newest first.
    await dashboard.activitySearch.fill(name);
    const rows = dashboard.activityItems;
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAccessibleName(deletedReport);
    await expect(rows.nth(1)).toHaveAccessibleName(createdReport);
    await expect(rows.nth(2)).toHaveAccessibleName(loggedIn);
    for (const row of await rows.all()) await expect(row).toHaveAccessibleName(new RegExp(`^${name} `));

    // Type: only the create.
    await dashboard.selectActivityType('Added report');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAccessibleName(createdReport);
    await dashboard.selectActivityType('All types');
    await expect(rows).toHaveCount(3);

    // Date: nothing yesterday, all three today.
    await dashboard.selectActivityDate('Yesterday');
    await expect(dashboard.activityEmptyState).toBeVisible();
    await expect(rows).toHaveCount(0);
    await dashboard.selectActivityDate('Today');
    await expect(rows).toHaveCount(3);

    // Sort: oldest first reverses the order.
    await dashboard.selectActivitySort('Sort by oldest');
    await expect(rows.nth(0)).toHaveAccessibleName(loggedIn);
    await expect(rows.nth(1)).toHaveAccessibleName(createdReport);
    await expect(rows.nth(2)).toHaveAccessibleName(deletedReport);
  });
});
