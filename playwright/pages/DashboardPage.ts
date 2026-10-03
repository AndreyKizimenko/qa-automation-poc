import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from './components/Navbar';
import { TeamDropdown } from './components/TeamDropdown';

/**
 * /dashboard — the Fleet dashboard, with platform-specific variants:
 *   /dashboard, /dashboard/mac, /dashboard/windows, /dashboard/linux,
 *   /dashboard/chrome, /dashboard/ios, /dashboard/ipados
 *
 * Renders the "Hosts enrolled" bar chart and the historical chart card, a
 * platform filter, a row of host-count cards, a Software block, and an
 * Activity feed.
 */
type DashboardPlatform = 'mac' | 'windows' | 'linux' | 'chrome' | 'ios' | 'ipados';

/** Visible labels in the dashboard's "Platform:" filter. */
export type DashboardPlatformLabel =
  | 'All'
  | 'macOS'
  | 'Windows'
  | 'Linux'
  | 'ChromeOS'
  | 'iOS'
  | 'iPadOS'
  | 'Android';

/**
 * The route each platform label navigates to. Selecting a platform is a
 * `router.push`, so the path is the assertion that the filter took effect.
 */
const PLATFORM_PATHS: Record<DashboardPlatformLabel, string> = {
  All: '/dashboard',
  macOS: '/dashboard/mac',
  Windows: '/dashboard/windows',
  Linux: '/dashboard/linux',
  ChromeOS: '/dashboard/chrome',
  iOS: '/dashboard/ios',
  iPadOS: '/dashboard/ipados',
  Android: '/dashboard/android',
};

/**
 * Datasets offered by the historical chart card. "Vulnerability exposure" is
 * premium-only: free has a single dataset, so the card renders a heading
 * instead of the dropdown this type feeds.
 */
export type ChartDatasetLabel = 'Hosts online' | 'Vulnerability exposure';

/** The activity feed's date filter (`ActivityFeedFilters`' DATE_FILTER_OPTIONS). */
export type ActivityDateFilter =
  | 'All time'
  | 'Today'
  | 'Yesterday'
  | 'Last 7 days'
  | 'Last 30 days'
  | 'Last 3 months'
  | 'Last 12 months';

export type ActivitySort = 'Sort by newest' | 'Sort by oldest';

