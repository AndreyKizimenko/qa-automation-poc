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
   * Confirms the add and waits for Fleet's server-side CDN fetch to finish.
   * The "Uploading software…" message may not appear at all when the package
   * is cached server-side; when it does, a typical fetch clears in a few
   * seconds. The 45s ceiling leaves ample headroom for a large app on a cold
   * CDN under concurrent load while still failing fast if the add hangs.
   */
  async confirmAdd(): Promise<void> {
    await expect(this.addSoftwareButton).toBeVisible();
    await this.addSoftwareButton.click();

    if (await this.uploadingMessage.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(this.uploadingMessage).toBeHidden({ timeout: 45_000 });
    }
  }
}
