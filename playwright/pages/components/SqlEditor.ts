import { Locator, Page, expect } from '@playwright/test';
import { setAceValue } from './aceEditor';

/**
 * The editable SQL editor on a report's or a policy's form: Fleet's
 * `SQLEditor`, a `.sql-editor` wrapper around Ace.
 *
 * Those pages also render a read-only SQL example in the schema sidebar with
 * the same wrapper, and render order decides which comes first, so the editor
 * is the one whose hidden `textarea.ace_text-input` isn't `readonly`.
 */
export class SqlEditor {
  readonly root: Locator;
  /** The rendered code: the visible lines only, split into token spans. */
  readonly content: Locator;
  readonly textarea: Locator;

  constructor(page: Page) {
    this.root = page.locator('.sql-editor').filter({
      has: page.locator('textarea.ace_text-input:not([readonly])'),
    });
    this.content = this.root.locator('.ace_content');
    this.textarea = this.root.locator('textarea.ace_text-input');
  }

  /**
   * Replaces the SQL through the Ace instance (`setAceValue`) and waits until
   * the editor shows it. Typing into the hidden textarea goes through Ace's
   * key handling, which in SQL mode can add a second `;`, and clicking the
   * content can land on whatever sits over it below the fold.
   */
  async set(sql: string): Promise<void> {
    await setAceValue(this.content, sql);
    await expect(this.content).toHaveText(sql);
  }

  /** The SQL the editor shows, trimmed. */
  async text(): Promise<string> {
    return (await this.content.innerText()).trim();
  }
}
