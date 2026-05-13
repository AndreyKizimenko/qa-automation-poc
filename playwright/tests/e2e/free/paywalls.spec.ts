import { test, expect } from '@fixtures';

const PAYWALL_TEXT = /This feature is included in Fleet Premium/i;

// Every URL below is reachable on free but the page body renders the
// "Fleet Premium" paywall. Failing here means a feature gate regressed
// (either the paywall disappeared or the page itself stopped rendering).
const PAYWALLED_PAGES: Array<{ name: string; url: string; expectedBanners?: number }> = [
  { name: 'Controls — OS updates', url: '/controls/os-updates' },
  { name: 'Controls — OS settings (root → disk encryption)', url: '/controls/os-settings' },
  { name: 'Controls — OS settings / Disk encryption', url: '/controls/os-settings/disk-encryption' },
  { name: 'Controls — OS settings / Certificates', url: '/controls/os-settings/certificates' },
  { name: 'Controls — OS settings / Passwords', url: '/controls/os-settings/passwords' },
  { name: 'Controls — Setup experience (root)', url: '/controls/setup-experience' },
  { name: 'Controls — Setup experience / Bootstrap package', url: '/controls/setup-experience/bootstrap-package' },
  { name: 'Controls — Setup experience / Install software', url: '/controls/setup-experience/install-software' },
  { name: 'Controls — Setup experience / Run script', url: '/controls/setup-experience/run-script' },
  { name: 'Controls — Setup experience / Setup assistant', url: '/controls/setup-experience/setup-assistant' },
  { name: 'Controls — Setup experience / Users', url: '/controls/setup-experience/users' },
  { name: 'Settings — Integrations / MDM (ABM + Microsoft Entra cards)', url: '/settings/integrations/mdm', expectedBanners: 2 },
  { name: 'Settings — Integrations / Calendars', url: '/settings/integrations/calendars' },
  { name: 'Settings — Integrations / Identity provider', url: '/settings/integrations/identity-provider' },
  { name: 'Settings — Integrations / Conditional access', url: '/settings/integrations/conditional-access' },
  { name: 'Settings — Integrations / Change management', url: '/settings/integrations/change-management' },
  { name: 'Settings — Integrations / Certificate authorities', url: '/settings/integrations/certificate-authorities' },
];

test.describe('Free • paywall presence', () => {
  for (const page of PAYWALLED_PAGES) {
    test(page.name, async ({ page: pw }) => {
      await pw.goto(page.url);
      const banners = pw.getByText(PAYWALL_TEXT);
      await expect(banners.first()).toBeVisible();
      await expect(banners).toHaveCount(page.expectedBanners ?? 1);
    });
  }

  test('Settings — no Teams nav link', async ({ page }) => {
    await page.goto('/settings/organization/info');
    await expect(page.getByRole('link', { name: /^Teams$/ })).toHaveCount(0);
  });
});
