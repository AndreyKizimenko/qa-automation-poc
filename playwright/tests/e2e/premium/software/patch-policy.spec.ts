/**
 * Premium • Software • Patch policies for Fleet-maintained apps.
 *
 * A title's Actions → Deploy → **Patch** has Fleet create a `patch` policy — named
 * "<platform> - <title> up to date", failing on any host running an older
 * version than the newest Fleet maintains — and the patch option decides what it
 * does about that (`getPatchPolicyFlags` in `SoftwareDeploySelector.tsx`, and
 * `DeployModal.tsx`, which leaves the install automation off for manual):
 *
 * | option | installs on failure | patch_when_closed | notify_before_patching | continuous |
 * |---|---|---|---|---|
 * | Patch when app is closed | ✓ | ✓ | | ✓ |
 * | Force patch | ✓ | | | |
 * | Force patch + Notify before patching (macOS) | ✓ | | ✓ | ✓ |
 * | End user initiated (manual) | | | | |
 *
 * The macOS test walks one app's patch policy through every option and back off
 * through the Deploy modal, reading what Fleet stored after each save. The
 * Windows test has no Notify to offer, and the server refuses it — and the two
 * patch flags together — whatever the UI does.
 *
 * QA Wolf's `patch-policy-fleet-maintained-apps` added 7-Zip to their VM fleet,
 * ticked Patch and checked that the policy existed. Here it's **Workstations**,
 * which has no hosts, so nothing is ever patched: what a patch policy is, is
 * decided server-side. Not 7-Zip — `library.spec.ts` adds and deletes it on
 * Workstations, and on the VMs fleet it is a durable fixture. LocalSend and
 * KeePassXC are claimed by no other spec (see `custom-icons.spec.ts`'s header for
 * why each claims its own), and each test uses a different app so the two never
 * share a title name in the Library.
 *
 * Premium only: free can't add software.
 */
import { test, expect } from '@fixtures';
import {
  addFmaToFleet,
  deleteFleetPolicies,
  deleteSoftwareTitle,
  findPatchPolicy,
  getSoftwareTitle,
  updateFleetPolicy,
  type FleetPolicy,
} from '@helpers/api';
import type { DashboardPage, SoftwareLibraryPage, SoftwareTitleDetailPage, SoftwareTitlesPage } from '@pages';

/** Dashboard → Software → Workstations → Library → the title. */
async function openTitle(
  pages: {
    dashboard: DashboardPage;
    softwareTitles: SoftwareTitlesPage;
    softwareLibrary: SoftwareLibraryPage;
    softwareTitleDetail: SoftwareTitleDetailPage;
  },
  titleName: string,
) {
  await pages.dashboard.goto();
  await pages.dashboard.navbar.goToSoftware();
  await pages.softwareTitles.teamDropdown.select('Workstations');
  await pages.softwareTitles.gotoLibraryTab();
  await pages.softwareLibrary.searchByName(titleName);
  await pages.softwareLibrary.table.rowWith(titleName).getByRole('link').first().click();
  await expect(pages.softwareTitleDetail.displayHeading).toBeVisible();
}

/** What Fleet stored, in the table's terms. */
const contract = (p: FleetPolicy | null) =>
  p && {
    installs: p.installSoftwareTitleId !== null,
    patchWhenClosed: p.patchWhenClosed,
    notifyBeforePatching: p.notifyBeforePatching,
    continuous: p.continuousAutomationsEnabled,
  };

