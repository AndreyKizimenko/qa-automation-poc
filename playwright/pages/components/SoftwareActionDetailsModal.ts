import { Page, Locator, expect } from '@playwright/test';

/**
 * The result of one software install or uninstall on a host — raised by the
 * host Library's Status button and by the matching Activity item. Fleet renders
 * each kind in its own modal (`SoftwareInstallDetailsModal`,
 * `SoftwareUninstallDetailsModal`) with the same layout: a status sentence naming
 * the title, the package and the host, and a **Details** toggle that reveals the
 * script output the host reported.
 *
 * Neither modal has a dialog role, and the status line and output carry no role
 * or label, so both are reached through the modal's own classes.
 */
class SoftwareActionDetailsModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly statusMessage: Locator;
  readonly detailsButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page, modalClass: string) {
    this.page = page;
    this.modal = page.locator(`.${modalClass}`);
    this.statusMessage = this.modal.locator('.icon-status-message__content');
    this.detailsButton = this.modal.getByRole('button', { name: 'Details' });
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.statusMessage).toBeVisible();
  }

  /** The output the host recorded, revealed by the Details toggle. */
  async revealOutput(): Promise<Locator> {
    await this.detailsButton.click();
    const output = this.modal.locator('.textarea');
    await expect(output.first()).toBeVisible();
    return output;
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}

/** "Install details": `Fleet installed <title> (<package>) on <host> (<when>).` */
export class InstallDetailsModal extends SoftwareActionDetailsModal {
  constructor(page: Page) {
    super(page, 'software-install-details-modal');
  }
}

/** "Uninstall details": `Fleet uninstalled <title> from <host> (<when>).` */
export class UninstallDetailsModal extends SoftwareActionDetailsModal {
  constructor(page: Page) {
    super(page, 'software-uninstall-details-modal');
  }
}
