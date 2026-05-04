import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * /controls/os-settings — landing page with four status count links
 * (Verified / Verifying / Pending / Failed) that navigate to the hosts
 * list filtered by status, plus a sidebar for sub-pages (Disk encryption,
 * Configuration profiles, Certificates, Passwords).
 */
export class OsSettingsPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly statusLinks: Locator;

  // Sidebar nav items for the four OS settings sub-pages.
  readonly diskEncryptionLink: Locator;
  readonly configurationProfilesLink: Locator;
  readonly certificatesLink: Locator;
  readonly passwordsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    // Status links render with accessible name like "Verified 5 hosts"
    this.statusLinks = page.getByRole('link').filter({ hasText: /hosts$/ });

    this.diskEncryptionLink = page.getByRole('link', { name: 'Disk encryption' });
    this.configurationProfilesLink = page.getByRole('link', { name: 'Configuration profiles' });
    this.certificatesLink = page.getByRole('link', { name: 'Certificates' });
    this.passwordsLink = page.getByRole('link', { name: 'Passwords' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/controls/os-settings');
    await expect(this.statusLinks.first()).toBeVisible();
  }

  async goToConfigurationProfiles(): Promise<void> {
    await this.configurationProfilesLink.click();
    await expect(this.page).toHaveURL(/\/controls\/os-settings\/configuration-profiles/);
  }

  /**
   * Click the status link with the highest host count. Falls back to the
   * "Verified" link if all statuses show 0 hosts. Returns the selected
   * link locator, or null if no links were found.
   */
  async clickStatusWithMostHosts(): Promise<Locator | null> {
    const count = await this.statusLinks.count();
    let target: Locator | null = null;
    let maxHosts = 0;

    for (let i = 0; i < count; i++) {
      const text = await this.statusLinks.nth(i).innerText();
      const match = text.match(/(\d+)\s+hosts?/);
      const hostCount = match ? parseInt(match[1], 10) : 0;
      if (hostCount > maxHosts) {
        maxHosts = hostCount;
        target = this.statusLinks.nth(i);
      }
    }

    if (!target || maxHosts === 0) {
      target = this.statusLinks.filter({ hasText: 'Verified' }).first();
    }

    await target.click();
    return target;
  }
}
