import { Page, Locator, expect } from '@playwright/test';

/**
 * The modal behind the host details **User** card's *Add user* / *Edit user*
 * button: one *Username (IdP)* field and Save. Its title follows the button —
 * *Add user* when the host has no IdP username yet, *Edit user* once it has one.
 * Saving an empty field removes the username.
 *
 * On free the modal opens with the Fleet Premium message in place of the form
 * (`UpdateEndUserModal.tsx` → `PremiumFeatureMessage`), so `usernameInput` and
 * `saveButton` are absent there.
 *
 * Fleet's `Modal` renders no `role="dialog"`, so the container is scoped by the
 * component's own `update-end-user-modal` class.
 */
export class UpdateEndUserModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly usernameInput: Locator;
  readonly saveButton: Locator;
  readonly premiumMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.update-end-user-modal');
    this.usernameInput = this.modal.getByRole('textbox', { name: 'Username (IdP)' });
    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    this.premiumMessage = this.modal.getByText(/This feature is included in Fleet Premium/i);
  }

  /** The modal's title, which reads *Add user* or *Edit user*. */
  title(text: 'Add user' | 'Edit user'): Locator {
    return this.modal.getByText(text, { exact: true });
  }

  /** Fills the field (empty removes the username) and saves, waiting for the modal to close. */
  async saveUsername(username: string): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
    await this.usernameInput.fill(username);
    await this.saveButton.click();
    await expect(this.modal).toBeHidden();
  }
}
