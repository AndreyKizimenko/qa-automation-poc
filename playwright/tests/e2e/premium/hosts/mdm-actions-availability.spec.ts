/**
 * Premium • Hosts • Which MDM actions Fleet offers, per platform.
 *
 * The safe half of the Lock/Wipe coverage: it asserts the **permission surface**
 * — that Lock, Wipe and Turn off MDM appear (or don't) for the right platform and
 * tier — without ever firing one. Actually locking or wiping a QA VM is a one-way
 * door with no re-provisioning automation, so those stay uncovered on purpose
 * (see docs/qawolf-migration/PARITY.md §6). This spec closes the RBAC/gating half
 * of that gap.
 *
 * **It only ever opens the Actions menu. Nothing here clicks a destructive item.**
 *
 * The expected matrix is derived from `HostActionsDropdown/helpers.tsx`, and two
 * parts of it are counter-intuitive enough to be worth stating:
 *
 *   - **Turn off MDM is Apple-only.** `canTurnOffMdm` requires
 *     `isAppleDevice(hostPlatform)`, so a Windows host does not offer it even
 *     when it is MDM-enrolled and connected.
 *   - **Lock and Wipe do not need MDM on Linux.** Both allow `isLinuxLike`
 *     outright (Fleet drives them via scripts), so the Ubuntu VM offers them
 *     despite having no MDM enrollment at all.
 *
 * Host choice per platform reflects what each gate actually reads:
 *   - macOS/Windows need a *real, MDM-enrolled, connected* host → `kind: 'real'`.
 *   - Linux's gates are platform + tier only, so any online Linux host is a valid
 *     subject and no `kind` is required.
 */
import { test, expect } from '@fixtures';
import { findOnlineHost } from '@helpers/api';

/** The three actions under test; every case asserts each one present or absent. */
const MDM_ACTIONS = ['Lock', 'Wipe', 'Turn off MDM'] as const;

const CASES = [
  {
    label: 'macOS (MDM-enrolled)',
    platform: 'darwin' as const,
    realDevice: true,
    offered: ['Lock', 'Wipe', 'Turn off MDM'],
  },
  {
    label: 'Windows (MDM-enrolled)',
    platform: 'windows' as const,
    realDevice: true,
    // No Turn off MDM: canTurnOffMdm is gated on isAppleDevice.
    offered: ['Lock', 'Wipe'],
  },
  {
    label: 'Ubuntu (no MDM)',
    platform: 'linux' as const,
    realDevice: false,
    // Lock and Wipe still apply — isLinuxLike needs no MDM. Turn off MDM does.
    offered: ['Lock', 'Wipe'],
  },
];

test.describe('Premium • Hosts • MDM action availability', () => {
  for (const testCase of CASES) {
    test(`${testCase.label} offers ${testCase.offered.join(' + ')}`, async ({
      hostDetails,
      request,
    }) => {
      const host = await findOnlineHost(
        request,
        testCase.platform,
        testCase.realDevice ? { kind: 'real' } : {},
      );
      expect(host, `expected an online ${testCase.platform} host`).not.toBeNull();

      await hostDetails.goto(host!.id);
      await hostDetails.openActions();

      for (const action of MDM_ACTIONS) {
        const shouldBeOffered = testCase.offered.includes(action);
        await expect(
          hostDetails.actionOption(action),
          `${action} on ${testCase.label} should be ${shouldBeOffered ? 'offered' : 'withheld'}`,
        ).toHaveCount(shouldBeOffered ? 1 : 0);
      }
    });
  }
});
