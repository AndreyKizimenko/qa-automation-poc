import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/controls/setup-experience/*` — five-step wizard for the macOS ADE Setup
 * Experience: Users → Bootstrap package → Install software → Run script →
 * Setup Assistant. The tab lands on `users` by default; other sections are
 * reached via the numbered subnav.
 */
export class SetupExperiencePage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly usersLink: Locator;
  readonly bootstrapPackageLink: Locator;
  readonly installSoftwareLink: Locator;
  /** Not in the side navigation on Fleet 5: what a spec checks is absent. {@link goToRunScript} goes by URL. */
  readonly runScriptLink: Locator;
  readonly setupAssistantLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    // Subnav links are prefixed with their step number ("1. Users",
    // "2. Bootstrap package", ...); match the suffix.
    this.usersLink = page.getByRole('link', { name: /Users$/ });
    this.bootstrapPackageLink = page.getByRole('link', { name: /Bootstrap package$/ });
    this.installSoftwareLink = page.getByRole('link', { name: /Install software$/ });
    this.runScriptLink = page.getByRole('link', { name: /Run script$/ });
    this.setupAssistantLink = page.getByRole('link', { name: /Setup Assistant$/ });
  }

  async goToUsers(): Promise<void> {
    await this.usersLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/users/);
  }

  async goToBootstrapPackage(): Promise<void> {
    await this.bootstrapPackageLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/bootstrap-package/);
  }

  async goToInstallSoftware(): Promise<void> {
    await this.installSoftwareLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/install-software/);
  }

  /**
   * Opens the Run script card on the fleet the page is showing. Fleet 5 keeps the
   * card out of the side navigation (a deprecated step, `exclude: true` in
   * `SetupExperienceNavItems.tsx`) and still serves it at its URL, so it is
   * reached by URL, carrying the page's `fleet_id`.
   */
  async goToRunScript(): Promise<void> {
    const fleetId = new URL(this.page.url()).searchParams.get('fleet_id');
    await this.page.goto(`/controls/setup-experience/run-script${fleetId !== null ? `?fleet_id=${fleetId}` : ''}`);
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/run-script/);
  }

  async goToSetupAssistant(): Promise<void> {
    await this.setupAssistantLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/setup-assistant/);
  }
}
