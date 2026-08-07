/**
 * Command palette • open and close. Fleet spotlight is rendered by
 * `CoreLayout`, so the Cmd/Ctrl+K shortcut answers on every authenticated page
 * and the palette is absent from the login screen, which renders outside that
 * layout. This spec covers the dialog's open/close mechanics only — shortcut
 * toggle, Escape, overlay click, per-page availability, the state reset on
 * reopen, the dialog's accessible name, and the platform-native modifier
 * requirement. Filtering, navigation and the pickers have their own specs.
 *
 * Tier-agnostic, hence a shared spec. Premium lands on the "All fleets" scope
 * by default, where the Controls entry and the software-add commands don't
 * render, so the row assertions stay on items both tiers show in that scope.
 * The premium-only fleet switcher — its label and its `⌘ ⇧ F` pills — belongs
 * to tests/e2e/premium/command-palette/.
 */
import { test, expect } from '@fixtures';
import { withCleanContext } from '@helpers/auth';
import { CommandPalette, LoginPage } from '@pages';

test.describe('Command palette • open and close', () => {
  test('Cmd/Ctrl+K opens the palette on a focused, empty input', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();

    await palette.open();

    await expect(palette.input).toBeFocused();
    await expect(palette.input).toHaveValue('');
    await expect(palette.input).toHaveAttribute(
      'placeholder',
      'Search for a page or command...',
    );
    await expect(palette.list).toBeVisible();
  });

  test('Cmd/Ctrl+K again closes the palette', async ({ palette, dashboard, page }) => {
    await dashboard.goto();
    await palette.open();

    await palette.toggleClosed();

    await expect(palette.dialog).toBeHidden();
    // The backdrop is torn down with the dialog; a lingering overlay would
    // swallow every subsequent click on the page underneath.
    await expect(palette.overlay).toBeHidden();
    // Closing is a dismissal, not a navigation.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Escape on the root page closes the palette', async ({ palette, dashboard, page }) => {
    await dashboard.goto();
    await palette.open();

    await page.keyboard.press('Escape');

    await expect(palette.dialog).toBeHidden();
    await expect(palette.overlay).toBeHidden();
  });

  test('clicking the overlay closes the palette', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    await palette.clickOverlay();

    await expect(palette.dialog).toBeHidden();
    await expect(palette.overlay).toBeHidden();
  });

  test('opens from every top-level page', async ({
    palette,
    hostsList,
    softwareTitles,
    reportsList,
    policiesList,
    usersPage,
  }) => {
    // The palette is mounted by CoreLayout rather than by any single route, so
    // these pages are launch points; each `goto()` anchors on its own page's
    // ready state before the shortcut is pressed.
    const launchPoints = [
      { name: 'Hosts', goto: () => hostsList.goto() },
      { name: 'Software', goto: () => softwareTitles.goto() },
      { name: 'Reports', goto: () => reportsList.goto() },
      { name: 'Policies', goto: () => policiesList.goto() },
      { name: 'Settings → Users', goto: () => usersPage.goto() },
    ];

    for (const launchPoint of launchPoints) {
      await test.step(`opens from ${launchPoint.name}`, async () => {
        await launchPoint.goto();
        await palette.open();

        // A rendered row proves the list built, not just that the shell opened.
        await expect(palette.item('Hosts')).toBeVisible();

        await palette.toggleClosed();
      });
    }
  });

  // The `palette` fixture is bound to the authenticated `page`, so this test
  // builds its own against the session-less context it creates.
  test('does not open on the login page', async ({ browser, pageHealth }) => {
    // Loading /login without a session runs Fleet's unauthenticated bootstrap
    // probes, whose console noise this test provokes on purpose.
    pageHealth.disable();

    // The context has to be genuinely session-less: `browser.newContext()`
    // inherits the project's `use.storageState`, and Fleet redirects an
    // authenticated visitor from /login to the dashboard, where CoreLayout does
    // mount the palette. withCleanContext supplies the empty-storage override.
    await withCleanContext(browser, async (freshPage) => {
      const loginPage = new LoginPage(freshPage);
      const palette = new CommandPalette(freshPage);

      await loginPage.goto();
      await freshPage.keyboard.press(`${CommandPalette.modifier}+k`);

      // Settling on the login form gives the app the chance to mount a dialog
      // before its absence is asserted.
      await expect(loginPage.loginButton).toBeVisible();
      await expect(palette.dialog).toHaveCount(0);
      await expect(freshPage).toHaveURL(/\/login/);
    });
  });

  test('reopening clears the search and collapses expanded sub-items', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    // The chevron renders only while browsing — an active search always reveals
    // matching sub-items — so expand before typing.
    await palette.expandToggle('Organization settings').click();
    await expect(palette.item('Organization info')).toBeVisible();

    await palette.search('organization');
    await expect(palette.input).toHaveValue('organization');

    await palette.toggleClosed();
    await palette.open();

    await expect(palette.input).toHaveValue('');
    await expect(palette.item('Organization settings')).toBeVisible();
    await expect(palette.item('Organization info')).toBeHidden();
  });

  test('the dialog exposes its accessible name and cmdk ARIA wiring', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    // The name is a literal aria-label on the dialog, which is what keeps every
    // other palette locator addressable by role and name.
    await expect(palette.dialog).toHaveAttribute('aria-label', 'Command palette');
    await expect(palette.dialog.getByRole('combobox')).toHaveCount(1);
    await expect(palette.list).toHaveAttribute('aria-label', 'Suggestions');
  });

  test('Tab keeps focus inside the dialog', async ({ palette, dashboard, page }) => {
    await dashboard.goto();
    await palette.open();

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
    }

    // Containment rather than a named element: the dialog's tab order differs
    // per tier because the fleet switcher button renders on premium only, so
    // "focus is somewhere in the dialog" is the assertion that holds on both.
    await expect
      .poll(() => palette.dialog.evaluate((d) => d.contains(document.activeElement)), {
        message: 'expected Tab to keep focus trapped inside the palette dialog',
      })
      .toBe(true);
    await expect(palette.dialog).toBeVisible();
  });

  test('the non-native modifier is ignored', async ({ palette, dashboard, page }) => {
    await dashboard.goto();

    await page.keyboard.press(`${CommandPalette.wrongModifier}+k`);
    await expect(palette.dialog).toHaveCount(0);

    // The shortcut toggles, so a palette that the wrong modifier had opened
    // would be closed by the native press instead of opened. The palette coming
    // up here is what proves the first press did nothing.
    await palette.open();
  });
});
