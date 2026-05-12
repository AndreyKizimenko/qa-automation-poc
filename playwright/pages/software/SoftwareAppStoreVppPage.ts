import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { PlatformDropdown } from '../components/PlatformDropdown';

/**
 * `/software/add/app-store?platform=apple` — VPP catalog form. Fleet renders
 * one `.software-vpp-form__list-item` per (app, Apple platform) tuple. Apps
 * already added to the current fleet are filtered out server-side, so the
 * list shrinks after a successful add and grows again after the title is
 * deleted from the library.
 *
 * Each list item contains the app name and a platform display label
 * ("macOS", "iOS", "iPadOS"); use both to disambiguate apps that exist on
 * multiple platforms (e.g. Bear, Canva).
 */
export type VppPlatformLabel = 'macOS' | 'iOS' | 'iPadOS';

export class SoftwareAppStoreVppPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly platformDropdown: PlatformDropdown;

  readonly heading: Locator;
  readonly appStoreTab: Locator;
  readonly listItem: Locator;
  readonly addSoftwareButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.platformDropdown = new PlatformDropdown(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.appStoreTab = page.getByRole('tab', { name: 'App store' });
    this.listItem = page.locator('.software-vpp-form__list-item');
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /**
   * Direct URL navigation. Reserved for verification steps and subsequent
   * sub-tests; the primary `add` sub-test reaches this view by clicking
   * "Add software" on the titles page and then `openTab()`.
   */
  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/app-store?fleet_id=${opts.fleetId}&platform=apple`);
    await this.expectLoaded();
  }

  /**
   * Switch to the App store tab from another Add software tab and select
   * the Apple platform. Apple is the default platform on first open of
   * the tab, but `select()` is idempotent so re-entry after Android still
   * lands here cleanly.
   */
  async openTab(): Promise<void> {
    if ((await this.appStoreTab.getAttribute('aria-selected')) !== 'true') {
      await this.appStoreTab.click();
      await expect(this.page).toHaveURL(/\/software\/add\/app-store/);
    }
    await this.platformDropdown.select('Apple (macOS, iOS, and iPadOS)');
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.listItem.first()).toBeVisible();
  }

  /**
   * Disambiguates by name + platform display label so the same app on
   * different Apple platforms returns distinct rows.
   */
  rowFor(name: string, platform: VppPlatformLabel): Locator {
    return this.listItem.filter({ hasText: name }).filter({ hasText: platform });
  }

  async expectListed(name: string, platform: VppPlatformLabel): Promise<void> {
    await expect(this.rowFor(name, platform)).toBeVisible();
  }

  async expectNotListed(name: string, platform: VppPlatformLabel): Promise<void> {
    await expect(this.rowFor(name, platform)).toHaveCount(0);
  }

  /**
   * Selects the (name, platform) entry's radio and submits the form. Fleet
   * redirects to `/software/titles/:id` on success; the parsed id is
   * returned for callers that need to navigate or assert against it.
   */
  async addApp(name: string, platform: VppPlatformLabel): Promise<number> {
    // Click the row's <label> rather than the radio input — Fleet's Radio
    // component visually hides the underlying <input>, but the wrapping
    // <label htmlFor={id}> covers the visible "radio button" area and
    // activates the input on click. One label per list item.
    await this.rowFor(name, platform).locator('label').click();
    await expect(this.addSoftwareButton).toBeEnabled();
    await this.addSoftwareButton.click();
    await this.page.waitForURL(/\/software\/titles\/\d+/);
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/software\/titles\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse software title id from ${this.page.url()}`);
    return id;
  }
}