test.describe('Premium • Software • Patch policies', () => {
  test('a macOS app: each patch option stores its own policy, and unticking Patch removes it', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    workstationsFleetId,
    request,
  }) => {
    const { titleId } = await addFmaToFleet(request, workstationsFleetId, 'localsend/darwin');
    try {
      const { name: titleName } = await getSoftwareTitle(request, workstationsFleetId, titleId);
      const stored = () => findPatchPolicy(request, workstationsFleetId, titleId);
      const page = softwareTitleDetail;
      const deploy = page.deploy;

      await openTitle({ dashboard, softwareTitles, softwareLibrary, softwareTitleDetail }, titleName);
      expect(await stored(), 'no patch policy before Patch is ticked').toBeNull();

      await test.step('Patch, with its default — Patch when app is closed', async () => {
        await page.openDeploy();
        await deploy.setPatch(true);
        await expect(deploy.patchOption('Patch when app is closed')).toBeChecked();
        await page.saveDeploy();
        await page.toast.expectSuccess('Successfully updated deploy options.');
        await expect.poll(async () => contract(await stored())).toEqual({
          installs: true,
          patchWhenClosed: true,
          notifyBeforePatching: false,
          continuous: true,
        });
        const policy = (await stored())!;
        expect(policy.name).toBe(`macOS - ${titleName} up to date`);
        expect(policy.type).toBe('patch');
        expect(policy.platform).toBe('darwin');
        expect(policy.installSoftwareTitleId).toBe(titleId);
      });

      await test.step('Force patch, notifying the end user first', async () => {
        await page.openDeploy();
        await expect(deploy.patchCheckbox).toHaveAttribute('aria-checked', 'true');
        await expect(deploy.patchOption('Patch when app is closed')).toBeChecked();
        await deploy.choosePatchOption('Force patch');
        await expect(deploy.endUserExperienceValue).toHaveText('Patch immediately');
        await deploy.chooseEndUserExperience('Notify before patching');
        await page.saveDeploy();
        await page.toast.expectSuccess('Successfully updated deploy options.');
        await expect.poll(async () => contract(await stored())).toEqual({
          installs: true,
          patchWhenClosed: false,
          notifyBeforePatching: true,
          continuous: true,
        });
      });

      await test.step('Force patch, immediately', async () => {
        await page.openDeploy();
        await expect(deploy.patchOption('Force patch')).toBeChecked();
        await expect(deploy.endUserExperienceValue).toHaveText('Notify before patching');
        await deploy.chooseEndUserExperience('Patch immediately');
        await page.saveDeploy();
        await expect.poll(async () => contract(await stored())).toEqual({
          installs: true,
          patchWhenClosed: false,
          notifyBeforePatching: false,
          continuous: false,
        });
      });

      await test.step('End user initiated: the policy stays, with nothing to install', async () => {
        await page.openDeploy();
        await expect(deploy.patchOption('Force patch')).toBeChecked();
        await deploy.choosePatchOption('End user initiated (manual)');
        await expect(deploy.endUserExperience).toHaveCount(0);
        await page.saveDeploy();
        await expect.poll(async () => contract(await stored())).toEqual({
          installs: false,
          patchWhenClosed: false,
          notifyBeforePatching: false,
          continuous: false,
        });
      });

      await test.step('unticking Patch deletes the policy', async () => {
        await page.openDeploy();
        await expect(deploy.patchOption('End user initiated (manual)')).toBeChecked();
        await deploy.setPatch(false);
        await expect(deploy.patchOptions).toHaveCount(0);
        await page.saveDeploy();
        await expect.poll(stored).toBeNull();
      });
    } finally {
      // The policy first: Fleet won't delete a title an install policy points at.
      const left = await findPatchPolicy(request, workstationsFleetId, titleId);
      if (left) await deleteFleetPolicies(request, workstationsFleetId, [left.id]);
      await deleteSoftwareTitle(request, workstationsFleetId, titleId);
    }
  });

  test('a Windows app: Force patch offers no Notify, and the server refuses Notify and both flags at once', async ({
    dashboard,
    softwareTitles,
    softwareLibrary,
    softwareTitleDetail,
    workstationsFleetId,
    request,
  }) => {
    const { titleId } = await addFmaToFleet(request, workstationsFleetId, 'keepassxc/windows');
    try {
      const { name: titleName } = await getSoftwareTitle(request, workstationsFleetId, titleId);
      const stored = () => findPatchPolicy(request, workstationsFleetId, titleId);
      const page = softwareTitleDetail;
      const deploy = page.deploy;

      await openTitle({ dashboard, softwareTitles, softwareLibrary, softwareTitleDetail }, titleName);
      await page.openDeploy();
      await deploy.setPatch(true);
      await deploy.choosePatchOption('Force patch');
      await expect(deploy.endUserExperience, 'Notify before patching is macOS-only').toHaveCount(0);
      await page.saveDeploy();
      await page.toast.expectSuccess('Successfully updated deploy options.');
      await expect.poll(async () => contract(await stored())).toEqual({
        installs: true,
        patchWhenClosed: false,
        notifyBeforePatching: false,
        continuous: false,
      });
      const policy = (await stored())!;
      expect(policy.name).toBe(`Windows - ${titleName} up to date`);
      expect(policy.platform).toBe('windows');

      // What the UI doesn't offer, the server refuses — and leaves the policy as it was.
      await expect(
        updateFleetPolicy(request, workstationsFleetId, policy.id, { notify_before_patching: true }),
      ).rejects.toThrow(/400[\s\S]*"notify_before_patching\\" is only available for macOS Fleet-maintained apps/);
      await expect(
        updateFleetPolicy(request, workstationsFleetId, policy.id, {
          patch_when_closed: true,
          notify_before_patching: true,
        }),
      ).rejects.toThrow(/400[\s\S]*Only one of \\"patch_when_closed\\" or \\"notify_before_patching\\" can be set to true/);
      expect(contract(await stored())).toEqual({
        installs: true,
        patchWhenClosed: false,
        notifyBeforePatching: false,
        continuous: false,
      });
    } finally {
      const left = await findPatchPolicy(request, workstationsFleetId, titleId);
      if (left) await deleteFleetPolicies(request, workstationsFleetId, [left.id]);
      await deleteSoftwareTitle(request, workstationsFleetId, titleId);
    }
  });
});
