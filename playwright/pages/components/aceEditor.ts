import { Locator, expect } from '@playwright/test';

/**
 * Replaces the whole text of the Ace editor `editor` belongs to — the editor's
 * own element or anything inside it, such as its `.ace_content`.
 *
 * Writes through the Ace instance Fleet attaches to the editor element rather
 * than typing: typing goes through Ace's key handling, which auto-indents and
 * closes brackets and quotes, so a multi-line script comes out different from
 * what was typed. `setValue` with cursor position 1 puts the caret at the end.
 */
export async function setAceValue(editor: Locator, text: string): Promise<void> {
  await expect(editor).toBeVisible();
  await editor.evaluate((el, value) => {
    const aceEl = el.closest('.ace_editor');
    const ace = (aceEl as unknown as { env?: { editor?: { setValue: (v: string, c?: number) => void; focus: () => void } } } | null)
      ?.env?.editor;
    if (!ace) throw new Error('No Ace editor instance on this element');
    ace.focus();
    ace.setValue(value, 1);
  }, text);
}
