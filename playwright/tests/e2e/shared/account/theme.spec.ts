/**
 * Account • Theme picker. Fleet applies the chosen theme client-side as a
 * `dark-mode` class on <body> and persists the choice in localStorage
 * (`fleet-theme`), so the selection survives a reload. Theme is tier-agnostic
 * (the picker renders on free and premium alike), hence a shared spec. Driven
 * as the admin: the theme lives in the per-test browser context's
 * localStorage, so it can't leak into the shared auth state or other specs.
 *
 * "System" is the default and stores nothing: Fleet resolves it from the OS's
 * `prefers-color-scheme`, and follows OS changes live — but only while System
 * is selected. Light or Dark, once picked, ignores the OS (`initTheme` in
 * frontend/utilities/theme.ts). `page.emulateMedia` plays the OS, and Chromium
 * fires the media-query change Fleet listens for.
 *
 * Light under a light OS would prove nothing, so Light is picked while the OS
 * is dark.
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

  test('System follows the OS colour scheme live, and Light pins the theme against it', async ({ page }) => {
    const body = page.locator('body');
    const myAccount = new MyAccountPage(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await myAccount.goto();

    await myAccount.selectTheme('System');
    await expect(body).not.toHaveClass(/dark-mode/);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(body, 'System follows the OS into dark').toHaveClass(/dark-mode/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(body, 'System follows the OS back to light').not.toHaveClass(/dark-mode/);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(body).toHaveClass(/dark-mode/);
    await myAccount.selectTheme('Light');
    await expect(body, 'Light overrides a dark OS').not.toHaveClass(/dark-mode/);

    await page.reload();
    await expect(myAccount.heading).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
    await expect(body, 'Light survives a reload under a dark OS').not.toHaveClass(/dark-mode/);
  });
});
