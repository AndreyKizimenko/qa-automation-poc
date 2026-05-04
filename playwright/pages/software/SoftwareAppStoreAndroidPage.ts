import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/software/add/app-store?platform=android` — Managed Google Play picker.
 * Unlike VPP, this is a single text input — the operator types the
 * application ID (e.g. `com.openai.chatgpt`) and Fleet fetches the app
 * metadata from Google on submit.
 */
export class SoftwareAppStoreAndroidPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly heading: Locator;
  readonly applicationIdInput: Locator;
  readonly addSoftwareButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.heading = page.getByRole('heading', { name: 'Add software', level: 1 });
    this.applicationIdInput = page.getByLabel('Application ID');
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto(opts: { fleetId: number }): Promise<void> {
    await this.page.goto(`/software/add/app-store?fleet_id=${opts.fleetId}&platform=android`);
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
