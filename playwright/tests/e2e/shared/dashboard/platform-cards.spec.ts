/**
 * Dashboard • platform cards. Two behaviours, identical on both tiers:
 *
 *  1. the "Platform:" filter routes the dashboard to that platform's view —
 *     /dashboard/mac | /dashboard/windows | /dashboard/linux |
 *     /dashboard/chrome — where the aggregate "Total hosts" card gives way to
 *     the platform's "Operating systems" card, which says who updates the OS:
 *     the vendor, or for ChromeOS, Google on every Chromebook by itself;
 *  2. a platform row in the "Hosts enrolled" chart links to the hosts list
 *     filtered by that platform's built-in label, enrolled hosts only.
 *
 * ChromeOS is covered because each instance carries a ChromeOS host, the
 * device lab's ChromeOS Flex VM (`lab-hosts.json`): its row in Hosts enrolled
 * is a link only while the instance has one. iOS, iPadOS and Android have no
 * host on either instance, so their rows are inert text and aren't covered.
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
 * MetricsHostCounts, the per-platform layouts), cards/OperatingSystems
 * (renderDescription) and cards/HostsEnrolledCard (ClickableYAxisTick, which
 * names each clickable tick "<platform> hosts" and pushes
 * MANAGE_HOSTS_LABEL(labelId) with status=enrolled).
 */
import { test, expect } from '@fixtures';
import type { DashboardPlatformLabel } from '@pages';

interface PlatformCase {
  label: Exclude<DashboardPlatformLabel, 'All'>;
  path: string;
  /** The "Operating systems" card's sentence on who updates the OS; Linux has no vendor, and none. */
  osUpdates?: string;
}

// The four platforms both QA instances carry hosts for (the header).
const PLATFORMS: PlatformCase[] = [
  { label: 'macOS', path: '/dashboard/mac', osUpdates: 'Apple releases updates and fixes for supported operating systems.' },
  {
    label: 'Windows',
    path: '/dashboard/windows',
    osUpdates: 'Microsoft releases updates and fixes for supported operating systems.',
  },
  { label: 'Linux', path: '/dashboard/linux' },
  {
    label: 'ChromeOS',
    path: '/dashboard/chrome',
    osUpdates: 'Chromebooks automatically receive updates from Google until their auto-update expiration date.',
  },
];

test.describe('Dashboard • platform cards', () => {
  test('the platform filter defaults to All and swaps in each platform view', async ({
    dashboard,
  }) => {
    await dashboard.goto();
    await expect(dashboard.platformFilterValue).toHaveText('All');
    await expect(dashboard.hostCountCard('Total hosts')).toBeVisible();

    for (const { label, path, osUpdates } of PLATFORMS) {
      await dashboard.selectPlatform(label);
      await expect(dashboard.page).toHaveURL(new RegExp(`${path}(\\?|$)`));

      // "Total hosts" is the all-platforms aggregate and is dropped from every
      // platform view; "Operating systems" only appears on one.
      await expect(dashboard.hostCountCard('Total hosts')).toHaveCount(0);
      await expect(dashboard.cardHeading('Operating systems')).toBeVisible();
      if (osUpdates) await expect(dashboard.page.getByText(osUpdates)).toBeVisible();
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
