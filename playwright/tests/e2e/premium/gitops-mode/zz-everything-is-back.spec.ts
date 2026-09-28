/**
 * The safety net. Everything before this file turns gitops mode on; this one
 * proves the instance came back.
 *
 * It takes nothing from the specs before it, seeds nothing, and turns the mode
 * off itself rather than trusting the teardown project — it is a verifier, not
 * a beneficiary, and it has to pass even if every spec before it failed.
 *
 * The `zz-` prefix is load-bearing: with one worker and `fullyParallel: false`,
 * file discovery order is the running order.
 *
 * The set is one control per gating pattern, plus the escape hatch and the
 * global marker. A native button, an aria-disabled div and a react-select each
 * recover independently, so asserting only buttons would miss a half-restored
 * render.
 */
import { test, expect } from '@fixtures';
import { disableGitOpsMode, getGitOpsMode, withApiRequest } from '@helpers/api';
import { expectNotGatedByGitOps, gitopsWrappers } from '@pages';

test.describe('Premium • gitops mode — everything is back', () => {
  test.beforeAll(async () => {
    await withApiRequest(disableGitOpsMode);
  });

  test('the config says gitops mode is off', async ({ request }) => {
    const gitops = await getGitOpsMode(request);
    expect(gitops.gitops_mode_enabled, 'gitops mode is still enabled').toBe(false);
  });

  test('the navbar marker is gone', async ({ dashboard }) => {
    await dashboard.goto();

    // The navbar marker is the discriminating half: it renders only while the
    // mode is on. A wrapper count is deliberately not asserted here — the
    // dashboard renders none in either state (its only wrapper lives inside the
    // activity-automations modal, which this test never opens), so it would pass
    // with gitops mode fully on. The pages below do render them, and assert it
    // there where it can fail.
    await expect(dashboard.navbar.gitopsIndicator).toHaveCount(0);
  });

  test('Controls — Add script is editable again', async ({ scriptsLibrary, page }) => {
    await scriptsLibrary.goto({ fleetId: 0 });

    await expectNotGatedByGitOps(scriptsLibrary.addScriptButton);
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });

  test('Advanced options — the host-expiry checkbox is editable again', async ({
    organizationAdvanced,
    page,
  }) => {
    await organizationAdvanced.goto();

    await expectNotGatedByGitOps(page.getByRole('checkbox', { name: 'enableHostExpiry' }));
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });

  test('Fleets — Add fleet and the row actions are editable again', async ({ page }) => {
    await page.goto('/settings/fleets');

    const addFleet = page.getByRole('button', { name: 'Add fleet' });
    await expect(addFleet).toBeEnabled();
    await expectNotGatedByGitOps(page.locator('.actions-dropdown').first(), {
      style: 'react-select',
    });
    await expect(gitopsWrappers(page)).toHaveCount(0);

    // A control that came back enabled but kept its gitops tip is what a stale
    // `config` in AppContext looks like, and nothing else would catch it.
    await addFleet.hover();
    await expect(
      page.getByRole('tooltip').filter({ hasText: 'Manage in YAML' }),
    ).toHaveCount(0);
  });

  test('Change management agrees with the API and is still the way out', async ({
    changeManagement,
    request,
  }) => {
    const gitops = await getGitOpsMode(request);
    await changeManagement.goto();

    await expect(changeManagement.gitopsModeToggle).not.toBeChecked();
    for (const entity of ['labels', 'software', 'secrets'] as const) {
      const checkbox = changeManagement.exceptionCheckbox(entity);
      // This proves the form agrees with the API and is editable again — not
      // that no spec left an exception flipped. The comparison is against the
      // same `GET /config` read, so a left-over `labels: true` would make the
      // API say true, the box tick, and this pass. Detecting that needs a
      // baseline from before the project ran, which this file deliberately does
      // not take: it has to pass even if every spec before it failed.
      await expect(checkbox, `${entity} exception`).toBeEnabled();
      if (gitops.exceptions[entity]) {
        await expect(checkbox, `${entity} exception`).toBeChecked();
      } else {
        await expect(checkbox, `${entity} exception`).not.toBeChecked();
      }
    }
    await expect(changeManagement.saveButton).toBeEnabled();
  });
});
