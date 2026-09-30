/**
 * Premium • Software — a package scoped to labels is offered to exactly the
 * hosts they pick.
 *
 * QA Wolf's two flows scoped a Fleet-maintained app "Include all" / "Include
 * any" to labels and checked one Mac's Library had it and another's didn't
 * (the "any" flow checked the wrong host twice, so its negative never ran).
 * Here one package goes through all three scopes on the VMs fleet, and each is
 * asserted as set membership over hosts the test controls — the Ubuntu VM and
 * two Linux simulations borrowed onto the fleet (`findSimulations`):
 *
 * | scope | a = VM + s1, b = VM + s2 | offered to |
 * |---|---|---|
 * | Include **all** of a, b | only the VM is in both | VM |
 * | Include **any** of a, b | everyone is in one | VM, s1, s2 |
 * | Exclude **any** of a | only s2 is outside a | s2 |
 *
 * Which hosts a title is *offered* to is Fleet's server-side decision, and a
 * simulation answers it as well as a VM. What the VM *does* with it is the
 * other half: under "Include all" the VM installs the package from its Library.
 *
 * And a label a package's scope uses can't be deleted: "Couldn't delete.
 * Software uses this label as a custom target. Remove the label from the
 * software target and try again." (the software twin of
 * `profile-broken-labels.spec.ts`).
 *
 * **A per-run package, never a durable fixture.** Scoping a package changes the
 * title for every host; the VMs fleet's durable fixtures (`helpers/vm-fixtures.ts`)
 * must stay unscoped. The package is an inert `fleet-pw-label-*` `.deb`
 * (`helpers/deb.ts`) — the cleanup sweep deletes a `fleet-pw-*` title a dead run
 * left, and purges the package from the Ubuntu VM. It is uninstalled in-test.
 * Linux rather than QA Wolf's macOS app because a `.deb` can be minted per run;
 * which hosts are offered a title doesn't depend on the platform.
 */
import { test, expect, HOST_RETRIES } from '@fixtures';
import {
  createManualLabel,
  deleteLabelById,
  deleteSoftwareTitle,
  findSimulations,
  getSoftwarePackage,
  hostsOfferedTitle,
  requireRealHost,
  transferHosts,
  uninstallSoftwareOnHost,
  uploadSoftwarePackageBuffer,
  waitForSoftwareSettled,
} from '@helpers/api';
import { inertDeb } from '@helpers/deb';
import { runNonce } from '@helpers/profiles';
import type { LabelScopeOption } from '@pages';

/** Which slice of the Linux simulations this spec borrows (see `findSimulations`). */
const SIM_OFFSET = 0;

const REFUSED = "Couldn't delete. Software uses this label as a custom target. Remove the label from the software target and try again.";

test.describe('Premium • Software — label-scoped software', () => {
  test.describe.configure({ timeout: 900_000, retries: HOST_RETRIES });

  test('a package scoped include all, include any or exclude any is offered to exactly the hosts its labels pick', async ({
    softwareTitleDetail,
    hostDetails,
    labelsPage,
    vmsFleetId,
    request,
    pageHealth,
  }) => {
    // The refused label delete is a deliberate 422 the app logs to the console.
    pageHealth.disable();
    const vm = await requireRealHost(request, 'linux');
    expect(vm.fleetId, 'the Ubuntu VM must be on the VMs fleet').toBe(vmsFleetId);
    const sims = await findSimulations(request, 'linux', 2, SIM_OFFSET);
    expect(sims, 'needs two online Linux simulations on Unassigned').toHaveLength(2);
    const [s1, s2] = sims;
    const ours = [vm.id, s1, s2].sort((x, y) => x - y);

    const n = runNonce();
    const label = { a: `pw-sl-${n}-a`, b: `pw-sl-${n}-b` };
    const pkgName = `fleet-pw-label-${n}`;
    const fileName = `${pkgName}_1.0.0_all.deb`;
    let titleId: number | undefined;
    const labelIds: number[] = [];

    const scopeTo = async (target: { option: LabelScopeOption; labels: string[] }) => {
      await softwareTitleDetail.goto({ titleId: titleId!, fleetId: vmsFleetId });
      await softwareTitleDetail.installerCard.openScopeEditor();
      await softwareTitleDetail.editSoftwareModal.expectOpen();
      await softwareTitleDetail.editSoftwareModal.setTarget(target);
      await softwareTitleDetail.editSoftwareModal.save();
      await softwareTitleDetail.toast.expectSuccess(`Successfully edited ${fileName}.`);
    };
    const offered = () => hostsOfferedTitle(request, ours, titleId!);

    try {
      await transferHosts(request, vmsFleetId, sims);
      labelIds.push(await createManualLabel(request, label.a, [vm.id, s1]));
      labelIds.push(await createManualLabel(request, label.b, [vm.id, s2]));
      titleId = (await uploadSoftwarePackageBuffer(request, vmsFleetId, fileName, inertDeb(pkgName, '1.0.0'))).titleId;

      // Unscoped, every Linux host of ours is offered it.
      expect(await offered()).toEqual(ours);

      // Include all: only the VM.
      await scopeTo({ option: 'Include all', labels: [label.a, label.b] });
      const pkg = await getSoftwarePackage(request, vmsFleetId, titleId);
      expect([...pkg!.labelsIncludeAll].sort()).toEqual([label.a, label.b].sort());
      await expect.poll(offered, { message: 'offered under Include all', timeout: 30_000 }).toEqual([vm.id]);

      // …and the VM, inside the scope, installs it from its Library.
      await hostDetails.goto(vm.id);
      await hostDetails.openLibrary(pkgName);
      await hostDetails.library.install(pkgName);
      await waitForSoftwareSettled(request, vm.id, titleId, 'installed');
      await uninstallSoftwareOnHost(request, vm.id, titleId);
      await waitForSoftwareSettled(request, vm.id, titleId, null);

      // A label the scope uses can't be deleted.
      await labelsPage.goto();
      await labelsPage.runRowAction(label.a, 'Delete');
      await labelsPage.deleteConfirmButton.click();
      await labelsPage.toast.expectError(REFUSED);

      // Include any: all three.
      await scopeTo({ option: 'Include any', labels: [label.a, label.b] });
      await expect.poll(offered, { message: 'offered under Include any', timeout: 30_000 }).toEqual(ours);

      // Exclude any of a: only s2.
      await scopeTo({ option: 'Exclude any', labels: [label.a] });
      expect((await getSoftwarePackage(request, vmsFleetId, titleId))!.labelsExcludeAny).toEqual([label.a]);
      await expect.poll(offered, { message: 'offered under Exclude any', timeout: 30_000 }).toEqual([s2]);
    } finally {
      if (titleId !== undefined) await deleteSoftwareTitle(request, vmsFleetId, titleId);
      await transferHosts(request, 0, sims);
      for (const id of labelIds) await deleteLabelById(request, id);
    }
  });
});
