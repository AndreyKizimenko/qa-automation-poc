/**
 * Free • Hosts • Which MDM actions Fleet offers, per platform.
 *
 * Free counterpart of the premium spec. The matrix inverts almost entirely, which
 * is the point of having both: **Lock and Wipe are Fleet Premium features**
 * (`canLockHost` / `canWipeHost` both start at `isPremiumTier`), while
 * **Turn off MDM has no premium gate at all** — so on free an MDM-enrolled Apple
 * host offers Turn off MDM and nothing else, and every other platform offers none
 * of the three.
 *
 * That makes this the paywall assertion for Lock/Wipe, in the same spirit as
 * `tests/e2e/free/paywalls.spec.ts`.
 *
 * **It only ever opens the Actions menu. Nothing here clicks a destructive item.**
 *
 * Derived from `HostActionsDropdown/helpers.tsx`; see the premium spec for the
 * per-gate reasoning and why Linux needs no `kind` constraint.
 */
import { test, expect } from '@fixtures';
import { findOnlineHost } from '@helpers/api';

const MDM_ACTIONS = ['Lock', 'Wipe', 'Turn off MDM'] as const;

interface AvailabilityCase {
  label: string;
  platform: 'darwin' | 'windows' | 'linux';
  realDevice: boolean;
  /** Of the three actions, the ones Fleet should offer for this case. */
  offered: string[];
}

const CASES: AvailabilityCase[] = [
  {
    label: 'macOS (MDM-enrolled)',
    platform: 'darwin' as const,
    realDevice: true,
    // Turn off MDM is not premium-gated; Lock and Wipe are.
    offered: ['Turn off MDM'],
  },
  {
    label: 'Windows (MDM-enrolled)',
    platform: 'windows' as const,
    realDevice: true,
    // Lock/Wipe premium-gated, and Turn off MDM is Apple-only.
    offered: [],
  },
  {
    label: 'Ubuntu (no MDM)',
    platform: 'linux' as const,
    realDevice: false,
    offered: [],
  },
];

test.describe('Free • Hosts • MDM action availability', () => {
  for (const testCase of CASES) {
    const summary = testCase.offered.length
      ? `offers only ${testCase.offered.join(' + ')}`
      : 'offers none of Lock, Wipe or Turn off MDM';

    test(`${testCase.label} ${summary}`, async ({ hostDetails, request }) => {
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
