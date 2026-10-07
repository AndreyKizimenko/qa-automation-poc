import { Page, Locator, expect } from '@playwright/test';

/**
 * Platform / label filter dropdown on /hosts/manage. Filters by OS platform
 * (macOS, Windows, Linux, ...) or by a custom label.
 *
 * Backed by react-select v5; the visible trigger has no accessible role, so
 * class selectors are unavoidable.
 */
const BUILT_IN_PLATFORMS = ['macOS', 'Windows', 'Linux', 'ChromeOS', 'iOS', 'iPadOS', 'Android'];

export class LabelFilter {
  readonly page: Page;
  readonly trigger: Locator;
  readonly options: Locator;
  /** The open menu's "Filter labels by name..." box: what shows the menu is open. */
  readonly searchBox: Locator;
  /** The "+" beside that box, for a role that may add labels. */
  readonly addLabelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.locator('.label-filter-select__control');
    this.options = page.locator('.label-filter-select__option');
    this.searchBox = page.getByPlaceholder('Filter labels by name...');
    this.addLabelButton = page.getByRole('button', { name: 'Add label', exact: true });
  }

  /**
   * Opens the menu and waits for its search box. A re-render of the Hosts page
   * can close a menu opened just after it loads, so the click is retried until
   * the box holds; a caller asserting something absent from the menu re-checks
   * the box afterwards, so the absence wasn't read off a closed menu.
   */
  async openMenu(): Promise<void> {
    await expect(async () => {
      if (!(await this.searchBox.isVisible())) await this.trigger.click();
      await expect(this.searchBox).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }

  async selectPlatform(platform: string): Promise<void> {
    await this.trigger.click();
    // Custom labels frequently embed a platform name (e.g. "macOS workstations"),
    // so the dropdown can list multiple matches. The Platforms group renders
    // first, so the first match is always the canonical platform entry.
    const option = this.options.filter({ hasText: platform }).first();
    await expect(option).toBeVisible();
    await option.click();
  }

  /**
   * Filters by one custom label, typed to narrow the menu so a label past its
   * fold is reachable. The menu's "Filter labels by name..." box mirrors what is
   * typed into the open select; filling the box itself takes focus from the
   * select, which closes the menu. Only the name up to its first space is typed:
   * react-select takes a space in an open menu as "choose the focused option", so
   * a gitops label like "Debian-based Linux hosts" would pick another label
   * instead. The option is then matched by its whole name. Fleet routes the
   * choice to `/hosts/manage/labels/<id>`.
   */
  async selectLabel(name: string): Promise<void> {
    const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const typed = name.split(/\s/)[0];
    const option = this.options.filter({ hasText: exact });
    // The Hosts page writes its default sort into the URL once its first load
    // settles, and that replace can land after a choice made just before it,
    // taking the page back to the unfiltered route. So the choice is retried
    // until the label's route sticks.
    await expect(async () => {
      await this.trigger.click();
      await expect(this.options.first()).toBeVisible({ timeout: 3_000 });
      await this.page.keyboard.type(typed);
      await expect(option).toHaveCount(1, { timeout: 3_000 });
      await option.click();
      await expect(this.page).toHaveURL(/\/hosts\/manage\/labels\/\d+/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  }

  /** Picks the first non-platform label (or the first option if none exist). */
  async selectFirstCustomLabel(): Promise<void> {
    await this.trigger.click();
    const count = await this.options.count();
    for (let i = 0; i < count; i++) {
      const text = await this.options.nth(i).textContent();
      if (text && !BUILT_IN_PLATFORMS.some((p) => text.includes(p))) {
        await this.options.nth(i).click();
        return;
      }
    }
    await this.options.first().click();
  }
}
