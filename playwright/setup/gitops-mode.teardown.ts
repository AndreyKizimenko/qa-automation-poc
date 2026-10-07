/**
 * Teardown for the `gitops-mode` project: put the instance back into the state
 * every other spec in the suite assumes, and the state `fleetctl gitops` needs.
 *
 * That's the mode off and the exceptions at their pinned baseline. The specs
 * restore their own snapshots, but a snapshot taken after an earlier run died
 * mid-flip carries the stuck exception forward, and a stuck exception changes
 * what the next gitops apply deletes or refuses (`GITOPS_EXCEPTIONS_BASELINE`).
 *
 * Runs whatever the project's result was, but it can't run at all if the
 * process is killed outright. For that case, `cleanup.steps.ts` clears the flag
 * before the next run's first test, and every premium gitops apply restores the
 * exceptions first (`.github/scripts/restore-gitops-exceptions.sh`).
 */
import { test, expect } from '@playwright/test';
import { GITOPS_EXCEPTIONS_BASELINE, getGitOpsMode, resetGitOpsMode } from '@helpers/api/gitops-mode';

test('disable gitops mode and restore the pinned exceptions', async ({ request }) => {
  await resetGitOpsMode(request);

  const after = await getGitOpsMode(request);
  expect(after.gitops_mode_enabled, 'gitops mode is still enabled after teardown').toBe(false);
  expect(after.exceptions, 'the gitops exceptions are off their pinned baseline').toEqual(
    GITOPS_EXCEPTIONS_BASELINE,
  );
});
