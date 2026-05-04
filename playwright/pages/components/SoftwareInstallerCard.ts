import { Page, Locator, expect } from '@playwright/test';

/**
 * `.software-installer-card` on `/software/titles/:id` — uploaded package
 * metadata plus hover-revealed Download + Delete actions.
 *
 * Action buttons are icon-only; first/last in DOM order map to
 * Download/Delete.
 */
export class SoftwareInstallerCard {
  readonly page: Page;
  readonly card: Locator;
  readonly actionButtons: Locator;
  readonly downloadButton: Locator;
  readonly deleteButton: Locator;
  readonly deleteModal: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.locator('.software-installer-card');
    this.actionButtons = this.card.locator('button.software-installer-card__action-btn');
    this.downloadButton = this.actionButtons.first();
    this.deleteButton = this.actionButtons.last();

    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete software' });
    // Exact match: the modal also contains a Cancel button.
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: /^delete$/i });
  }

  async download(): Promise<import('@playwright/test').Download> {
    await this.card.hover();
    const dl = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return dl;
  }

  async delete(): Promise<void> {
    await this.card.hover();
    await this.deleteButton.click();
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.card).toBeHidden();
  }
}
