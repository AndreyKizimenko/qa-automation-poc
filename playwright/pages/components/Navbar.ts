import { Page, Locator, expect } from '@playwright/test';

/**
 * Site-wide top navigation bar — main section links, org logo, user menu.
 * Rendered on every authenticated page.
 */
export class Navbar {
  readonly nav: Locator;
  readonly logo: Locator;
  readonly hosts: Locator;
  readonly controls: Locator;
  readonly software: Locator;
  readonly reports: Locator;
  readonly policies: Locator;

  // User menu
  readonly userMenuTrigger: Locator;
  readonly myAccountItem: Locator;
  readonly signOutItem: Locator;
  readonly settingsItem: Locator;
  readonly labelsItem: Locator;
  readonly usersItem: Locator;
  readonly documentationItem: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation');

    this.logo = this.nav.getByRole('link', { name: 'Organization Logo' });
    this.hosts = this.nav.getByRole('link', { name: 'Hosts' });
    this.controls = this.nav.getByRole('link', { name: 'Controls' });
    this.software = this.nav.getByRole('link', { name: 'Software' });
    this.reports = this.nav.getByRole('link', { name: 'Reports' });
    this.policies = this.nav.getByRole('link', { name: 'Policies' });

    this.userMenuTrigger = page.getByTestId('user-menu');
    this.myAccountItem = page.getByRole('menuitem', { name: 'My account' });
    this.signOutItem = page.getByRole('menuitem', { name: 'Sign out' });
    this.settingsItem = page.getByRole('menuitem', { name: 'Settings' });
    this.labelsItem = page.getByRole('menuitem', { name: 'Labels' });
    this.usersItem = page.getByRole('menuitem', { name: 'Users' });
    this.documentationItem = page.getByRole('menuitem', { name: 'Documentation' });
  }

  async openUserMenu(): Promise<void> {
    await this.userMenuTrigger.click();
  }

  async signOut(): Promise<void> {
    await this.openUserMenu();
    await this.signOutItem.click();
  }

  // Section navigation. Clicks preserve the current `fleet_id` query param.

  async goToDashboard(): Promise<void> {
    await this.logo.click();
    await expect(this.nav.page()).toHaveURL(/\/dashboard/);
  }

  async goToHosts(): Promise<void> {
    await this.hosts.click();
    await expect(this.nav.page()).toHaveURL(/\/hosts\/manage/);
  }

  async goToControls(): Promise<void> {
    await this.controls.click();
    await expect(this.nav.page()).toHaveURL(/\/controls/);
  }

  async goToSoftware(): Promise<void> {
    await this.software.click();
    await expect(this.nav.page()).toHaveURL(/\/software/);
  }

  async goToReports(): Promise<void> {
    await this.reports.click();
    await expect(this.nav.page()).toHaveURL(/\/reports\/manage/);
  }

  async goToPolicies(): Promise<void> {
    await this.policies.click();
    await expect(this.nav.page()).toHaveURL(/\/policies\/manage/);
  }
}
