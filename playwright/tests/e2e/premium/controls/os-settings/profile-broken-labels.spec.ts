/**
 * Premium • Controls • Configuration profiles — a label a profile targets can't
 * be deleted.
 *
 * A profile whose target label was deleted used to show as broken ("The
 * configuration profile is broken." and "Label deleted", in a Custom target
 * modal) and wasn't applied to new hosts. Fleet has since made that state
 * unreachable through the product:
 *
 *  - since 4.87, `DeleteLabel` (`server/datastore/mysql/labels.go`) refuses to
 *    delete a label any configuration profile *or declaration* targets — a 422
 *    the Labels page shows as "Couldn't delete. A configuration profile targets
 *    this label. Please delete the profile and try again.";
 *  - 4.91 removed the Custom target modal; all that's left of "broken" is a
 *    warning icon beside a row's label count, which nothing can now provoke.
 *
 * So what this spec guards is the refusal, for every kind of profile a label
 * can be targeted by and for a dynamic label as well as a manual one — and
 * that nothing gives way when it happens: the label keeps its hosts, the profile
 * keeps its target and isn't marked broken. Then the other half: once the
 * profile is gone, the same delete goes through.
 *
 * Nothing here is delivered anywhere. The profiles live on **Workstations**,
 * which holds no hosts, and the manual labels hold two simulations that never
 * move (their own slice of `findSimulations`).
 */
import { test, expect } from '@fixtures';
import {
  createDynamicLabel,
  createManualLabel,
  deleteLabelById,
  deleteProfile,
  findSimulations,
  getProfile,
  listLabelHostIds,
  uploadProfile,
} from '@helpers/api';
import {
  inertDeclaration,
  inertMobileconfig,
  inertWindowsProfile,
  runNonce,
  type GeneratedProfile,
} from '@helpers/profiles';

/** Which slice of the simulations this spec reads (see `findSimulations`). */
const SIM_OFFSET = 0;

const REFUSED = "Couldn't delete. A configuration profile targets this label. Please delete the profile and try again.";

interface Case {
  kind: string;
  make: (name: string) => GeneratedProfile;
  label: 'manual' | 'dynamic';
}

const CASES: Case[] = [
  { kind: 'a macOS profile', make: inertMobileconfig, label: 'manual' },
  { kind: 'a declaration', make: inertDeclaration, label: 'manual' },
  { kind: 'a Windows profile', make: inertWindowsProfile, label: 'manual' },
  { kind: 'a macOS profile', make: inertMobileconfig, label: 'dynamic' },
];

test.describe('Premium • Controls • Configuration profiles — a targeted label', () => {
  for (const c of CASES) {
    test(`a ${c.label} label that ${c.kind} targets can't be deleted until the profile is gone`, async ({
      labelsPage,
      configurationProfiles,
      workstationsFleetId,
      request,
      pageHealth,
    }) => {
      // The refused delete is a deliberate 422 the app logs to the console.
      pageHealth.disable();

      const n = runNonce();
      const labelName = `pw-bl-${n}`;
      const profile = c.make(`pw-bl-${n}-p`);
      const members = c.label === 'manual' ? await findSimulations(request, 'darwin', 2, SIM_OFFSET) : [];
      if (c.label === 'manual') expect(members, 'needs two online macOS simulations').toHaveLength(2);
      let labelId: number | undefined;
      let uuid: string | undefined;

      try {
        labelId =
          c.label === 'manual'
            ? await createManualLabel(request, labelName, members)
            : // Matches nothing on a real host; which simulations claim it doesn't matter here.
              await createDynamicLabel(request, labelName, 'SELECT 1 FROM osquery_info WHERE 1 = 0;');
        uuid = await uploadProfile(request, workstationsFleetId, profile, { includeAny: [labelName] });

        await labelsPage.goto();
        await labelsPage.runRowAction(labelName, 'Delete');
        await expect(labelsPage.deleteModal).toBeVisible();
        await labelsPage.deleteConfirmButton.click();
        await labelsPage.toast.expectError(REFUSED);

        // Nothing gave way: the label is still listed, with its hosts…
        await labelsPage.goto();
        await expect(await labelsPage.locateRow(labelName)).toBeVisible();
        if (c.label === 'manual') {
          expect([...(await listLabelHostIds(request, labelId))].sort((a, b) => a - b)).toEqual([...members].sort((a, b) => a - b));
        }
        // …and the profile still targets it, unbroken.
        const record = await getProfile(request, uuid);
        expect(record.includeAny).toEqual([labelName]);
        expect(record.broken).toEqual([]);
        await configurationProfiles.goto({ fleetId: workstationsFleetId });
        await configurationProfiles.teamDropdown.select('Workstations');
        await expect(configurationProfiles.labelCount(profile.name)).toHaveText('1 label');
        await expect(configurationProfiles.brokenLabelWarning(profile.name)).toHaveCount(0);

        // Once the profile is gone, the same delete goes through.
        await configurationProfiles.deleteProfile(profile.name);
        uuid = undefined;
        await labelsPage.goto();
        await labelsPage.runRowAction(labelName, 'Delete');
        await labelsPage.deleteConfirmButton.click();
        await labelsPage.toast.expectSuccess(`Successfully deleted ${labelName}.`);
        labelId = undefined;
      } finally {
        if (uuid) await deleteProfile(request, uuid);
        if (labelId !== undefined) await deleteLabelById(request, labelId);
      }
    });
  }
});
