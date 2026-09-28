/**
 * The two global signals that gitops mode is on: the navbar badge, and the
 * "Manage in YAML" tooltip that every gated control carries.
 *
 * The two YAML links in the product point at different places — the badge's
 * "Learn more" goes to Fleet's docs, a gated control's "YAML" goes to the
 * customer's own repository — so both are asserted separately.
 */
import { test, expect } from '@fixtures';
import { enableGitOpsMode, withApiRequest, withGitOpsMode } from '@helpers/api';
import { expectGatedByGitOps, gitopsWrappers } from '@pages';

const CHANGE_MANAGEMENT_PATH = '/settings/integrations/change-management';
const LEARN_MORE_URL = 'https://fleetdm.com/learn-more-about/ui-gitops-mode';

test.describe('Premium • gitops mode — indicator and YAML links', () => {
  test.describe.configure({ mode: 'serial' });

  // Snapshot the whole subtree rather than just flipping the flag: the
  // instance's own exception set is part of its configuration and a spec that
  // turned the mode on with everything un-excepted must not leave it that way.
  let restoreGitOpsMode: () => Promise<void>;

  test.beforeAll(async () => {
    restoreGitOpsMode = await withApiRequest((request) =>
      withGitOpsMode(request, { gitops_mode_enabled: false }),
    );
  });

  test.afterAll(async () => {
    await restoreGitOpsMode();
  });

  test('with gitops mode off, nothing on the dashboard is marked or gated', async ({
    dashboard,
    page,
  }) => {
    await dashboard.goto();

    await expect(dashboard.navbar.gitopsIndicator).toHaveCount(0);
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });

  test('the navbar indicator links to Change management and to the docs', async ({
    dashboard,
    page,
    request,
  }) => {
    await enableGitOpsMode(request);
    await dashboard.goto();

    await expect(dashboard.navbar.gitopsIndicator).toBeVisible();
    await expect(dashboard.navbar.gitopsIndicator).toHaveAttribute(
      'href',
      CHANGE_MANAGEMENT_PATH,
    );

    await dashboard.navbar.gitopsIndicator.hover();
    const tooltip = page
      .getByRole('tooltip')
      .filter({ hasText: 'Items managed in YAML are read-only.' });
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      LEARN_MORE_URL,
    );
  });

  test("a gated control's tooltip links to the configured repository", async ({
    scriptsLibrary,
    request,
  }) => {
    const { repository_url: repoUrl } = await enableGitOpsMode(request);
    expect(repoUrl, 'the instance has no gitops repository_url configured').not.toBe('');

    await scriptsLibrary.goto({ fleetId: 0 });

    await expectGatedByGitOps(scriptsLibrary.addScriptButton, repoUrl);
  });
});
