import { Page, Locator, expect } from '@playwright/test';
import { fleetModal } from '../components/Modal';
import { Toast } from '../components/Toast';

/**
 * /device/:token — the end user's own page for one host, "My device". A global admin reaches a real host's
 * from Host details (`HostDetailsPage.openMyDevice`), which opens it in a new window and logs a "retrieved the
 * My device URL" activity, so this object wraps that window's page.
 *
 * Its disk-encryption banner is the only way to ask a Linux host for its key: *Create key* queues the escrow,
 * and fleetd acts on it at its next check-in (`DeviceUserBanners.tsx`). The banner is yellow and role-less, so
 * it is matched by its text.
 */
export class MyDevicePage {
  readonly page: Page;
  readonly heading: Locator;
  /** *Create key* refused by the server says so in a toast, and its modal closes. */
  readonly toast: Toast;
  /** "Disk encryption: Create a new disk encryption key…", shown while a Linux host's key isn't escrowed. */
  readonly createKeyBanner: Locator;
  readonly createKeyButton: Locator;
  /**
   * Raised by *Create key*. Its body is the instructions for the passphrase prompt, or, while fleetd reports
   * the prompt open, "Fleet is already asking this device for a disk encryption key" (`CreateLinuxKeyModal.tsx`).
   */
  readonly createKeyModal: Locator;
  /** The ordinary body's instructions for the passphrase prompt, as opposed to the in-flight one. */
  readonly createKeyInstructions: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My device', level: 1 });
    this.toast = new Toast(page);
    this.createKeyBanner = page.getByText(/^Disk encryption: Create a new disk encryption key/);
    this.createKeyButton = page.getByRole('button', { name: 'Create key' });
    this.createKeyModal = fleetModal(page, 'Create key');
    this.createKeyInstructions = this.createKeyModal.getByText('If a pop-up appears asking for your passphrase');
  }

  /**
   * Clicks *Create key* and waits for its modal to finish loading. The modal opens at once, in a loading state,
   * and closes again if the server refuses the click, with a toast that says so: that ends this with the toast's
   * text, where a later click on the closed modal would wait out the test. A spec that expects the refusal
   * clicks `createKeyButton` itself.
   */
  async createKey(): Promise<void> {
    await this.createKeyButton.click();
    const close = this.createKeyModal.getByRole('button', { name: 'Close' });
    await expect(close.or(this.toast.error)).toBeVisible();
    if (await this.toast.error.isVisible()) {
      throw new Error(`[MyDevicePage.createKey] the server refused Create key: ${await this.toast.error.innerText()}`);
    }
  }

  async closeCreateKeyModal(): Promise<void> {
    await this.createKeyModal.getByRole('button', { name: 'Close' }).click();
    await expect(this.createKeyModal).toBeHidden();
  }
}
