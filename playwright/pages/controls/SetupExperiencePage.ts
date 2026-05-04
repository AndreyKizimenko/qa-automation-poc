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

  async goToRunScript(): Promise<void> {
    await this.runScriptLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/run-script/);
  }

  async goToSetupAssistant(): Promise<void> {
    await this.setupAssistantLink.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience\/setup-assistant/);
  }
}
