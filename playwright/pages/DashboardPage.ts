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
  readonly firstActivityItem: Locator;

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
    // Activity rows are buttons whose aria-label ends with "ago" — filter
    // by that to avoid matching unrelated buttons on the page.
    this.firstActivityItem = page.getByRole('button', { name: /\bago\b/ }).first();
  }

  async goto(opts: { platform?: DashboardPlatform; fleetId?: number } = {}): Promise<void> {
    const params = new URLSearchParams();
    if (opts.fleetId !== undefined) params.set('fleet_id', String(opts.fleetId));
    const qs = params.toString();
    const path = opts.platform ? `/dashboard/${opts.platform}` : '/dashboard';
    await this.page.goto(`${path}${qs ? '?' + qs : ''}`);
    await expect(this.firstCard).toBeVisible();
  }
}