export class DashboardPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly teamDropdown: TeamDropdown;

  readonly cards: Locator;
  readonly firstCard: Locator;

  // "Hosts enrolled" — the per-platform bar chart at the top of the page.
  readonly hostsEnrolledHeading: Locator;

  // "Platform:" filter. Backed by Fleet's DropdownWrapper over react-select v5:
  // the trigger exposes no role of its own, so it's scoped by the dashboard's
  // own BEM container class; each option carries data-testid="dropdown-option".
  readonly platformFilter: Locator;
  readonly platformFilterValue: Locator;

  // Historical chart card ("Hosts online" / "Vulnerability exposure").
  readonly chartCard: Locator;
  readonly chartDatasetValue: Locator;
  readonly chartTitle: Locator;
  readonly chartInfoIcon: Locator;
  readonly chartFilteredPill: Locator;
  readonly configureChartFiltersButton: Locator;
  readonly chartLegend: Locator;
  readonly chartCells: Locator;
  readonly chartCellsWithHosts: Locator;
  readonly chartFilterModal: Locator;
  readonly chartFilterApplyButton: Locator;
  readonly dataCollectionDisabledHeading: Locator;
  readonly dataCollectionDisabledPanel: Locator;
  readonly chartTurnOnButton: Locator;

  readonly softwareHeading: Locator;
  readonly softwareTable: Locator;
  readonly firstSoftwareRow: Locator;
  readonly firstSoftwareNameCell: Locator;
  readonly activityHeading: Locator;
  readonly activityFeedCard: Locator;
  readonly firstActivityItem: Locator;
  readonly activityNext: Locator;
  /** Every activity row on the feed's current page (8 per page). */
  readonly activityItems: Locator;
  /** Prefix match on the actor's name or email; the server does the filtering. */
  readonly activitySearch: Locator;
  readonly activityEmptyState: Locator;

  // "Manage automations" — streams the activity feed to a destination URL.
  readonly automationsButton: Locator;
  readonly automationsModal: Locator;
  /**
   * Fleet's `Slider` renders a `role="switch"` with **no** accessible name, so
   * it's reached through the modal and its state read from `aria-checked`.
   */
  readonly automationsToggle: Locator;
  readonly automationsUrlInput: Locator;
  readonly automationsSaveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.teamDropdown = new TeamDropdown(page);

    // Fleet marks each dashboard widget card with data-testid="card"
    this.cards = page.getByTestId('card');
    this.firstCard = this.cards.first();

    this.hostsEnrolledHeading = page.getByRole('heading', { name: 'Hosts enrolled', level: 2 });

    this.platformFilter = page.locator('.dashboard-page__platform-filter .react-select__control');
    this.platformFilterValue = page.locator(
      '.dashboard-page__platform-filter .react-select__single-value',
    );

    // The chart card has no heading of its own on premium (the dataset
    // dropdown takes its place), so the card is scoped by its component class.
    this.chartCard = page.locator('.chart-card');
    this.chartDatasetValue = page.locator(
      '.chart-card__dataset-dropdown .react-select__single-value',
    );
    // Rendered only where a single dataset is offered (free); premium swaps in
    // the dataset dropdown.
    this.chartTitle = page.locator('.chart-card__title');
    this.chartInfoIcon = this.chartCard.getByTestId('info-outline-icon');
    // Appears once the applied filters differ from the card's seeded defaults.
    this.chartFilteredPill = this.chartCard.getByRole('button', { name: 'Filtered' });
    this.configureChartFiltersButton = this.chartCard.getByRole('button', {
      name: 'Configure chart filters',
    });
    // Legend and cells are SVG/`div` internals of CheckerboardViz with no role
    // of their own beyond each cell's role="img"; the legend wrapper is reached
    // by class and the cells by their accessible "<day>, <hour>: N hosts" name.
    this.chartLegend = this.chartCard.locator('.checkerboard-viz__legend');
    this.chartCells = this.chartCard.getByRole('img', { name: /: (\d+ hosts?|No data)$/ });
    // Cells for hours that actually reported — a chart rendering only "No data"
    // cells is indistinguishable from a broken query without this.
    this.chartCellsWithHosts = this.chartCard.getByRole('img', { name: /: \d+ hosts?$/ });
    this.chartFilterModal = page.locator('.chart-filter-modal');
    this.chartFilterApplyButton = this.chartFilterModal.getByRole('button', { name: 'Apply' });
    this.dataCollectionDisabledHeading = page.getByRole('heading', {
      name: 'Data collection is disabled',
    });
    // The panel that replaces the chart while the selected dataset's collection
    // is off. Its sentence names the scope the switch applies to ("this fleet"
    // vs "all fleets"), which is how a spec proves it flipped the per-fleet
    // switch and not the deployment-wide one. No role/text anchor wraps the
    // panel itself, so it's scoped by the component's class.
    this.dataCollectionDisabledPanel = this.chartCard.locator(
      '.data-collection-disabled-state',
    );
    this.chartTurnOnButton = this.dataCollectionDisabledPanel.getByRole('button', {
      name: 'Turn on',
    });

    this.softwareHeading = page.getByRole('heading', { name: 'Software' });
    this.softwareTable = page.getByRole('table');
    this.firstSoftwareRow = this.softwareTable.locator('tbody tr').first();
    this.firstSoftwareNameCell = this.firstSoftwareRow.locator('td').first();
    this.activityHeading = page.getByRole('heading', { name: 'Activity' });

    // Scopes the activity feed via class — no role/text anchor uniquely
    // identifies this card amongst the other dashboard widgets, and the
    // "Next" pagination button below collides with controls on other cards
    // (e.g. the Software widget) without this scope.
    this.activityFeedCard = page.locator('.activity-feed-card');

    // Activity rows are buttons whose accessible name ends with "ago" —
    // filter by that to avoid matching the filter dropdowns or the
    // pagination controls inside the same card.
    this.firstActivityItem = this.activityFeedCard
      .getByRole('button', { name: /\bago\b/ })
      .first();
    this.activityNext = this.activityFeedCard.getByRole('button', { name: 'Next' });
    this.activityItems = this.activityFeedCard.getByRole('button', { name: /\bago\b/ });
    this.activitySearch = this.activityFeedCard.getByRole('textbox', {
      name: "Search activities by user's name or email",
    });
    this.activityEmptyState = this.activityFeedCard.getByText('No activities match the current criteria');

    this.automationsButton = page.getByRole('button', { name: 'Manage automations', exact: true });
    // The modal class is on both the container and its inner form div, so the
    // container is pinned by the shared modal-container class as well.
    this.automationsModal = page.locator(
      '.activity-feed-automations-modal.modal__modal_container',
    );
    this.automationsToggle = this.automationsModal.getByRole('switch');
    // The URL field is tooltip-wrapped, so it's reached by placeholder rather
    // than label (see TeamSettingsPage for the same pattern).
    this.automationsUrlInput = this.automationsModal.getByPlaceholder(
      'https://server.com/example',
    );
    this.automationsSaveButton = this.automationsModal.getByRole('button', {
      name: 'Save',
      exact: true,
    });
  }

  /**
   * Narrows the feed to one activity type, by its filter label ("Added report",
   * "User login: success"; `ACTIVITY_TYPE_TO_FILTER_LABEL`), or back to "All
   * types". Fleet's own react-select (prefix `activity-type-select`) renders its
   * options with no role and opens from its wrapper, so classes are the handle.
   */
  async selectActivityType(label: string): Promise<void> {
    const filters = this.activityFeedCard.locator('.activity-feed-filters');
    const control = filters.locator('.activity-type-select__control');
    await control.click();
    await this.page.locator('.activity-type-select__option').getByText(label, { exact: true }).click();
    await expect(control).toContainText(label);
  }

  /** Sets the feed's date filter. */
  async selectActivityDate(label: ActivityDateFilter): Promise<void> {
    await this.selectActivityDropdown('date-filter', label);
  }

  /** Sets the feed's sort order. */
  async selectActivitySort(label: ActivitySort): Promise<void> {
    await this.selectActivityDropdown('created-at-filter', label);
  }

  /**
   * The date and sort filters are DropdownWrapper (react-select v5). Their
   * combobox is react-select's hidden dummy input, named by `aria-label`, so the
   * visible control holding it is what gets clicked; options carry Fleet's
   * `dropdown-option` test id.
   */
  private async selectActivityDropdown(name: string, label: string): Promise<void> {
    const control = this.activityFeedCard
      .locator('.react-select__control')
      .filter({ has: this.page.getByRole('combobox', { name }) });
    await control.click();
    await this.page.getByTestId('dropdown-option').filter({ hasText: new RegExp(`^${label}$`) }).click();
    await expect(control).toHaveText(label);
  }

  /**
   * A platform's row in the "Hosts enrolled" chart. The y-axis tick is a
   * `role="button"` named "<platform> hosts" only while the platform has hosts
   * and a built-in label to link to — a platform with none renders as inert
   * text, so `toHaveCount(0)` is how "not clickable" reads.
   */
  platformRow(label: Exclude<DashboardPlatformLabel, 'All'>): Locator {
    return this.page.getByRole('button', { name: `${label} hosts` });
  }

  /**
   * One of the host-count cards under the platform filter ("Total hosts",
   * "Missing hosts", "Low disk space hosts", "ABM issue hosts"). Each is a link
   * whose accessible name is "<count> <name>", so the match is on the name
   * portion. Which cards render depends on the platform filter and the tier.
   */
  hostCountCard(name: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(`\\b${name}$`) });
  }

  /** A dashboard widget card by its heading ("Software", "Operating systems", …). */
  cardHeading(name: string): Locator {
    return this.page.getByRole('heading', { name, level: 2 });
  }

  /**
   * Idempotently pick a platform in the "Platform:" filter. Fleet routes each
   * platform to its own dashboard path, so this waits on the URL rather than on
   * the cards that the new route renders.
   */
  async selectPlatform(label: DashboardPlatformLabel): Promise<void> {
    const current = (await this.platformFilterValue.textContent())?.trim();
    if (current === label) return;
    await this.platformFilter.click();
    // DropdownWrapper stamps data-testid="dropdown-option" on every option;
    // anchored so "iOS" can't match "iPadOS".
    await this.page
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
    await expect(this.page).toHaveURL(new RegExp(`${PLATFORM_PATHS[label]}(\\?|$)`));
    await expect(this.platformFilterValue).toHaveText(label);
  }

  /**
   * Switch the historical chart card to another dataset. Premium only — free
   * offers a single dataset and renders {@link chartTitle} in place of the
   * dropdown, so calling this there would find no control.
   */
  async selectChartDataset(label: ChartDatasetLabel): Promise<void> {
    const current = (await this.chartDatasetValue.textContent())?.trim();
    if (current === label) return;
    await this.chartCard.locator('.chart-card__dataset-dropdown .react-select__control').click();
    await this.page
      .getByTestId('dropdown-option')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
    await expect(this.chartDatasetValue).toHaveText(label);
  }

  /** Opens the chart card's "Settings" filter modal. */
  async openChartFilters(): Promise<void> {
    await this.configureChartFiltersButton.click();
    await expect(this.chartFilterModal).toBeVisible();
  }

  /**
   * Pick platforms in the chart filter modal's multi-select. The field is
   * Fleet's legacy `Dropdown` (react-select v1): the closed control shows its
   * "All platforms" placeholder, and each open option is a real `role="option"`
   * carrying the platform as its accessible name.
   */
  async selectChartFilterPlatforms(labels: string[]): Promise<void> {
    await this.chartFilterModal.getByText('All platforms', { exact: true }).click();
    for (const label of labels) {
      await this.chartFilterModal.getByRole('option', { name: label, exact: true }).click();
    }
  }

  /** Applies the chart filter modal and waits for it to close. */
  async applyChartFilters(): Promise<void> {
    await this.chartFilterApplyButton.click();
    await expect(this.chartFilterModal).toBeHidden();
  }

  /** Opens the "Manage automations" modal from the activity feed header. */
  async openAutomations(): Promise<void> {
    await this.automationsButton.click();
    await expect(this.automationsModal).toBeVisible();
  }

  /** Flips the activity-automations switch, reading current state from aria-checked. */
  async setAutomationsEnabled(enabled: boolean): Promise<void> {
    const checked = (await this.automationsToggle.getAttribute('aria-checked')) === 'true';
    if (checked !== enabled) await this.automationsToggle.click();
    await expect(this.automationsToggle).toHaveAttribute('aria-checked', String(enabled));
  }

  /** Saves the automations modal and waits for it to close. */
  async saveAutomations(): Promise<void> {
    await this.automationsSaveButton.click();
    await expect(this.automationsModal).toBeHidden();
  }

  async goto(opts: { platform?: DashboardPlatform; fleetId?: number } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    const qs = params.toString();
    const path = opts.platform ? `/dashboard/${opts.platform}` : '/dashboard';
    await this.page.goto(`${path}${qs ? '?' + qs : ''}`);
    await expect(this.firstCard).toBeVisible();
  }

  // Activity rows in the dashboard feed are buttons whose accessible name
  // embeds the actor, action, target, and a "X ago" timestamp. Specs filter
  // by the target portion (typically a Date.now()-stamped name) so the match
  // doesn't collide with unrelated buttons elsewhere on the page.
  activityRows(matcher: string | RegExp): Locator {
    return this.activityFeedCard.getByRole('button', { name: matcher });
  }

  /**
   * Click "Next" on the activity feed and wait for the resulting
   * `GET /api/.../activities?page=N` response — the response is the
   * synchronization point; the table re-renders synchronously once the
   * payload arrives, so no follow-up DOM-change wait is needed.
   */
  private async paginateActivityNext(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) => /\/activities\?.*page=/.test(r.url()) && r.status() === 200,
      { timeout: 10_000 },
    );
    await this.activityNext.click();
    await responsePromise;
  }

  /**
   * Walk the feed forward once (8 rows per page, bounded by `maxPages`),
   * removing every matcher that is present on the way, and return the matchers
   * still missing. Reads the currently-rendered feed — call after it has loaded.
   */
  private async findMissingActivities(
    matchers: Array<string | RegExp>,
    maxPages: number,
  ): Promise<Array<string | RegExp>> {
    const remaining = matchers.slice();
    for (let page = 0; page < maxPages && remaining.length > 0; page++) {
      // Walk backwards so splice doesn't disturb iteration indices.
      for (let i = remaining.length - 1; i >= 0; i--) {
        if ((await this.activityRows(remaining[i]).count()) > 0) {
          remaining.splice(i, 1);
        }
      }
      if (remaining.length === 0) break;
      if (!(await this.activityNext.isEnabled())) break;
      await this.paginateActivityNext();
    }
    return remaining;
  }

  /**
   * Assert the activity feed contains a row matching every matcher in
   * `matchers`. {@link expectActivity} is the single-matcher shorthand.
   *
   * Activity records are written asynchronously after the action that triggers
   * them, and the feed is fetched only on load — so a matcher missing from the
   * first walk reloads the dashboard and re-walks (bounded by `reloadAttempts`),
   * letting a not-yet-propagated activity be re-fetched rather than asserted
   * against a stale render. Found matchers carry over between attempts, so each
   * reload only re-hunts what's still missing.
   *
   * Matcher uniqueness is the caller's contract — specs stamp resource names
   * with `Date.now()`, so any row whose accessible name matches is by
   * construction from the current run.
   */
  async expectActivities(
    matchers: Array<string | RegExp>,
    opts: { maxPages?: number; reloadAttempts?: number } = {},
  ): Promise<void> {
    const maxPages = opts.maxPages ?? 15;
    // Activity propagation latency rises with concurrent load, so allow a wider
    // reload window; the fast path (activity already present) still returns on
    // the first walk without reloading.
    const reloadAttempts = opts.reloadAttempts ?? 10;
    let remaining = matchers.slice();

    for (let attempt = 0; attempt < reloadAttempts && remaining.length > 0; attempt++) {
      if (attempt > 0) {
        // Re-fetch the feed so an activity that hadn't propagated at load appears;
        // reload preserves the URL, keeping the current team scope.
        await this.page.reload();
        await expect(this.firstActivityItem).toBeVisible({ timeout: 15_000 });
      }
      remaining = await this.findMissingActivities(remaining, maxPages);
    }

    if (remaining.length > 0) {
      // Surface the first un-matched matcher via toBeVisible() so the
      // failure carries Playwright's standard locator + screenshot context.
      await expect(this.activityRows(remaining[0]).first()).toBeVisible();
    }
  }

  /** Single-matcher shorthand for {@link expectActivities}. */
  async expectActivity(
    matcher: string | RegExp,
    opts: { maxPages?: number } = {},
  ): Promise<void> {
    await this.expectActivities([matcher], opts);
  }
}
