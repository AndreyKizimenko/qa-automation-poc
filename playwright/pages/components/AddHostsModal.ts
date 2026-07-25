import { Page, Locator, expect, Download } from '@playwright/test';

/**
 * Fleet's "Add hosts" modal (AddHostsModal → PlatformWrapper). The Advanced tab
 * exposes the Fleet certificate download; the "Plain osquery" reveal then adds
 * the enroll-secret and flagfile downloads.
 *
 * All three download controls are Buttons whose accessible name is just
 * "Download" (with a decorative download icon), so the enroll-secret and
 * flagfile ones are scoped by their role-less PlatformWrapper section wrappers
 * (no role/text alternative), and the certificate button by its own class.
 * Downloads fire via FileSaver (a real browser download event, captured by
 * `page.waitForEvent('download')`).
 */
export class AddHostsModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly advancedTab: Locator;
  readonly plainOsqueryButton: Locator;
  readonly certificateDownload: Locator;
  readonly enrollSecretDownload: Locator;
  readonly flagfileDownload: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.add-hosts-modal');
    this.advancedTab = this.modal.getByRole('tab', { name: 'Advanced' });
    this.plainOsqueryButton = this.modal.getByRole('button', { name: 'Plain osquery' });
    // Dedicated class. Once "Plain osquery" is expanded this appears twice
    // (tooltip + plain variants), so download the cert before expanding.
    this.certificateDownload = this.modal
      .locator('.platform-wrapper__fleet-certificate-download')
      .first();
    // These two Download buttons share the "Download" accessible name, so scope
    // each to its role-less section wrapper.
    this.enrollSecretDownload = this.modal
      .locator('.platform-wrapper__advanced--enroll-secrets')
      .getByRole('button', { name: 'Download' });
    this.flagfileDownload = this.modal
      .locator('.platform-wrapper__advanced--flagfile')
      .getByRole('button', { name: 'Download' });
  }

  /** Opens the Advanced tab; the Fleet certificate download renders there. */
  async openAdvanced(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await this.advancedTab.click();
    await expect(this.certificateDownload).toBeVisible();
  }

  /** Reveals the enroll-secret + flagfile downloads (Plain osquery section). */
  async revealPlainOsquery(): Promise<void> {
    await this.plainOsqueryButton.click();
    await expect(this.enrollSecretDownload).toBeVisible();
  }

  private async clickDownload(button: Locator): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await button.click();
    return downloadPromise;
  }

  downloadCertificate(): Promise<Download> {
    return this.clickDownload(this.certificateDownload);
  }

  downloadEnrollSecret(): Promise<Download> {
    return this.clickDownload(this.enrollSecretDownload);
  }

  downloadFlagfile(): Promise<Download> {
    return this.clickDownload(this.flagfileDownload);
  }
}
