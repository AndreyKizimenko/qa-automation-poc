import { Page, Locator, expect } from '@playwright/test';
import { clickHoverAction } from './clickHoverAction';

/**
 * `.software-installer-card` on `/software/titles/:id` — uploaded package
 * metadata plus hover-revealed Download + Delete actions.
 *
 * Action buttons are icon-only. Each Download/Delete handle is identified by
 * the icon its `Icon` component stamps (`data-testid="download-icon"` /
 * `"trash-icon"`), which holds whether the card shows both buttons
 * (package / Fleet-maintained) or Delete only (VPP / Android app-store).
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
    this.downloadButton = this.card.locator('button.software-installer-card__action-btn', {
      has: page.getByTestId('download-icon'),
    });
    this.deleteButton = this.card.locator('button.software-installer-card__action-btn', {
      has: page.getByTestId('trash-icon'),
    });

    this.deleteModal = page.locator('.modal__modal_container').filter({ hasText: 'Delete software' });
    // Exact match: the modal also contains a Cancel button.
    this.deleteConfirmButton = this.deleteModal.getByRole('button', { name: /^delete$/i });
  }

  async download(): Promise<import('@playwright/test').Download> {
    const dl = this.page.waitForEvent('download');
    await clickHoverAction(this.card, this.downloadButton);
    return dl;
  }

  async delete(): Promise<void> {
    await clickHoverAction(this.card, this.deleteButton);
    await expect(this.deleteModal).toBeVisible();
    await this.deleteConfirmButton.click();
    await expect(this.card).toBeHidden();
  }
}
