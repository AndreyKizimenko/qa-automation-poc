/**
 * The breadth sweep: with gitops mode on and no exceptions, one representative
 * control per *gating pattern*, and — just as important — the controls that
 * must stay enabled next to them.
 *
 * `GitOpsModeTooltipWrapper` lets each child decide what disabled means, so
 * these tests deliberately span all four signatures: a native button, Fleet's
 * `Checkbox`, a react-select with no disabled accessible element, and a raw
 * `disabled` with no wrapper at all.
 *
 * Over-gating is the half a naive "everything is disabled" test gets wrong:
 * enrolling a host is not a config change, and Advanced's Save still has
 * un-gated fields to save.
 */
import { test, expect } from '@fixtures';
import { getGitOpsMode, withApiRequest, withGitOpsMode } from '@helpers/api';
import {
  EnrollSecretModal,
  expectGatedByGitOps,
  expectGitOpsTooltip,
  expectNotGatedByGitOps,
  gitopsWrapperFor,
  gitopsWrappers,
} from '@pages';

test.describe('Premium • gitops mode — gated surfaces', () => {
  test.describe.configure({ mode: 'serial' });

  let repoUrl = '';
  let restoreGitOpsMode: () => Promise<void>;

  test.beforeAll(async () => {
    await withApiRequest(async (request) => {
      restoreGitOpsMode = await withGitOpsMode(request, {
        gitops_mode_enabled: true,
        exceptions: { labels: false, software: false, secrets: false },
      });
      repoUrl = (await getGitOpsMode(request)).repository_url;
    });
    expect(repoUrl, 'the instance has no gitops repository_url configured').not.toBe('');
  });

  test.afterAll(async () => {
    await restoreGitOpsMode();
  });

  test('Organization info — Save is gated and the org name is locked', async ({
    organizationInfo,
  }) => {
    await organizationInfo.goto();

    await expectGatedByGitOps(organizationInfo.saveButton, repoUrl);
    // The org-name field reads the flag itself instead of going through the
    // wrapper, so it locks without a tooltip — assert the lock, not the tip.
    await expect(organizationInfo.orgNameInput).toBeDisabled();
  });

  test('Advanced options — host expiry is gated, SMTP and Save stay editable', async ({
    organizationAdvanced,
    page,
  }) => {
    await organizationAdvanced.goto();

    // Fleet's Checkbox exposes a div[role=checkbox][aria-disabled=true]; the
    // accessible name is the form field, not the visible label.
    await expectGatedByGitOps(page.getByRole('checkbox', { name: 'enableHostExpiry' }), repoUrl);

    await expectNotGatedByGitOps(organizationAdvanced.domainInput);
    await expectNotGatedByGitOps(organizationAdvanced.saveButton);
  });

  test('Fleets list — Add fleet and the row actions are gated', async ({ page }) => {
    await page.goto('/settings/fleets');
    const addFleet = page.getByRole('button', { name: 'Add fleet' });
    await expect(addFleet).toBeVisible();

    // "Add fleet" carries the gitops tip from a plain TooltipWrapper rather than
    // from GitOpsModeTooltipWrapper, so there is no wrapper span to find — and
    // that same overlay intercepts pointer events, so the tip has to be raised
    // by hovering the overlay rather than the button.
    await expect(addFleet).toBeDisabled();
    await expect(gitopsWrapperFor(addFleet)).toHaveCount(0);
    const tooltipOverlay = page.locator('.component__tooltip-wrapper__element').filter({
      has: addFleet,
    });
    await expectGitOpsTooltip(page, tooltipOverlay, repoUrl);

    // The row Actions control is a react-select: no aria-disabled, no
    // accessible name, only a class on the container.
    const rowActions = page.locator('.actions-dropdown').first();
    await expectGatedByGitOps(rowActions, repoUrl, { style: 'react-select' });
  });

  test('Fleet settings — management actions are gated, Add hosts stays enabled', async ({
    page,
    workstationsFleetId,
  }) => {
    await page.goto(`/settings/fleets/settings?fleet_id=${workstationsFleetId}`);

    // ActionButtons renders every secondary action twice — once inline and
    // once as an option inside a "More options" menu that CSS hides at this
    // width — so each name matches two elements. Narrow to the rendered one.
    const action = (name: string) =>
      page.getByRole('button', { name, exact: true }).filter({ visible: true });

    await expectGatedByGitOps(action('Manage enroll secrets'), repoUrl);
    await expectGatedByGitOps(action('Rename fleet'), repoUrl);
    await expectGatedByGitOps(action('Delete fleet'), repoUrl);

    // Enrolling a host is not a config change, so the primary action stays live.
    await expectNotGatedByGitOps(action('Add hosts'));
  });

  test('Enroll secrets stay readable but not editable', async ({
    page,
    workstationsFleetId,
  }) => {
    const modal = new EnrollSecretModal(page);
    await modal.goto(workstationsFleetId);

    // Gating is per control type, not per secret, so the first row speaks for all.
    const row = modal.rowControls(modal.rows.first());
    await expectGatedByGitOps(modal.addSecretButton, repoUrl);
    await expectGatedByGitOps(row.edit, repoUrl);
    await expectGatedByGitOps(row.delete, repoUrl);

    await expectNotGatedByGitOps(row.copy);
    await expectNotGatedByGitOps(row.show);
    await expectNotGatedByGitOps(modal.doneButton);
  });

  test('Change management stays fully editable — the way back out', async ({
    changeManagement,
    page,
  }) => {
    await changeManagement.goto();

    await expectNotGatedByGitOps(changeManagement.gitopsModeToggle);
    await expectNotGatedByGitOps(changeManagement.repositoryUrlInput);
    await expectNotGatedByGitOps(changeManagement.exceptionCheckbox('labels'));
    await expectNotGatedByGitOps(changeManagement.exceptionCheckbox('software'));
    await expectNotGatedByGitOps(changeManagement.exceptionCheckbox('secrets'));
    await expectNotGatedByGitOps(changeManagement.saveButton);

    // Gate anything on this card and gitops mode becomes a one-way door.
    await expect(gitopsWrappers(page)).toHaveCount(0);
  });
});
