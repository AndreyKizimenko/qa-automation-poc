import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from './components/Navbar';

/**
 * /dashboard — the Fleet dashboard, with platform-specific variants:
 *   /dashboard, /dashboard/mac, /dashboard/windows, /dashboard/linux,
 *   /dashboard/chrome, /dashboard/ios, /dashboard/ipados
 *
 * Renders a grid of cards (platform totals), a Software block, and an
 * Activity feed.
 */
type DashboardPlatform = 'mac' | 'windows' | 'linux' | 'chrome' | 'ios' | 'ipados';

export class DashboardPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly cards: Locator;
  readonly firstCard: Locator;

  readonly softwareHeading: Locator;
  readonly softwareTable: Locator;
  readonly firstSoftwareRow: Locator;
  readonly firstSoftwareNameCell: Locator;
  readonly activityHeading: Locator;
  readonly activityFeedCard: Locator;
  readonly firstActivityItem: Locator;
  readonly activityNext: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    // Fleet marks each dashboard widget card with data-testid="card"
    this.cards = page.getByTestId('card');
    this.firstCard = this.cards.first();

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
   * Assert the activity feed contains a row matching every matcher in
   * `matchers`. Paginates forward bounded by `maxPages` (8 rows per page)
   * and checks every remaining matcher per page so one walk drains the
   * batch. {@link expectActivity} is the single-matcher shorthand.
   *
   * Matcher uniqueness is the caller's contract — specs stamp resource
   * names with `Date.now()`, so any row whose accessible name matches is
   * by construction from the current run.
   */
  async expectActivities(
    matchers: Array<string | RegExp>,
    opts: { maxPages?: number } = {},
  ): Promise<void> {
    const maxPages = opts.maxPages ?? 15;
    const remaining = matchers.slice();

    for (let page = 0; page < maxPages && remaining.length > 0; page++) {
      // Walk backwards so splice doesn't disturb iteration indices.
      for (let i = remaining.length - 1; i >= 0; i--) {
        if ((await this.activityRows(remaining[i]).count()) > 0) {
          remaining.splice(i, 1);
        }
      }
      if (remaining.length === 0) return;
      if (!(await this.activityNext.isEnabled())) break;
      await this.paginateActivityNext();
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
