/**
 * Free • Hosts • CTA visibility by role.
 *
 * The hosts-list write CTAs are gated on the enroll-hosts role (global/team
 * admin or maintainer): "Add hosts" sits in the header, "Enroll secrets" sits
 * inside the "Hosts page settings" gear menu. "Export hosts" has no role gate.
 * "Add label" is the "+" in the label filter's menu, beside its "Filter labels
 * by name..." box (`CustomLabelGroupHeading`), for every role but an observer.
 * A global admin sees all four; a global observer sees only Export — and with
 * no gear items available to it, no gear at all. Purely role-based (not
 * team-scoped). Each role logs into a fresh context via `withStaticUser`,
 * leaving the shared admin storage state untouched.
 *
 * The label menu is opened only once the table has settled — the Hosts page
 * rewrites its URL just after it loads, and the re-render can close a menu —
 * and an absent Add label is read between two checks that the menu's search
 * box is still showing.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import { HostsListPage } from '@pages';

test.describe('Free • Hosts • CTA visibility by role', () => {
  test('global admin sees Add hosts, Enroll secrets, and Export hosts', async ({ browser }) => {
    await withStaticUser(browser, 'global-admin', async (page) => {
      const hosts = new HostsListPage(page);
      await hosts.goto();

      await expect(hosts.addHostsButton).toBeVisible();
      await expect(hosts.exportHostsButton).toBeVisible();

      await hosts.hostsPageSettingsButton.click();
      await expect(hosts.enrollSecretsOption).toBeVisible();
      await page.keyboard.press('Escape');

      await hosts.table.waitForSettled();
      await hosts.labelFilter.openMenu();
      await expect(hosts.labelFilter.addLabelButton).toBeVisible();
    });
  });

  test('global observer sees only Export hosts', async ({ browser }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const hosts = new HostsListPage(page);
      await hosts.goto();

      await expect(hosts.exportHostsButton).toBeVisible();
      await expect(hosts.addHostsButton).toHaveCount(0);
      // An observer grants none of the gear's items, so the gear itself is
      // what's absent — there's no menu left to open and look inside.
      await expect(hosts.hostsPageSettingsButton).toHaveCount(0);

      await hosts.table.waitForSettled();
      await hosts.labelFilter.openMenu();
      await expect(hosts.labelFilter.addLabelButton).toHaveCount(0);
      await expect(hosts.labelFilter.searchBox).toBeVisible();
    });
  });
});
