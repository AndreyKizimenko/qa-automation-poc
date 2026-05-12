import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';
import { PlatformDropdown } from '../components/PlatformDropdown';

/**
 * `/software/add/app-store?platform=android` — Managed Google Play picker.
 * Unlike VPP, this is a single text input — the operator types the
 * application ID (e.g. `com.openai.chatgpt`) and Fleet fetches the app
 * metadata from Google on submit.
 */
export class SoftwareAppStoreAndroidPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly platformDropdown: PlatformDropdown;

  readonly heading: Locator;
  readonly appStoreTab: Locator;
  readonly applicationIdInput: Locator;
  readonly addSoftwareButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.platformDropdown = new PlatformDropdown(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.appStoreTab = page.getByRole('tab', { name: 'App store' });
    this.applicationIdInput = page.getByLabel('Application ID');
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /**
   * Direct URL navigation. Reserved for verification steps and subsequent
   * sub-tests; the primary `add` sub-test reaches this view by clicking
   * "Add software" on the titles page and then `openTab()`.
   */
  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/app-store?fleet_id=${opts.fleetId}&platform=android`);
    await this.expectLoaded();
  }

  /**
   * Switch to the App store tab from another Add software tab and select
   * the Android platform. The platform combobox defaults to Apple, so
   * we always need to flip it here.
   */
  async openTab(): Promise<void> {
    if ((await this.appStoreTab.getAttribute('aria-selected')) !== 'true') {
      await this.appStoreTab.click();
      await expect(this.page).toHaveURL(/\/software\/add\/app-store/);
    }
    await this.platformDropdown.select('Android');
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.applicationIdInput).toBeVisible();
  }

  /**
   * Types `applicationId` into the input and submits. Google Play metadata
   * fetch can take several seconds; waitForURL allows up to 60s for the
   * redirect to `/software/titles/:id`.
   */
  async addApp(applicationId: string): Promise<number> {
    await this.applicationIdInput.fill(applicationId);
    await expect(this.addSoftwareButton).toBeEnabled();
    await this.addSoftwareButton.click();
    await this.page.waitForURL(/\/software\/titles\/\d+/, { timeout: 60_000 });
    const id = parseInt(
      new URL(this.page.url()).pathname.match(/\/software\/titles\/(\d+)/)?.[1] ?? '0',
      10,
    );
    if (!id) throw new Error(`Could not parse software title id from ${this.page.url()}`);
    return id;
  }
}
