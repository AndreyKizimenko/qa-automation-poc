/**
 * Command palette • search and navigate. cmdk's filter and Fleet's Best-match
 * scoring only run in a real browser, so this spec covers what the component's
 * unit tests can't reach: which rows survive a query, which row gets promoted
 * to the top, keyword discoverability, the empty state, and where a selected
 * row actually lands. Sub-item mechanics live here too — the chevron, keyboard
 * auto-expand, and the fact that a matching sub-item surfaces while its parent
 * is collapsed.
 *
 * Tier-agnostic, hence a shared spec. Premium lands on the "All fleets" scope
 * by default, where the Controls group, "View software library" and the
 * software-add commands don't render and no row carries a fleet chip; free has
 * no fleets at all. Every row asserted here is one both tiers show in that
 * scope. Premium's fleet-scoped rows (Disk encryption, Add Fleet-maintained
 * app) belong to tests/e2e/premium/command-palette/.
 *
 * "Vulnerable software" is deliberately never selected: its destination
 * (`?vulnerable=true`) is the known QA 500 on software-titles, which the auto
 * `pageHealth` fixture would flag.
 */
import { test, expect } from '@fixtures';

// Fleet renders groups in this fixed order and skips the ones with no items,
// so the rendered headings are a subsequence of this list rather than a match.
const GROUP_ORDER = [
  'Pages',
  'Controls',
  'Software',
  'Settings',
  'MDM',
  'Automations',
  'Commands',
];

// Keywords are the discoverability surface: none of these queries appears in
// the label of the row it has to surface.
const KEYWORD_QUERIES = [
  { query: 'queries', label: 'View report' },
  { query: 'endpoints', label: 'Hosts' },
  { query: 'logout', label: 'Sign out' },
];

