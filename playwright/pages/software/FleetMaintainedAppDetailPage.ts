import { Page, Locator, expect } from '@playwright/test';
import { Navbar } from '../components/Navbar';

/**
 * `/software/add/fleet-maintained/:appId` — detail page for a single FMA.
 * Confirms the upload, which Fleet then fetches from its CDN.
 */
export class FleetMaintainedAppDetailPage {
  readonly page: Page;
  readonly navbar: Navbar;

  readonly addSoftwareButton: Locator;
  readonly uploadingMessage: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);

    this.addSoftwareButton = page.getByRole('button', { name: 'Add software', exact: true });
    this.uploadingMessage = page.getByText(/uploading software/i);
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  /**
   * Wait timeout is 2 minutes — Fleet's CDN fetch can be slow for large
   * apps. The "Uploading software…" message may not appear at all when
   * the package is cached server-side.
   */
  async confirmAdd(): Promise<void> {
    await expect(this.addSoftwareButton).toBeVisible();
    await this.addSoftwareButton.click();

    if (await this.uploadingMessage.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(this.uploadingMessage).toBeHidden({ timeout: 120_000 });
    }
  }
}
