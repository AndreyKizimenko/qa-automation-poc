/**
 * Command palette • commands. The Commands group's rows that act rather than
 * pick: the theme toggle, Sign out, and the create / run-live shortcuts that
 * land on a new-resource editor.
 *
 * The theme toggle is the palette's only row whose label is live state: it
 * reads "Switch to dark mode" or "Switch to light mode" from a theme the
 * palette tracks by listening for Fleet's `fleet-theme-change` event, so a
 * change made anywhere else in the app has to reach it without a reload. The
 * theme lives in the test's own browser context (localStorage and a `dark-mode`
 * class on <body>), so nothing here leaks into the stored auth state.
 *
 * Sign out ends the server-side session, so it runs on a session of its own,
 * signed in for the test the way `shared/auth/logout.spec.ts` does it: the
 * stored admin session is shared by every other test in the run.
 *
 * Tier-agnostic, hence a shared spec. Every row here renders for an admin at
 * premium's default All-fleets scope and on free alike, and none of their
 * destinations carries a fleet there.
 */
import { test, expect } from '@fixtures';
import { loginAsAdmin } from '@helpers/auth';
import { MyAccountPage } from '@pages';

const DARK_LABEL = 'Switch to dark mode';
const LIGHT_LABEL = 'Switch to light mode';

test.describe('Command palette • commands', () => {
  test('Switch to dark mode applies dark mode, closes the palette and flips its own label', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();
    const body = page.locator('body');
    await expect(body).not.toHaveClass(/dark-mode/);

    await palette.open();
    await palette.selectItem(DARK_LABEL);

    await expect(palette.dialog).toBeHidden();
    await expect(body).toHaveClass(/dark-mode/);

    await palette.open();
    await expect(palette.item(LIGHT_LABEL)).toBeVisible();
    await expect(palette.item(DARK_LABEL)).toHaveCount(0);
  });

  test('a theme change made in My account reaches the palette label without a reload', async ({
    palette,
    page,
  }) => {
    const myAccount = new MyAccountPage(page);
    await myAccount.goto();
    await myAccount.selectTheme('Light');

    await palette.open();
    await expect(palette.item(DARK_LABEL)).toBeVisible();
    await palette.toggleClosed();

    // A marker on `window` survives only as long as the document does, so its
    // presence at the end proves the label came from the live event, not from a
    // fresh load reading the stored theme.
    await page.evaluate(() => {
      (window as unknown as { pwNoReload?: boolean }).pwNoReload = true;
    });
    await myAccount.selectTheme('Dark');

    await palette.open();
    await expect(palette.item(LIGHT_LABEL)).toBeVisible();
    await expect(palette.item(DARK_LABEL)).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { pwNoReload?: boolean }).pwNoReload),
      'the page reloaded, so the label change proves nothing about the live listener',
    ).toBe(true);
  });

  // `Run live report` and `Run live policy` open the same editors as `Add
  // report` and `Add policy`: a live run starts from an unsaved report or
  // policy. Each row is checked on its own, since each is its own item.
  const NEW_RESOURCE_COMMANDS = [
    { label: 'Add report', path: /\/reports\/new$/, editor: 'report' },
    { label: 'Run live report', path: /\/reports\/new$/, editor: 'report' },
    { label: 'Add policy', path: /\/policies\/new$/, editor: 'policy' },
    { label: 'Run live policy', path: /\/policies\/new$/, editor: 'policy' },
    { label: 'Add label', path: /\/labels\/new$/, editor: 'label' },
  ] as const;

  for (const { label, path, editor } of NEW_RESOURCE_COMMANDS) {
    test(`${label} lands on the new-${editor} editor`, async ({
      palette,
      dashboard,
      reportEdit,
      policyEdit,
      labelsPage,
      page,
    }) => {
      await dashboard.goto();
      await palette.open();
      await palette.selectItem(label);

      await expect(palette.dialog).toBeHidden();
      await expect(page).toHaveURL(path);
      const editorReady = {
        report: reportEdit.editorContent,
        policy: policyEdit.editorContent,
        label: labelsPage.nameInput,
      }[editor];
      await expect(editorReady).toBeVisible();
    });
  }
});

test.describe('Command palette • Sign out', () => {
  // A blank session of the test's own: signing out ends the server-side
  // session, which would sign out every other test sharing the stored one.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Sign out ends the session and lands on the login page', async ({
    palette,
    dashboard,
    loginPage,
    page,
    pageHealth,
  }) => {
    // Requests already in flight when the session ends come back 401, which
    // is the expected aftermath of signing out rather than a regression.
    pageHealth.disable();

    await loginAsAdmin(page, process.env.FLEET_ADMIN_EMAIL!, process.env.FLEET_ADMIN_PASSWORD!);
    await dashboard.goto();

    await palette.open();
    await palette.selectItem('Sign out');

    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.loginButton).toBeVisible();

    // The session is gone, not just the page: an authenticated route sends
    // the browser back to the login form.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
