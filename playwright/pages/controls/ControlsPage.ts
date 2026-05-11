import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { TeamDropdown } from '../components/TeamDropdown';

/**
 * /controls — landing page for Controls, which has a tablist for its five
 * sub-sections: OS updates, OS settings, Setup experience, Scripts, Variables.
 *
 * The team-scope dropdown lives at the Controls header level and applies
 * to every sub-tab below, so scope selection happens here before clicking
 * into a sub-section.
 */
export class ControlsPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly teamDropdown: TeamDropdown;

  readonly osUpdatesTab: Locator;
  readonly osSettingsTab: Locator;
  readonly setupExperienceTab: Locator;
  readonly scriptsTab: Locator;
  readonly variablesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.teamDropdown = new TeamDropdown(page);

    this.osUpdatesTab = page.getByRole('tab', { name: 'OS updates' });
    this.osSettingsTab = page.getByRole('tab', { name: 'OS settings' });
    this.setupExperienceTab = page.getByRole('tab', { name: 'Setup experience' });
    this.scriptsTab = page.getByRole('tab', { name: 'Scripts' });
    this.variablesTab = page.getByRole('tab', { name: 'Variables' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/controls');
    await expect(this.osUpdatesTab).toBeVisible();
  }

  async goToOsUpdates(): Promise<void> {
    await this.osUpdatesTab.click();
    await expect(this.page).toHaveURL(/\/controls\/os-updates/);
  }

  async goToOsSettings(): Promise<void> {
    await this.osSettingsTab.click();
    await expect(this.page).toHaveURL(/\/controls\/os-settings/);
  }

  async goToSetupExperience(): Promise<void> {
    await this.setupExperienceTab.click();
    await expect(this.page).toHaveURL(/\/controls\/setup-experience/);
  }

  async goToScripts(): Promise<void> {
    await this.scriptsTab.click();
    await expect(this.page).toHaveURL(/\/controls\/scripts/);
  }

  async goToVariables(): Promise<void> {
    await this.variablesTab.click();
    await expect(this.page).toHaveURL(/\/controls\/variables/);
  }
}
