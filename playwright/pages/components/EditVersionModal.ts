import { Page, Locator, expect } from '@playwright/test';
import { getAceValue, setAceValue } from './aceEditor';
import { Toast } from './Toast';

/**
 * The "Edit version" modal on a multi-version App Store title's detail page —
 * an iOS / iPadOS VPP app or an Android Play Store app (Fleet's
 * `EditVersionModal`), opened from a Library row's "Edit version" icon. It
 * edits one version: its Name, its target, and an Ace editor holding the app's
 * managed configuration — JSON for an Android app, an XML `<dict>` for iOS /
 * iPadOS.
 *
 * The browser checks only that Android JSON parses; what the keys may be is
 * Fleet's to decide, so a well-formed configuration Fleet refuses comes back as
 * a generic "Couldn't update. Please try again." toast (the server's reason
 * rides only in the response) and the modal stays open. A saved Android
 * configuration reopens as Fleet re-serialises it, tab indented, so compare it
 * parsed rather than as text.
 */
export class EditVersionModal {
  readonly page: Page;
  readonly toast: Toast;
  readonly modal: Locator;
  readonly editor: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    // Fleet's Modal renders no role="dialog"; the component's BEM root is unique.
    this.modal = page.locator('.edit-version-modal');
    // Ace's own root element; the "Configuration" label isn't associated with it.
    this.editor = this.modal.locator('.ace_editor');
    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel', exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.editor).toBeVisible();
  }

  async value(): Promise<string> {
    return getAceValue(this.editor);
  }

  async fill(text: string): Promise<void> {
    await setAceValue(this.editor, text);
  }

  /** Saves, and waits for Fleet's "Successfully updated <version>." toast and the modal to close. */
  async save(): Promise<void> {
    await this.toast.dismissAll();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.toast.expectSuccess(/^Successfully updated /);
    await expect(this.modal).toBeHidden();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.modal).toBeHidden();
  }
}
