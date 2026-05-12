import { Locator } from '@playwright/test';

/**
 * Click an action icon (download, trash, refetch, ...) that's only visible
 * while its parent row / card is hovered. Fleet renders these icons
 * `display: none` until `:hover` is set on the parent; a straightforward
 * `parent.hover()` + `icon.click()` can lose the hover state mid-click
 * (Playwright's auto-scroll moves the pointer, or React re-renders the
 * row and Playwright's retry lands when the row is no longer hovered),
 * leaving the icon hidden and the click timing out.
 *
 * Re-hovers between retries so a transient loss of hover state recovers.
 * Falls back to `dispatchEvent('click')` on the last attempt — the icon
 * is in the DOM (we just resolved it), so dispatching the click event
 * directly is safe and bypasses the visibility check.
 */
export async function clickHoverAction(parent: Locator, icon: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await parent.hover();
    try {
      await icon.click({ timeout: 3000 });
      return;
    } catch {
      if (attempt === 2) {
        await icon.dispatchEvent('click');
        return;
      }
    }
  }
}
