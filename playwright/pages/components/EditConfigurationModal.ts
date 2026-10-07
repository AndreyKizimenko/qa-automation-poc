import { Page, Locator, expect } from '@playwright/test';
import { getAceValue, setAceValue } from './aceEditor';
import { Toast } from './Toast';

/**
 * The "Edit configuration" modal on an App Store or Play Store title's detail
 * page (Fleet's `EditConfigurationModal`), opened from the Actions menu. One
 * Ace editor holds the app's managed configuration: JSON for an Android app,
 * an XML `<dict>` for iOS / iPadOS.
 *
 * The browser checks only that the text parses (Save is disabled while it
 * doesn't); what the keys may be is Fleet's to decide, so a well-formed
 * configuration Fleet refuses comes back as an error toast and the modal stays
 * open. A saved Android configuration reopens as Fleet re-serialises it, tab
 * indented, so compare it parsed rather than as text.
 */
export class EditConfigurationModal {
  readonly page: Page;
  readonly toast: Toast;
  readonly modal: Locator;
  readonly editor: Locator;
  readonly saveButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toast = new Toast(page);
    // Fleet's Modal renders no role="dialog"; the component's BEM root is unique.
    this.modal = page.locator('.edit-configuration-modal');
    // Ace's own root element; the label "Configuration" isn't associated with it.
    this.editor = this.modal.locator('.ace_editor');
    this.saveButton = this.modal.getByRole('button', { name: 'Save', exact: true });
    // The header's close control is an icon-only button; Fleet's Icon tags it.
    this.closeButton = this.modal.getByTestId('close-icon');
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

  /** Saves, and waits for Fleet's "<name> configuration updated." toast and the modal to close. */
  async save(): Promise<void> {
    await this.toast.dismissAll();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.toast.expectSuccess(/configuration updated\./);
    await expect(this.modal).toBeHidden();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
