import { Page, Locator, expect } from '@playwright/test';
import { normalizeScript } from './EditSoftwareModal';

/**
 * A library script's content, read-only — Fleet's `ScriptDetailsModal`
 * (`pages/hosts/components/ScriptDetailsModal`), which a batch run's details
 * page opens from **Show script**. Not to be confused with this suite's
 * `ScriptDetailsModal` component, which is one *execution's* result (Fleet's
 * `RunScriptDetailsModal`).
 *
 * Opened from a batch, it is titled "Script details" (not the script's name),
 * shows the content in a code box under "Script content:", and has no footer:
 * the header's ✕ is the only way out. Fleet's `Modal` has no dialog role, the
 * code box is a styled `div` rather than a form control, and the ✕ is an icon
 * with no accessible name, so all three are reached through the modal's
 * classes: the ✕ as its header's only button.
 */
export class ScriptPreviewModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly title: Locator;
  readonly content: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('.script-details-modal');
    this.title = this.modal.locator('.modal__header');
    this.content = this.modal.locator('.textarea--code');
    this.closeButton = this.title.getByRole('button');
  }

  async expectOpen(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.title).toHaveText('Script details');
    await expect(this.modal.getByText('Script content:')).toBeVisible();
  }

  /**
   * The script as shown, normalised with {@link normalizeScript} (trailing
   * whitespace and blank lines dropped) so it compares to the uploaded content.
   */
  async scriptText(): Promise<string> {
    await expect(this.content).toBeVisible();
    return normalizeScript(await this.content.innerText());
  }

  /** Waits for the shown script to equal `content`, both normalised. */
  async expectContent(content: string): Promise<void> {
    await expect.poll(() => this.scriptText()).toBe(normalizeScript(content));
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).toBeHidden();
  }
}
