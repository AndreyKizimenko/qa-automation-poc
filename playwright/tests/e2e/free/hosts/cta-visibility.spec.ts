/**
 * Free • Hosts • CTA visibility by role.
 *
 * The hosts-list write CTAs ("Add hosts", "Enroll secrets") are gated on the
 * enroll-hosts role (global/team admin or maintainer); "Export hosts" has no
 * role gate. A global admin sees all three; a global observer sees only Export.
 * Purely role-based (not team-scoped). Each role logs into a fresh context via
 * `withStaticUser`, leaving the shared admin storage state untouched.
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
      await expect(hosts.enrollSecretsButton).toBeVisible();
      await expect(hosts.exportHostsButton).toBeVisible();
    });
  });

  test('global observer sees only Export hosts', async ({ browser }) => {
    await withStaticUser(browser, 'global-observer', async (page) => {
      const hosts = new HostsListPage(page);
      await hosts.goto();

      await expect(hosts.exportHostsButton).toBeVisible();
      await expect(hosts.addHostsButton).toHaveCount(0);
      await expect(hosts.enrollSecretsButton).toHaveCount(0);
    });
  });
});
