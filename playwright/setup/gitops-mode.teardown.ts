/**
 * Teardown for the `gitops-mode` project: put the instance back into the state
 * every other spec in the suite assumes.
 *
 * Runs whatever the project's result was, but it can't run at all if the
 * process is killed outright — which is why `cleanup.steps.ts` clears the flag
 * as well, before the next run's first test.
 */
import { test, expect } from '@playwright/test';
import { disableGitOpsMode, getGitOpsMode } from '@helpers/api/gitops-mode';

test('disable gitops mode', async ({ request }) => {
  await disableGitOpsMode(request);

  const after = await getGitOpsMode(request);
  expect(after.gitops_mode_enabled, 'gitops mode is still enabled after teardown').toBe(false);
});
