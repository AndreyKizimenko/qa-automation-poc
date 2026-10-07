import { test, expect } from '@fixtures';
import { IntegrationsPage } from '@pages';
import { getAppConfig } from '@helpers/api';

const PAYWALL_TEXT = /This feature is included in Fleet Premium/i;

// Every URL below is reachable on free but the page body renders the
// "Fleet Premium" paywall. Failing here means a feature gate regressed
// (either the paywall disappeared or the page itself stopped rendering).
//
// `heading` pins the page to the card it's named for. OS settings sends a
// section it doesn't know to Disk encryption, which shows the same paywall, so
// without the card's own heading a row would pass with its card gone.
const PAYWALLED_PAGES: Array<{ name: string; url: string; heading?: string }> = [
  { name: 'Controls — OS updates', url: '/controls/os-updates' },
  { name: 'Controls — OS settings (root → disk encryption)', url: '/controls/os-settings', heading: 'Disk encryption' },
  { name: 'Controls — OS settings / Disk encryption', url: '/controls/os-settings/disk-encryption', heading: 'Disk encryption' },
  { name: 'Controls — OS settings / Certificates', url: '/controls/os-settings/certificates', heading: 'Certificates' },
  { name: 'Controls — OS settings / Passwords', url: '/controls/os-settings/passwords', heading: 'Passwords' },
  { name: 'Controls — OS settings / Host names', url: '/controls/os-settings/host-name-template', heading: 'Host names' },
  { name: 'Controls — Setup experience (root)', url: '/controls/setup-experience' },
  { name: 'Controls — Setup experience / Bootstrap package', url: '/controls/setup-experience/bootstrap-package' },
  { name: 'Controls — Setup experience / Install software', url: '/controls/setup-experience/install-software' },
  { name: 'Controls — Setup experience / Run script', url: '/controls/setup-experience/run-script' },
  { name: 'Controls — Setup experience / Setup assistant', url: '/controls/setup-experience/setup-assistant' },
  { name: 'Controls — Setup experience / Users', url: '/controls/setup-experience/users' },
  { name: 'Settings — Integrations / Calendars', url: '/settings/integrations/calendars' },
  { name: 'Settings — Integrations / Identity provider', url: '/settings/integrations/identity-provider' },
  // The End users tab of Authentication (SSO); its Fleet users tab is free, so
  // the one banner pins the tab as well as the card.
  {
    name: 'Settings — Integrations / Authentication (SSO) / End users',
    url: '/settings/integrations/sso/end-users',
    heading: 'Authentication (SSO)',
  },
  { name: 'Settings — Integrations / Conditional access', url: '/settings/integrations/conditional-access' },
  { name: 'Settings — Integrations / Change management', url: '/settings/integrations/change-management' },
  { name: 'Settings — Integrations / Certificate authorities', url: '/settings/integrations/certificate-authorities' },
];

// The MDM subpage mixes free MDM toggles with premium-only cards, each
// rendering its own paywall under the card's heading.
const MDM_PAYWALLED_SECTIONS = ['Android zero-touch', 'Apple Business (AB)', 'Microsoft Entra'];

test.describe('Free • paywall presence', () => {
  for (const page of PAYWALLED_PAGES) {
    test(page.name, async ({ page: pw }) => {
      await pw.goto(page.url);
      if (page.heading) await expect(pw.getByRole('heading', { name: page.heading, exact: true })).toBeVisible();
      const banners = pw.getByText(PAYWALL_TEXT);
      await expect(banners.first()).toBeVisible();
      await expect(banners).toHaveCount(1);
    });
  }

  test('Settings — Integrations / MDM (Android zero-touch, Apple Business, Microsoft Entra cards)', async ({ page }) => {
    const integrations = new IntegrationsPage(page);
    await page.goto('/settings/integrations/mdm');

    for (const title of MDM_PAYWALLED_SECTIONS) {
      await expect.soft(integrations.settingsSection(title).getByText(PAYWALL_TEXT), `${title} card`).toBeVisible();
    }
    await expect(page.getByText(PAYWALL_TEXT)).toHaveCount(MDM_PAYWALLED_SECTIONS.length);
  });

  test('Settings — no Teams nav link', async ({ page }) => {
    await page.goto('/settings/organization/info');
    await expect(page.getByRole('link', { name: /^Teams$/ })).toHaveCount(0);
  });

  // Free has no fleets, so nothing is scoped to one: the dashboard heads itself
  // with the organization's name where premium puts its fleet dropdown
  // (`DashboardPage.renderDashboardHeader`), and the Hosts list has no Fleet
  // column (`HostTableConfig`). Each absence follows the element that stands
  // in its place.
  test('Dashboard and Hosts — no fleet dropdown, no Fleet column', async ({ dashboard, hostsList, request }) => {
    const orgName = (await getAppConfig(request)).org_info?.org_name;
    expect(orgName, 'the organization has a name').toBeTruthy();

    await dashboard.goto();
    await expect(dashboard.page.getByRole('heading', { level: 1, name: orgName, exact: true })).toBeVisible();
    await expect(dashboard.teamDropdown.trigger).toHaveCount(0);

    await dashboard.navbar.goToHosts();
    await expect(hostsList.columnHeader('Host', { exact: true })).toBeVisible();
    await expect(hostsList.columnHeader('Fleet', { exact: true })).toHaveCount(0);
  });
});
