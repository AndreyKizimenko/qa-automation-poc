import { Page, Locator, expect } from '@playwright/test';

/**
 * The **Recovery Lock password** modal, from a Mac's Actions → *Show Recovery
 * Lock password*. It shows the host's escrowed password in a masked, read-only
 * field with *Show secret* / copy buttons, a banner saying when Fleet will
 * rotate it on its own (*Password rotates automatically after …* — viewing it
 * schedules that, an hour out), *Close*, and *Rotate password*.
 *
 * Opening it is a read of the password: Fleet records a "viewed" activity and
 * schedules the automatic rotation each time, so open it only when the test
 * means to view it.
 *
 * Fleet's `Modal` renders no `role="dialog"`, so the container is scoped by the
 * component's `recovery-lock-password-modal` class. The password field has no
 * label and is a `type="password"` input (no `textbox` role until revealed); it
 * is the modal's only input.
 */
export class RecoveryLockPasswordModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly passwordInput: Locator;
  readonly showSecretButton: Locator;
  readonly autoRotateBanner: Locator;
  readonly rotateButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.recovery-lock-password-modal');
    this.passwordInput = this.modal.locator('input');
    this.showSecretButton = this.modal.getByRole('button', { name: 'Show secret' });
    this.autoRotateBanner = this.modal.getByText(/^Password rotates automatically after /);
    this.rotateButton = this.modal.getByRole('button', { name: /Rotate password$/ });
    this.closeButton = this.modal.getByRole('button', { name: 'Close', exact: true });
  }

  /** Reveals the password and returns it, checking it's really shown unmasked. */
  async revealPassword(): Promise<string> {
    await expect(this.passwordInput).toHaveAttribute('type', 'password');
    await this.showSecretButton.click();
    await expect(this.passwordInput).toHaveAttribute('type', 'text');
    await expect(this.passwordInput, 'the revealed Recovery Lock password').not.toHaveValue('');
    return this.passwordInput.inputValue();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
