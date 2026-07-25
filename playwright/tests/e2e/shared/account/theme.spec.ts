/**
 * Account • Theme picker. Fleet applies the chosen theme client-side as a
 * `dark-mode` class on <body> and persists the choice in localStorage, so the
 * selection survives a reload. Theme is tier-agnostic (the picker renders on
 * free and premium alike), hence a shared spec. Driven as the admin: the theme
 * lives in the per-test browser context's localStorage, so it can't leak into
 * the shared auth state or other specs.
 */
import { test, expect } from '@fixtures';
import { MyAccountPage } from '@pages';

test.describe('Account • theme', () => {
  test('selecting Dark applies dark mode and persists across reload', async ({ page }) => {
    const myAccount = new MyAccountPage(page);
    await myAccount.goto();

    await myAccount.selectTheme('Dark');
    await expect(page.locator('body')).toHaveClass(/dark-mode/);

    await page.reload();
    await expect(myAccount.heading).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
  });
});
