/**
 * Command palette • role access. The palette builds its item list from the
 * signed-in user's role flags in Fleet's app context, and each group gates on
 * its own flag: Settings and MDM on global admin, the Automations rows on admin
 * roles, the write Commands on any writer, Controls on admins, maintainers and
 * technicians. A wrong flag there either hides a page the user can use or —
 * the worse half — offers one that greets them with a permission error.
 *
 * Driven with the static users through `withStaticUser`, as the other
 * role-access specs are, from the dashboard each time.
 *
 * Tier-agnostic, hence a shared spec: at premium's default All-fleets scope a
 * global role sees the same groups and rows as on free. The one difference,
 * the Controls group and `Add script`, which free shows everywhere and premium
 * only inside a fleet, is asserted in each tier's own role-access spec.
 *
 * Absence checks are anchored: every one of them follows an assertion that the
 * list rendered rows for this user, so an empty or unbuilt list can't pass
 * them.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { CommandPalette, DashboardPage } from '@pages';

/** Opens the palette on the dashboard of the page's signed-in user. */
async function openPaletteAs(page: Page): Promise<CommandPalette> {
  const palette = new CommandPalette(page);
  await new DashboardPage(page).goto();
  await palette.open();
  await expect(palette.item('Hosts')).toBeVisible();
  return palette;
}

test.describe('Command palette • role access', () => {
  test('a global observer gets the Pages, Software and Commands groups and the pickers, nothing to write', async ({
    browser,
  }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const palette = await openPaletteAs(page);

      expect(await palette.groupNames()).toEqual(['Pages', 'Software', 'Commands']);

      // Read-only commands stay: an observer can look things up.
      for (const label of ['View host', 'View report', 'View policy', 'View software inventory']) {
        await expect(palette.item(label), `${label} should be offered`).toBeVisible();
      }
      // Writes are gone, including the observer+ live run.
      for (const label of ['Add hosts', 'Add report', 'Add policy', 'Add label', 'Run live report']) {
        await expect(palette.item(label), `${label} should not be offered`).toHaveCount(0);
      }
    });
  });

  test('a global maintainer gets the write commands but no Settings, MDM or Automations', async ({
    browser,
  }) => {
    await withStaticUser(browser, 'global-maintainer', async (page) => {
      const palette = await openPaletteAs(page);

      for (const label of [
        'Add hosts',
        'Add report',
        'Add policy',
        'Add label',
        'Manage enroll secrets',
        'Run live report',
        'Run live policy',
      ]) {
        await expect(palette.item(label), `${label} should be offered`).toBeVisible();
      }

      const groups = await palette.groupNames();
      for (const adminGroup of ['Settings', 'MDM', 'Automations']) {
        expect(groups, `the ${adminGroup} group is admin-only`).not.toContain(adminGroup);
      }
      // User management and the software automations are global-admin rows.
      for (const label of ['Add user', 'Add API-only user', 'Manage software automations']) {
        await expect(palette.item(label), `${label} should not be offered`).toHaveCount(0);
      }
    });
  });

  test('a global admin gets the Settings, MDM and Automations groups', async ({ browser }) => {
    await withStaticUser(browser, 'global-admin', async (page) => {
      const palette = await openPaletteAs(page);

      const groups = await palette.groupNames();
      for (const adminGroup of ['Settings', 'MDM', 'Automations']) {
        expect(groups, `the ${adminGroup} group should render for an admin`).toContain(adminGroup);
      }
      for (const label of ['Add user', 'Add API-only user', 'Manage activity automations']) {
        await expect(palette.item(label), `${label} should be offered`).toBeVisible();
      }
    });
  });
});
