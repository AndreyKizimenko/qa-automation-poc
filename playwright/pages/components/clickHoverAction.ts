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
 * On the last attempt it re-hovers and force-clicks: that skips the
 * stability / hit-target re-checks the hover loss trips, while still
 * clicking the real element at its position — so a control that never
 * actually renders surfaces as a failure rather than passing silently.
 */
export async function clickHoverAction(parent: Locator, icon: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await parent.hover();
    try {
      await icon.click({ timeout: 3000 });
      return;
    } catch {
      if (attempt === 2) {
        await parent.hover();
        // eslint-disable-next-line playwright/no-force-option -- last-resort recovery for the hover-loss flake; the element is re-hovered immediately above so a real control is clicked.
        await icon.click({ force: true, timeout: 3000 });
        return;
      }
    }
  }
}
