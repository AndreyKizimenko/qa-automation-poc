/**
 * Shared • Command palette • picker sub-pages.
 *
 * The palette's `View host` / `View report` / `View policy` /
 * `View software inventory` rows swap the root list for a picker sub-page whose
 * results come from the server, not from cmdk's local filter. What Playwright
 * proves here is everything JSDOM can't: real server-side search behind the
 * 200 ms debounce, the live empty-state copy, the navigation each selection
 * performs, and the keyboard mechanics that make the sub-page feel like a page
 * (Escape and Backspace go back instead of closing).
 *
 * Every resource is resolved through the Fleet API first and then searched for
 * by that exact name. Host names on both QA instances are random osquery-perf
 * simulations and software inventories differ per instance, so nothing here may
 * be hard-coded. Reports and policies are seeded by the test that needs them:
 * the `cleanup-setup` project drains every global report and global policy
 * before the suite starts, so gitops-provisioned ones are never present at run
 * time.
 *
 * Scope: this spec runs on free and premium, and premium enters at the default
 * "All fleets" scope. `getFleetSuffix` returns an empty string for both All
 * fleets and a tier with no fleets at all, so the empty-state copy asserted
 * here carries no fleet suffix. The suffixed variants (`in Workstations`,
 * `in this fleet`) are fleet-scoped and belong to the premium spec.
 */
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '@fixtures';
import { CommandPalette } from '@pages';
import {
  apiUrl,
  authHeaders,
  createPolicy,
  createReport,
  deletePolicies,
  deleteReport,
  findOnlineHost,
} from '@helpers/api';

const ROOT_PLACEHOLDER = 'Search for a page or command...';
const HOST_PLACEHOLDER = 'Search hosts...';

/** A query no resource on either instance can match, used for the empty states. */
const JUNK_QUERY = 'zzqqxxnosuchthing';

interface NamedResource {
  id: number;
  name: string;
}

/**
 * Software titles in the global scope, optionally narrowed by `query`. Mirrors
 * the inventory picker's call: no `available_for_install` filter, ordered by
 * name, 50 per page.
 */
async function listSoftwareTitles(
  request: APIRequestContext,
  query?: string,
): Promise<Array<NamedResource & { displayName: string }>> {
  const res = await request.get(apiUrl('software/titles'), {
    headers: authHeaders(),
    params: {
      page: '0',
      per_page: '50',
      order_key: 'name',
      order_direction: 'asc',
      ...(query ? { query } : {}),
    },
  });
  await expect(res, 'failed to list software titles').toBeOK();
  const body = await res.json();
  return (
    (body.software_titles ?? []) as Array<{ id: number; name: string; display_name?: string }>
  ).map((t) => ({ id: t.id, name: t.name, displayName: t.display_name ?? '' }));
}

/**
 * The first resource whose full name the server narrows to exactly one row.
 * The picker hands the typed text straight to the API, so a name that is also
 * a prefix of a sibling's ("Slack" inside "Slack Helper") would leave the row
 * lookup ambiguous under strict mode.
 */
async function findUniquelySearchable<T extends NamedResource>(
  candidates: T[],
  search: (query: string) => Promise<NamedResource[]>,
): Promise<T | null> {
  for (const candidate of candidates) {
    const hits = await search(candidate.name);
    if (hits.length === 1 && hits[0].id === candidate.id) return candidate;
  }
  return null;
}

/** Opens the palette from the dashboard and steps into the host picker. */
async function openHostPicker(palette: CommandPalette): Promise<void> {
  await palette.open();
  await palette.selectItem('View host');
  await expect(palette.input).toHaveAttribute('placeholder', HOST_PLACEHOLDER);
}

