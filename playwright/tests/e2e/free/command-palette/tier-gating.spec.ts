/**
 * Free • Command palette • tier gating. Every palette row whose destination is
 * a Premium feature checks `isPremiumTier` and drops out on free, rather than
 * offering a page that renders an upsell. This spec pins both halves on a free
 * session: the Premium rows are gone, and the rows free can use are still
 * there.
 *
 * Most of the gated rows are sub-items (Disk encryption under OS settings,
 * Calendar events under Integrations, …), and a collapsed parent renders no
 * sub-items at all, so their absence from the unfiltered list proves nothing.
 * Each is searched for instead: a search surfaces any matching sub-item whether
 * or not its parent is expanded. The first check searches for a free sub-item
 * and finds it, which is what makes the absences after it mean something.
 *
 * `Controls` is the one Pages row free deliberately drops while keeping its
 * group: the Controls landing tab is OS updates, a Premium page, so the row
 * would land a free user on an upsell, while the Controls group still lists
 * the free sub-pages (Fleet's own decision, `4d0c6285f2`).
 *
 * Free-only by nature; the premium side of the same gates is in
 * tests/e2e/premium/command-palette/.
 */
import { test, expect } from '@fixtures';
import { CommandPalette } from '@pages';

const ROOT_PLACEHOLDER = 'Search for a page or command...';

/** Premium rows, each with the query that would surface it if it rendered. */
const PREMIUM_ROWS: Array<{ query: string; label: string }> = [
  // Controls (premium sub-items and the premium Setup experience parent)
  { query: 'disk encryption', label: 'Disk encryption' },
  { query: 'assets', label: 'Assets' },
  { query: 'certificates', label: 'Certificates' },
  { query: 'passwords', label: 'Passwords' },
  { query: 'host names', label: 'Host names' },
  // Software
  { query: 'software library', label: 'Software library' },
  { query: 'self-service categories', label: 'Self-service categories' },
  { query: 'view software library', label: 'View software library' },
  { query: 'add fleet-maintained app', label: 'Add Fleet-maintained app' },
  { query: 'add vpp app', label: 'Add VPP app' },
  { query: 'add android app store app', label: 'Add Android app store app' },
  { query: 'add custom package', label: 'Add custom package' },
  { query: 'add self-service category', label: 'Add self-service category' },
  // Settings
  { query: 'fleets', label: 'Fleets' },
  { query: 'add fleet', label: 'Add fleet' },
  { query: 'calendar events', label: 'Calendar events' },
  { query: 'change management', label: 'Change management' },
  { query: 'conditional access', label: 'Conditional access' },
  { query: 'certificate authorities', label: 'Certificate authorities' },
  { query: 'user mapping', label: 'User mapping' },
  { query: 'single sign-on for end users', label: 'Single sign-on (SSO) for end users' },
  // MDM and Automations
  { query: 'apple business', label: 'Edit Apple Business (AB)' },
  { query: 'apple business', label: 'Add Apple Business (AB)' },
  { query: 'volume purchasing program', label: 'Edit Volume Purchasing Program (VPP)' },
  { query: 'volume purchasing program', label: 'Add Volume Purchasing Program (VPP)' },
  { query: 'microsoft graph', label: 'Edit Microsoft Graph' },
  { query: 'android zero-touch', label: 'Android zero-touch' },
  { query: 'host activity automations', label: 'Manage host activity automations' },
];

/** Rows free keeps that sit at the root of the unfiltered list. */
const FREE_ROOT_ROWS = [
  'OS settings',
  'Scripts',
  'Variables',
  'Vulnerabilities',
  'Add script',
  'Add custom variable',
  'Add label',
  'Add user',
  'Add API-only user',
];

/** Free Controls sub-pages, which render only when searched for or expanded. */
const FREE_CONTROLS_SUB_ITEMS = [
  'Configuration profiles',
  'Script library',
  'Script batch progress',
  'Global variables',
  'Custom host vitals',
];

test.describe('Free • Command palette • tier gating', () => {
  test('Premium rows are not offered, even when searched for', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    // The control: a free sub-item surfaces through a search, so a Premium
    // sub-item that rendered would surface the same way.
    await palette.search('configuration profiles');
    await expect(palette.item('Configuration profiles')).toBeVisible();

    for (const { query, label } of PREMIUM_ROWS) {
      await test.step(`"${query}" offers no ${label} row`, async () => {
        await palette.search(query);
        await expect(palette.input).toHaveValue(query);
        await expect(palette.item(label)).toHaveCount(0);
      });
    }
  });

  test('there is no fleet switcher, and its shortcut does nothing', async ({
    palette,
    dashboard,
    page,
  }) => {
    await dashboard.goto();

    // From closed: the switch-fleet shortcut opens nothing. The palette toggles
    // on Cmd/Ctrl+K, so had the first press opened it, `open()` would close it
    // and fail; opening cleanly is what proves the first press was ignored.
    await page.keyboard.press(`${CommandPalette.modifier}+Shift+F`);
    await expect(palette.dialog).toHaveCount(0);
    await palette.open();

    await expect(palette.item('Hosts')).toBeVisible();
    await expect(palette.fleetSwitcher).toHaveCount(0);

    // From open: the root page stays, rather than the switch-fleet sub-page.
    await page.keyboard.press(`${CommandPalette.modifier}+Shift+F`);
    await palette.search('hosts');
    await expect(palette.item('Hosts')).toBeVisible();
    await expect(palette.input).toHaveAttribute('placeholder', ROOT_PLACEHOLDER);
    await expect(palette.backButton).toBeHidden();
  });

  test('the rows free can use are offered', async ({ palette, dashboard }) => {
    await dashboard.goto();
    await palette.open();

    for (const label of FREE_ROOT_ROWS) {
      await expect(palette.item(label), `${label} should be offered on free`).toBeVisible();
    }
  });

  test('Controls drops its Pages row and its Premium tabs but keeps the free sub-pages', async ({
    palette,
    dashboard,
  }) => {
    await dashboard.goto();
    await palette.open();

    const pages = palette.group('Pages');
    await expect(pages.getByRole('option', { name: 'Hosts', exact: true })).toBeVisible();
    await expect(pages.getByRole('option', { name: 'Controls', exact: true })).toHaveCount(0);

    const controls = palette.group('Controls');
    for (const parent of ['OS settings', 'Scripts', 'Variables']) {
      await expect(
        controls.getByRole('option', { name: parent, exact: true }),
        `${parent} should be in the Controls group`,
      ).toBeVisible();
    }

    for (const subItem of FREE_CONTROLS_SUB_ITEMS) {
      await test.step(`${subItem} surfaces when searched for`, async () => {
        await palette.search(subItem.toLowerCase());
        await expect(palette.item(subItem)).toBeVisible();
      });
    }

    // The two Premium Controls tabs: OS updates (the landing tab the Pages row
    // would open) and Setup experience.
    for (const premiumTab of ['OS updates', 'Setup experience']) {
      await test.step(`${premiumTab} is not offered`, async () => {
        await palette.search(premiumTab.toLowerCase());
        await expect(palette.input).toHaveValue(premiumTab.toLowerCase());
        await expect(palette.item(premiumTab)).toHaveCount(0);
      });
    }
  });
});
