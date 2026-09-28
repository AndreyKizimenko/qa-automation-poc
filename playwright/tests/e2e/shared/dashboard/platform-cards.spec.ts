/**
 * Dashboard • platform cards. Two behaviours, identical on both tiers:
 *
 *  1. the "Platform:" filter routes the dashboard to that platform's view —
 *     /dashboard/mac | /dashboard/windows | /dashboard/linux — where the
 *     aggregate "Total hosts" card gives way to the platform's "Operating
 *     systems" card;
 *  2. a platform row in the "Hosts enrolled" chart links to the hosts list
 *     filtered by that platform's built-in label, enrolled hosts only.
 *
 * Shared rather than tier-split because nothing here is fleet-scoped or
 * paywalled: premium adds a "Low disk space hosts" card and a fleet dropdown,
 * neither of which these cases touch. The premium-only historical chart card
 * lives in `premium/dashboard/fleet-scoped-cards.spec.ts`.
 *
 * **Host membership is deliberately not asserted.** The QA pools are
 * osquery-perf simulations that answer every built-in label query, so the
 * "macOS" label holds Ubuntu rows on both instances — a green "every row is a
 * Mac" assertion would prove nothing and a red one would be the fixture's
 * fault, not Fleet's. What is asserted instead is the link's contract: the
 * hosts list opens scoped to the label named for the platform that was
 * clicked.
 *
 * Grounded in frontend/pages/DashboardPage (PLATFORM_DROPDOWN_OPTIONS,
 * MetricsHostCounts) and cards/HostsEnrolledCard (ClickableYAxisTick, which
 * names each clickable tick "<platform> hosts" and pushes
 * MANAGE_HOSTS_LABEL(labelId) with status=enrolled).
 */
import { test, expect } from '@fixtures';
import type { DashboardPlatformLabel } from '@pages';

interface PlatformCase {
  label: Exclude<DashboardPlatformLabel, 'All'>;
  path: string;
  /** Vendor sentence on the "Operating systems" card; Linux has no vendor. */
  osVendor?: string;
}

// The three platforms both QA instances carry hosts for. ChromeOS/iOS/iPadOS/
// Android have none, so their rows render as inert text rather than links.
const PLATFORMS: PlatformCase[] = [
  { label: 'macOS', path: '/dashboard/mac', osVendor: 'Apple' },
  { label: 'Windows', path: '/dashboard/windows', osVendor: 'Microsoft' },
  { label: 'Linux', path: '/dashboard/linux' },
];

test.describe('Dashboard • platform cards', () => {
  test('the platform filter defaults to All and swaps in each platform view', async ({
    dashboard,
  }) => {
    await dashboard.goto();
    await expect(dashboard.platformFilterValue).toHaveText('All');
    await expect(dashboard.hostCountCard('Total hosts')).toBeVisible();

    for (const { label, path, osVendor } of PLATFORMS) {
      await dashboard.selectPlatform(label);
      await expect(dashboard.page).toHaveURL(new RegExp(`${path}(\\?|$)`));

      // "Total hosts" is the all-platforms aggregate and is dropped from every
      // platform view; "Operating systems" only appears on one.
      await expect(dashboard.hostCountCard('Total hosts')).toHaveCount(0);
      await expect(dashboard.cardHeading('Operating systems')).toBeVisible();
      if (osVendor) {
        await expect(
          dashboard.page.getByText(
            `${osVendor} releases updates and fixes for supported operating systems.`,
          ),
        ).toBeVisible();
      }
    }

    await dashboard.selectPlatform('All');
    await expect(dashboard.hostCountCard('Total hosts')).toBeVisible();
  });

  for (const { label } of PLATFORMS) {
    test(`the ${label} row in Hosts enrolled opens its enrolled hosts`, async ({
      dashboard,
      hostsList,
    }) => {
      await dashboard.goto();
      await expect(dashboard.hostsEnrolledHeading).toBeVisible();

      await dashboard.platformRow(label).click();

      // MANAGE_HOSTS_LABEL(labelId) + status=enrolled — the label id is
      // resolved by Fleet from the built-in platform labels, so the URL shape
      // and the filter's own label are what pin the link to the right platform.
      await expect(dashboard.page).toHaveURL(/\/hosts\/manage\/labels\/\d+/);
      await expect(dashboard.page).toHaveURL(/status=enrolled/);
      await expect(hostsList.labelFilter.trigger).toHaveText(label);
      await expect(hostsList.table.rowOrEmpty()).toBeVisible();
    });
  }
});
