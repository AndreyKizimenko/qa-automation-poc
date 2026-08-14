/**
 * Premium • Hosts • CTA visibility by role.
 *
 * The hosts-list write CTAs are gated on the enroll-hosts role (global/team
 * admin or maintainer): "Add hosts" sits in the header, "Enroll secrets" sits
 * inside the "Hosts page settings" gear menu. "Export hosts" has no role gate.
 * Global admin and global maintainer see all three; a global observer sees only
 * Export — and with no gear items available to it, no gear at all. Purely
 * role-based (not team-scoped). Each role logs into a fresh context via
 * `withStaticUser`.
 */
import { test, expect } from '@fixtures';
import { withStaticUser } from '@helpers/auth';
import type { StaticUserKey } from '@helpers/api';
import { HostsListPage } from '@pages';

const ENROLL_ROLES: StaticUserKey[] = ['global-admin', 'global-maintainer'];

test.describe('Premium • Hosts • CTA visibility by role', () => {
  for (const key of ENROLL_ROLES) {
    test(`${key} sees Add hosts, Enroll secrets, and Export hosts`, async ({ browser }) => {
      await withStaticUser(browser, key, async (page) => {
        const hosts = new HostsListPage(page);
        await hosts.goto();

        await expect(hosts.addHostsButton).toBeVisible();
        await expect(hosts.exportHostsButton).toBeVisible();

        await hosts.hostsPageSettingsButton.click();
        await expect(hosts.enrollSecretsOption).toBeVisible();
      });
    });
  }

  test('global observer sees only Export hosts', async ({ browser }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const hosts = new HostsListPage(page);
      await hosts.goto();

      await expect(hosts.exportHostsButton).toBeVisible();
      await expect(hosts.addHostsButton).toHaveCount(0);
      // An observer grants none of the gear's items, so the gear itself is
      // what's absent — there's no menu left to open and look inside.
      await expect(hosts.hostsPageSettingsButton).toHaveCount(0);
    });
  });
});
