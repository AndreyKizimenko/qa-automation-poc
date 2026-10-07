/**
 * The Change management card's own saves: the UI is where a customer turns
 * gitops mode off and excepts an entity. Its Save sends the whole `gitops`
 * subtree from form state (`ChangeManagement.tsx`), then hands the response to
 * the app's shared config. So each test checks that the one field it changed
 * changed and nothing else did (a form that loaded or sent a field wrong would
 * flip it silently), that Fleet logged the change, and that the rest of the UI
 * caught up without a reload. `02` only asserts the card is editable; `01` and
 * `03` drive the flag and the exceptions over the API.
 *
 * Labels is the only exception written here. A stuck labels exception fails
 * loudly: gitops refuses the YAML's `labels:` key. A stuck `secrets: false`
 * deletes every enroll secret on the next apply instead
 * (`GITOPS_EXCEPTIONS_BASELINE`), so Enroll secrets is never touched, and the
 * repository URL is never typed. Each test restores the subtree in its
 * `afterEach`; the project's teardown puts the pinned baseline back after it.
 */
import { test, expect } from '@fixtures';
import {
  assertActivityAfter,
  getGitOpsMode,
  latestActivityId,
  withGitOpsMode,
} from '@helpers/api';
import { expectNotGatedByGitOps } from '@pages';

test.describe('Premium • gitops mode — Change management saves', () => {
  // Set only by the test that changed the subtree, so the hook restores that
  // test's snapshot and nothing else.
  let restoreGitOpsMode: (() => Promise<void>) | undefined;

  test.afterEach(async () => {
    await restoreGitOpsMode?.();
    restoreGitOpsMode = undefined;
  });

  test('turning gitops mode off keeps the exceptions and the repository URL', async ({
    changeManagement,
    request,
  }) => {
    restoreGitOpsMode = await withGitOpsMode(request, { gitops_mode_enabled: true });
    const before = await getGitOpsMode(request);
    expect(before.repository_url, 'the instance has no gitops repository_url configured').not.toBe('');
    const lastActivity = await latestActivityId(request);

    await changeManagement.goto();
    await expect(changeManagement.navbar.gitopsIndicator).toBeVisible();
    await expect(changeManagement.gitopsModeToggle).toBeChecked();
    await changeManagement.gitopsModeToggle.setChecked(false);
    await changeManagement.save();

    await expect
      .poll(async () => (await getGitOpsMode(request)).gitops_mode_enabled, {
        message: 'the save turned gitops mode off',
      })
      .toBe(false);
    expect(await getGitOpsMode(request), 'everything but the flag is as it was').toEqual({
      ...before,
      gitops_mode_enabled: false,
    });
    await assertActivityAfter(request, 'disabled_gitops_mode', lastActivity, () => true);

    // The navbar reads the shared config the save updated: no reload.
    await expect(changeManagement.navbar.gitopsIndicator).toHaveCount(0);
  });

  test('ticking the labels exception saves only that exception and unlocks labels without a reload', async ({
    changeManagement,
    labelsPage,
    request,
  }) => {
    restoreGitOpsMode = await withGitOpsMode(request, {
      gitops_mode_enabled: true,
      exceptions: { labels: false },
    });
    const before = await getGitOpsMode(request);
    const lastActivity = await latestActivityId(request);

    await changeManagement.goto();
    const labels = changeManagement.exceptionCheckbox('labels');
    await expect(labels).not.toBeChecked();
    await labels.setChecked(true);
    await changeManagement.save();

    await expect
      .poll(async () => (await getGitOpsMode(request)).exceptions.labels, {
        message: 'the save excepted labels',
      })
      .toBe(true);
    expect(await getGitOpsMode(request), 'everything but the labels exception is as it was').toEqual({
      ...before,
      exceptions: { ...before.exceptions, labels: true },
    });
    await assertActivityAfter(
      request,
      'enabled_gitops_exception',
      lastActivity,
      (d) => d.exception === 'labels',
    );

    // Through the user menu, a client-side route change, so the new-label form
    // renders from the config the save handed back rather than a page load.
    await changeManagement.navbar.openUserMenu();
    await changeManagement.navbar.labelsItem.click();
    await expect(labelsPage.heading).toBeVisible();
    await labelsPage.clickAddLabel();
    await expectNotGatedByGitOps(labelsPage.saveButton);
  });
});
