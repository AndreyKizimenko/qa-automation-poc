import { Page, Locator, expect } from '@playwright/test';

/**
 * The "Manage enroll secrets" modal. Reached from a fleet's settings page, and
 * — because the button there is itself gated in gitops mode — from the Hosts
 * page via `?manage_enroll_secrets=1`, which the router strips once the modal
 * is open.
 */
export class EnrollSecretModal {
  readonly page: Page;
  readonly modal: Locator;

  readonly addSecretButton: Locator;
  readonly editSecretButton: Locator;
  readonly deleteSecretButton: Locator;
  readonly copyButton: Locator;
  readonly showSecretButton: Locator;
  readonly doneButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Fleet's Modal renders a role-less container; the BEM modifier is what
    // separates this one from any other modal the host page can open. The
    // modal's own form carries the same base class, so the container class
    // comes along to keep the two apart.
    this.modal = page.locator('.enroll-secret-modal.modal__modal_container');

    this.addSecretButton = this.modal.getByRole('button', { name: 'Add secret' });
    this.editSecretButton = this.modal.getByRole('button', { name: 'Edit enroll secret' }).first();
    this.deleteSecretButton = this.modal
      .getByRole('button', { name: 'Delete enroll secret' })
      .first();
    this.copyButton = this.modal.getByRole('button', { name: 'Copy to clipboard' }).first();
    this.showSecretButton = this.modal.getByRole('button', { name: 'Show secret' }).first();
    this.doneButton = this.modal.getByRole('button', { name: 'Done' });
  }

  /**
   * Opens the modal over the Hosts page for `fleetId`. This entry point has no
   * gitops gate of its own, so it reaches the modal whatever the mode is set to.
   */
  async goto(fleetId: number): Promise<void> {
    await this.page.goto(`/hosts/manage?fleet_id=${fleetId}&manage_enroll_secrets=1`);
    await expect(this.modal).toBeVisible();
  }

  async close(): Promise<void> {
    await this.doneButton.click();
    await expect(this.modal).toBeHidden();
  }
}