test.describe('Command palette • search and navigate', () => {
  test('typing a query filters the list down to the matching rows', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    const options = palette.list.getByRole('option');
    const unfilteredCount = await options.count();

    await palette.search('hosts');

    await expect(palette.item('Hosts')).toBeVisible();
    await expect(palette.item('Add hosts')).toBeVisible();
    // "Sign out" carries neither the label nor a keyword matching "hosts", so
    // its disappearance is what proves the list is filtered rather than merely
    // re-ordered.
    await expect(palette.item('Sign out')).toHaveCount(0);
    expect(await options.count()).toBeLessThan(unfilteredCount);
  });

  test('an exact label match is promoted to the first row with the typed text marked', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    await palette.search('policies');

    // Best match is an unheaded group rendered above the named ones, so the
    // promotion shows up as "Policies is the first option in the listbox".
    const firstOption = palette.list.getByRole('option').first();
    await expect(firstOption).toHaveAccessibleName('Policies');
    await expect(palette.bestMatchGroup.getByRole('option').first()).toHaveAccessibleName(
      'Policies',
    );
    // Only Best-match rows highlight the typed span, so the <mark> doubles as
    // proof the first row is the promoted copy and not the Pages one.
    await expect(firstOption.locator('mark')).toHaveText('Policies');
    // A promoted row is dropped from its own group, so it renders exactly once.
    await expect(palette.item('Policies')).toHaveCount(1);
  });

  test('a query that matches nothing renders the empty state', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    await palette.search('zzzqqqxyz');

    await expect(palette.noResults).toBeVisible();
    await expect(palette.list.getByRole('option')).toHaveCount(0);
  });

  test('keywords surface the item they belong to', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    for (const { query, label } of KEYWORD_QUERIES) {
      await test.step(`"${query}" surfaces ${label}`, async () => {
        await palette.search(query);
        await expect(palette.item(label)).toBeVisible();
      });
    }
  });

  test('a multi-token query matches regardless of token order', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    // Neither ordering is a substring of the label, so both rely on the
    // per-token scoring pass rather than cmdk's substring filter.
    for (const query of ['settings org', 'org settings']) {
      await test.step(`"${query}" surfaces Organization settings`, async () => {
        await palette.search(query);
        await expect(palette.item('Organization settings')).toBeVisible();
      });
    }
  });

  test('ArrowDown moves the highlight and Enter activates the highlighted row', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    await palette.search('smtp');

    // Two rows: the promoted "SMTP options" sub-item, then its parent. cmdk
    // highlights the first row on render, so a single ArrowDown lands on a
    // known row — the exact count is what makes that deterministic.
    const options = palette.list.getByRole('option');
    await expect(options).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await expect(palette.item('Organization settings')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.keyboard.press('Enter');

    await expect(palette.dialog).toBeHidden();
    await expect(page).toHaveURL(/\/settings\/organization/);
  });

  test('clicking a Pages row navigates and closes the palette', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    await palette.selectItem('Policies');

    await expect(page).toHaveURL(/\/policies\/manage/);
    await expect(palette.dialog).toBeHidden();
  });

  test('the expand chevron toggles sub-items without navigating', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    const urlBeforeExpanding = page.url();

    await palette.expandToggle('Organization settings').click();

    await expect(palette.item('SMTP options')).toBeVisible();
    // The chevron is a nested button inside the row: expanding must not
    // trigger the row's own select handler.
    await expect(palette.dialog).toBeVisible();
    await expect(page).toHaveURL(urlBeforeExpanding);

    await palette.expandToggle('Organization settings').click();

    await expect(palette.item('SMTP options')).toHaveCount(0);
  });

  test('arrowing onto a parent expands it and arrowing away collapses it', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    const parent = palette.item('Organization settings');
    await expect(parent).toBeVisible();

    // Auto-expand is keyboard-only, so the pointer is used purely to park the
    // highlight next to the target — the hop off and back onto the row is what
    // arrives through the keyboard.
    await parent.hover();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');

    await expect(parent).toHaveAttribute('aria-selected', 'true');
    await expect(palette.item('SMTP options')).toBeVisible();

    await page.keyboard.press('ArrowUp');

    await expect(palette.item('SMTP options')).toHaveCount(0);
  });

  test('hovering a parent does not expand it', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    const options = palette.list.getByRole('option');
    const collapsedCount = await options.count();
    const parent = palette.item('Organization settings');

    await parent.hover();

    // cmdk's selection follows the pointer, so the highlight moving is what
    // shows the hover registered — expansion is gated on the keyboard.
    await expect(parent).toHaveAttribute('aria-selected', 'true');
    await expect(options).toHaveCount(collapsedCount);
    await expect(palette.item('SMTP options')).toHaveCount(0);
  });

  test('a matching sub-item surfaces while its parent stays collapsed', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    await palette.search('smtp');

    await expect(palette.item('SMTP options')).toBeVisible();
    await expect(palette.item('Organization settings')).toBeVisible();
    // The parent's other sub-items stay hidden, so the SMTP row is a search
    // hit rather than the side effect of an expanded parent.
    await expect(palette.item('Organization info')).toHaveCount(0);
  });

  test('selecting a sub-item navigates to the sub-item path', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();
    await palette.search('smtp');

    await palette.selectItem('SMTP options');

    await expect(palette.dialog).toBeHidden();
    // The SMTP tab, not the parent's /settings/organization landing page.
    await expect(page).toHaveURL(/\/settings\/organization\/smtp/);
  });

  test('selecting Vulnerable software lands on the filtered inventory', async ({
    palette,
    dashboard,
    softwareTitles,
    page,
  }) => {
    await dashboard.goto();
    await palette.open();

    // A sub-item of "Software inventory". Searching surfaces it without
    // expanding the parent, which is how a user reaches it in practice.
    await palette.search('vulnerable software');
    await palette.selectItem('Vulnerable software');

    await expect(page).toHaveURL(/\/software\/inventory\?.*vulnerable=true/);
    // The filter travels in the URL, so the rendered list is what proves the
    // destination honoured it rather than dropping the param on mount.
    await expect(softwareTitles.filter.openButton).toBeVisible();
    await expect(softwareTitles.table.table).toBeVisible();
  });

  test('the Packs rows appear only for a packs query', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    // Packs is legacy surface, kept out of the browsable list on purpose.
    await expect(palette.item('Hosts')).toBeVisible();
    await expect(palette.item('Packs')).toHaveCount(0);
    await expect(palette.item('Add new pack')).toHaveCount(0);

    await palette.search('packs');

    await expect(palette.item('Packs')).toBeVisible();
    await expect(palette.item('Add new pack')).toBeVisible();
  });

  test('group headings render in the canonical order', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    // A rendered row proves the list built before the headings are read.
    await expect(palette.item('Hosts')).toBeVisible();

    const headings = await palette.groupNames();

    expect(headings.length).toBeGreaterThan(1);
    // Which groups render depends on tier and scope, so the assertion is that
    // the rendered set keeps Fleet's order and introduces nothing unexpected.
    expect(GROUP_ORDER.filter((group) => headings.includes(group))).toEqual(headings);
  });

  test('the palette can be reopened and used to navigate again', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();

    await palette.open();
    await palette.selectItem('Labels');
    await expect(page).toHaveURL(/\/labels\/manage/);

    // The palette is mounted by CoreLayout, so it survives the route change and
    // rebuilds its list against the page it now sits on.
    await palette.open();
    await palette.selectItem('Hosts');
    await expect(page).toHaveURL(/\/hosts\/manage/);
    await expect(palette.dialog).toBeHidden();
  });
});
