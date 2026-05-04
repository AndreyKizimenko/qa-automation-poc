import { Page, Locator } from '@playwright/test';

/**
 * Team / fleet scope dropdown shown on Hosts, Software, Reports, Policies,
 * etc. Backed by react-select v5; the visible trigger has no accessible
 * role, so a class selector is unavoidable.
 */
export class TeamDropdown {
  readonly page: Page;
  readonly trigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.locator('.team-dropdown__control');
  }

  /** `index=0` is "All fleets"; default `index=1` picks the first real team. */
  async selectByIndex(index = 1): Promise<void> {
    await this.trigger.click();
    await this.page.locator('.team-dropdown__option').nth(index).click();
    await this.page.waitForURL(/fleet_id/);
  }

  async selectByName(name: string): Promise<void> {
    await this.trigger.click();
    await this.page.locator('.team-dropdown__option').filter({ hasText: name }).click();
    await this.page.waitForURL(/fleet_id/);
  }
}
