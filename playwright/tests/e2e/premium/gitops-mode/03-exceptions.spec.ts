/**
 * The exception axis: `config.gitops.exceptions.<entity> = true` means gitops
 * mode is treated as *disabled* for that entity. The naming is inverted
 * relative to the UI ("Exceptions: ☑ Labels" = labels are **not** gitops-managed),
 * and getting it backwards makes every test here pass for the wrong reason.
 *
 * An excepted entity renders exactly like gitops mode being off — no wrapper,
 * no tooltip, control live — which is what these tests assert in both
 * directions.
 */
import { test, expect } from '@fixtures';
import { getGitOpsMode, setGitOpsException, withGitOpsMode } from '@helpers/api';
import {
  EnrollSecretModal,
  expectGatedByGitOps,
  expectNotGatedByGitOps,
  gitopsWrappers,
} from '@pages';

test.describe('Premium • gitops mode — exceptions', () => {
  let restoreGitOpsMode: () => Promise<void>;
  let repoUrl = '';

  // Each test starts from "mode on, nothing excepted" and hands the whole
  // subtree back afterwards, so a test that dies mid-flip can't leave an
  // exception set for the next one.
  test.beforeEach(async ({ request }) => {
    restoreGitOpsMode = await withGitOpsMode(request, {
      gitops_mode_enabled: true,
      exceptions: { labels: false, software: false, secrets: false },
    });
    repoUrl = (await getGitOpsMode(request)).repository_url;
  });

  test.afterEach(async () => {
    await restoreGitOpsMode();
  });

  test('labels — the new-label form is gated while labels are managed in YAML', async ({
    labelsPage,
  }) => {
    await labelsPage.goto();
    await labelsPage.clickAddLabel();

    await expectGatedByGitOps(labelsPage.saveButton, repoUrl);
  });

  test('labels — the exception unlocks the new-label form', async ({
    labelsPage,
    page,
    request,
  }) => {
    await setGitOpsException(request, 'labels', true);

    await labelsPage.goto();
    await labelsPage.clickAddLabel();

    await expectNotGatedByGitOps(labelsPage.saveButton);
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });

  test('enroll secrets — the exception unlocks the enroll-secret modal', async ({
    page,
    request,
    workstationsFleetId,
  }) => {
    const modal = new EnrollSecretModal(page);

    await modal.goto(workstationsFleetId);
    await expectGatedByGitOps(modal.addSecretButton, repoUrl);

    await setGitOpsException(request, 'secrets', true);
    await modal.goto(workstationsFleetId);

    const row = modal.rowControls(modal.rows.first());
    await expectNotGatedByGitOps(modal.addSecretButton);
    await expectNotGatedByGitOps(row.edit);
    await expectNotGatedByGitOps(row.delete);
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });

  test('enroll secrets — the exception reaches the fleet settings entry point', async ({
    page,
    request,
    workstationsFleetId,
  }) => {
    // TODO(fleetdm/fleet#48218): "Manage enroll secrets" on a fleet's settings
    // page is wrapped without an `entityType`, so `exceptions.secrets` never
    // reaches it and the button stays disabled — leaving the exception
    // unreachable from the only documented way into the modal it governs.
    // Unblocks when that wrapper carries entityType="secrets".
    test.skip(
      true,
      'fleetdm/fleet#48218 — Manage enroll secrets ignores exceptions.secrets',
    );

    await setGitOpsException(request, 'secrets', true);
    await page.goto(`/settings/fleets/settings?fleet_id=${workstationsFleetId}`);

    await expectNotGatedByGitOps(
      page.getByRole('button', { name: 'Manage enroll secrets', exact: true }).filter({
        visible: true,
      }),
    );
  });
});
