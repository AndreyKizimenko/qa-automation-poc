import { Page, Locator, expect } from '@playwright/test';
import { Toast } from '../components/Toast';

/**
 * `/account` — My Account page. Hosts the email/name/position form on the
 * left (Fleet's `UserSettingsForm`) and a side panel rendering the user's
 * Fleets (premium only), Role, and Change-password / Get-API-token
 * triggers (Fleet's `AccountSidePanel`).
 *
 * Locator notes:
 *   - UserSettingsForm renders inputs without placeholders, so each field
 *     is anchored on its `<label>` text via `getByLabel`. The email label
 *     wraps a tooltip span but the visible "Email (required)" text still
 *     reaches the input via `for=`.
 *   - Side-panel rows are `<div class="data-set"><dt>title</dt><dd>value</dd></div>`,
 *     so each value is scoped via the title-filtered DataSet container.
 *   - The Change-password modal anchors on the shared `.modal__modal_container`
 *     class filtered by the modal title — same pattern other settings POMs use.
 */
export class MyAccountPage {
  readonly page: Page;
  readonly toast: Toast;

  readonly heading: Locator;

  // Settings form
  readonly emailInput: Locator;
  readonly fullNameInput: Locator;
  readonly positionInput: Locator;
  readonly updateButton: Locator;

  // Side panel — DataSet rows. `fleetsValue` is rendered only on premium.
  readonly fleetsValue: Locator;
  readonly roleValue: Locator;
  readonly changePasswordButton: Locator;
  readonly getApiTokenButton: Locator;

  // Change-password modal
  readonly changePasswordModal: Locator;
  readonly oldPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly newPasswordConfirmationInput: Locator;
  readonly changePasswordSubmit: Locator;
  readonly changePasswordCancel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);

    this.heading = page.getByRole('heading', { name: 'My account', level: 1 });

    this.emailInput = page.getByLabel(/^Email/);
    this.fullNameInput = page.getByLabel(/^Full name/);
    this.positionInput = page.getByLabel(/^Position/);
    this.updateButton = page.getByRole('button', { name: 'Update' });

    // DataSet rows live inside the AccountSidePanel; filter by visible title
    // text and reach into the `<dd>` value cell.
    const dataSet = (title: string): Locator =>
      page.locator('.data-set').filter({ hasText: title }).locator('dd');
    this.fleetsValue = dataSet('Fleets');
    this.roleValue = dataSet('Role');

    // Side-panel trigger sits inside the "Password" DataSet — scoping this
    // way avoids a strict-mode collision with the same-labelled submit
    // button rendered inside the change-password modal.
    this.changePasswordButton = dataSet('Password').getByRole('button', { name: 'Change password' });
    this.getApiTokenButton = page.getByRole('button', { name: 'Get API token' });

    // Fleet's Modal component doesn't set role="dialog", so the modal is
    // anchored on the shared class filtered by header text.
    this.changePasswordModal = page
      .locator('.modal__modal_container')
      .filter({ hasText: 'Change password' });
    this.oldPasswordInput = this.changePasswordModal.getByLabel('Original password');
    this.newPasswordInput = this.changePasswordModal.getByLabel('New password', { exact: true });
    this.newPasswordConfirmationInput = this.changePasswordModal.getByLabel(
      'New password confirmation',
    );
    this.changePasswordSubmit = this.changePasswordModal.getByRole('button', {
      name: 'Change password',
    });
    this.changePasswordCancel = this.changePasswordModal.getByRole('button', { name: 'Cancel' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/account');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Open the change-password modal from the side panel and wait for the
   * form to render.
   */
  async openChangePassword(): Promise<void> {
    await this.changePasswordButton.click();
    await expect(this.changePasswordModal).toBeVisible();
    await expect(this.oldPasswordInput).toBeVisible();
  }

  /**
   * Submit the change-password modal with the three field values.
   */
  async submitChangePassword(
    oldPassword: string,
    newPassword: string,
    confirmation = newPassword,
  ): Promise<void> {
    await this.oldPasswordInput.fill(oldPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.newPasswordConfirmationInput.fill(confirmation);
    await this.changePasswordSubmit.click();
  }
}