test.describe('Command palette • pickers', () => {
  test('View host swaps the root chrome for the host sub-page', async ({ palette, dashboard }) => {
    await dashboard.goto();

    await palette.open();
    await expect(palette.input).toHaveAttribute('placeholder', ROOT_PLACEHOLDER);
    await expect(palette.backButton).toBeHidden();
    await expect(palette.escHint).toBeHidden();

    await palette.selectItem('View host');

    await expect(palette.input).toHaveAttribute('placeholder', HOST_PLACEHOLDER);
    await expect(palette.backButton).toBeVisible();
    await expect(palette.escHint).toBeVisible();
    // The fleet switcher is a root-only control; on free it never renders at
    // all, so `toBeHidden` is the assertion that holds on both tiers.
    await expect(palette.fleetSwitcher).toBeHidden();
  });

  test('searching a host name returns that host with its online status dot', async ({
    palette,
    dashboard,
    request,
  }) => {
    const host = await findOnlineHost(request, 'darwin', { kind: 'simulated' });
    expect(host, 'expected an online simulated macOS host').not.toBeNull();

    await dashboard.goto();
    await openHostPicker(palette);

    await palette.search(host!.displayName);

    // The row appearing is what absorbs the picker's 200 ms debounce plus the
    // server round-trip — no sleep is involved.
    const row = palette.row(host!.displayName);
    await expect(row).toBeVisible();
    await expect(row.getByLabel('status: online')).toBeVisible();
  });

  test('selecting a host lands on host details without a fleet_id param', async ({
    palette,
    page,
    dashboard,
    request,
  }) => {
    const host = await findOnlineHost(request, 'darwin', { kind: 'simulated' });
    expect(host, 'expected an online simulated macOS host').not.toBeNull();

    await dashboard.goto();
    await openHostPicker(palette);

    await palette.search(host!.displayName);
    const row = palette.row(host!.displayName);
    await expect(row).toBeVisible();
    await row.click();

    // Anchored at the end of the URL so a trailing `?fleet_id=` would fail:
    // the host details page reads the host's fleet from the host record, so
    // selecting a host must not switch the user's fleet context.
    await expect(page).toHaveURL(new RegExp(`/hosts/${host!.id}/details$`));
    await expect(palette.dialog).toBeHidden();
  });

  test('a junk host query shows the no-match copy while an empty query lists rows', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await openHostPicker(palette);

    // Empty input: the picker lists hosts rather than an empty state.
    await expect(palette.list.getByRole('option').first()).toBeVisible();
    await expect(palette.list.getByText('No hosts found.')).toHaveCount(0);

    await palette.search(JUNK_QUERY);

    await expect(palette.list.getByText(`No hosts match "${JUNK_QUERY}".`)).toBeVisible();
    await expect(palette.list.getByRole('option')).toHaveCount(0);
  });

  test('typing fast issues a single host search request for the final value', async ({
    palette,
    page,
    dashboard,
    request,
  }) => {
    const host = await findOnlineHost(request, 'darwin', { kind: 'simulated' });
    expect(host, 'expected an online simulated macOS host').not.toBeNull();

    await dashboard.goto();
    await palette.open();

    // Only requests carrying a `query` param count: the picker's mount fetch
    // runs with an empty debounced query and so omits the param entirely.
    const searchRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/fleet\/hosts\?/.test(url) && url.includes('query=')) searchRequests.push(url);
    });

    await palette.selectItem('View host');
    await expect(palette.input).toHaveAttribute('placeholder', HOST_PLACEHOLDER);

    // A prefix of the random simulated name — long enough for the server to
    // resolve the host, short enough that the keystrokes land well inside the
    // 200 ms debounce window.
    const prefix = host!.displayName.slice(0, 8);
    await palette.input.pressSequentially(prefix);

    // The matching row proves the debounced request has already returned, so
    // the count below is taken after the fetch rather than before it.
    await expect(palette.row(host!.displayName)).toBeVisible();
    await expect
      .poll(() => searchRequests.length, {
        message: 'expected the keystrokes to coalesce into one /hosts request',
      })
      .toBe(1);
    expect(new URL(searchRequests[0]).searchParams.get('query')).toBe(prefix);
  });

  test('View report finds a report by name and opens its details page', async ({
    palette,
    page,
    dashboard,
    request,
  }) => {
    // Global reports are drained by the `cleanup-setup` project before the
    // suite runs, so the test seeds the one it searches for and removes it
    // again in the same test.
    const report = await createReport(request, {
      name: `palette-picker-report-${Date.now()}`,
    });

    try {
      await dashboard.goto();
      await palette.open();
      await palette.selectItem('View report');
      await expect(palette.input).toHaveAttribute('placeholder', 'Search reports...');

      await palette.search(report.name);
      const row = palette.row(report.name);
      await expect(row).toBeVisible();
      await row.click();

      await expect(page).toHaveURL(new RegExp(`/reports/${report.id}$`));
      await expect(palette.dialog).toBeHidden();
    } finally {
      await deleteReport(request, report.id);
    }
  });

  test('the report picker empty state carries no fleet suffix in the default scope', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.selectItem('View report');

    await palette.search(JUNK_QUERY);

    // No trailing " in <fleet>" / " in this fleet": both All fleets (premium)
    // and a fleetless tier (free) resolve to an empty suffix.
    await expect(
      palette.list.getByText(`No reports match "${JUNK_QUERY}".`, { exact: true }),
    ).toBeVisible();
  });

  test('View policy finds a policy by name and opens its details page', async ({
    palette,
    page,
    dashboard,
    request,
  }) => {
    // The `cleanup-setup` project wipes every global policy before the suite
    // runs, so gitops-provisioned policies aren't there to search for. The
    // test seeds the policy it looks up and removes it in the same test.
    const policy = await createPolicy(request, {
      name: `palette-picker-policy-${Date.now()}`,
    });

    try {
      await dashboard.goto();
      await palette.open();
      await palette.selectItem('View policy');
      await expect(palette.input).toHaveAttribute('placeholder', 'Search policies...');

      await palette.search(policy.name);
      const row = palette.row(policy.name);
      await expect(row).toBeVisible();
      await row.click();

      await expect(page).toHaveURL(new RegExp(`/policies/${policy.id}$`));
      await expect(palette.dialog).toBeHidden();
    } finally {
      await deletePolicies(request, [policy.id]);
    }
  });

  test('View software inventory finds a title and opens its software page', async ({
    palette,
    page,
    dashboard,
    request,
  }) => {
    // Titles carrying a custom display name are skipped: the picker renders
    // the display name, so the searched name would not appear in the row.
    const titles = (await listSoftwareTitles(request)).filter((t) => t.displayName === '');
    const title = await findUniquelySearchable(titles, (query) =>
      listSoftwareTitles(request, query),
    );
    expect(title, 'expected a software title the server resolves to one row').not.toBeNull();

    await dashboard.goto();
    await palette.open();
    await palette.selectItem('View software inventory');
    await expect(palette.input).toHaveAttribute('placeholder', 'Search software inventory...');

    await palette.search(title!.name);
    const row = palette.row(title!.name);
    await expect(row).toBeVisible();
    await expect(palette.list.getByRole('option')).toHaveCount(1);
    await row.click();

    // No `fleet_id` rides along here: the palette appends it only from a
    // specific fleet, and this spec runs at All fleets (premium) or on a tier
    // with no fleets at all (free).
    await expect(page).toHaveURL(new RegExp(`/software/titles/${title!.id}$`));
    await expect(palette.dialog).toBeHidden();
  });

  test('Escape on a picker sub-page returns to the root list without closing', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await openHostPicker(palette);

    await palette.input.press('Escape');

    await expect(palette.dialog).toBeVisible();
    await expect(palette.input).toHaveAttribute('placeholder', ROOT_PLACEHOLDER);
    await expect(palette.item('View host')).toBeVisible();
    await expect(palette.backButton).toBeHidden();
  });

  test('Backspace returns to root only when the picker input is empty', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await openHostPicker(palette);

    await palette.search('abc');
    await palette.input.press('Backspace');

    // With text in the input, Backspace is an ordinary edit — the picker stays.
    await expect(palette.input).toHaveValue('ab');
    await expect(palette.input).toHaveAttribute('placeholder', HOST_PLACEHOLDER);
    await expect(palette.item('View host')).toHaveCount(0);

    await palette.search('');
    await palette.input.press('Backspace');

    await expect(palette.input).toHaveAttribute('placeholder', ROOT_PLACEHOLDER);
    await expect(palette.item('View host')).toBeVisible();
    await expect(palette.dialog).toBeVisible();
  });

  test('the Back button returns to the root list', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await openHostPicker(palette);

    await palette.backButton.click();

    await expect(palette.input).toHaveAttribute('placeholder', ROOT_PLACEHOLDER);
    await expect(palette.item('View host')).toBeVisible();
    await expect(palette.escHint).toBeHidden();
  });

  test('the sub-page transition is announced through role=status', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();

    await palette.open();
    await expect(palette.announcement).toHaveText('');

    await palette.selectItem('View host');

    // The placeholder with its trailing ellipsis stripped.
    await expect(palette.announcement).toHaveText('Search hosts');
  });
});
