/**
 * Asserts `fleetctl generate-gitops` reproduces the min GitOps config that was
 * just applied to the instance.
 *
 * Runs in the nightly GitOps chain only (`--project=gitops-nightly`),
 * immediately after the min apply. Ordering is load-bearing: the Playwright
 * suite's cleanup-setup project drains every global report before its first
 * test, so once that has run the report assertion below compares against an
 * empty instance and means nothing.
 */
import { test, expect } from '@playwright/test';
import { generate, minConfig, minConfigLabel, names, at } from './_generated';

const isPremium = process.env.SUITE === 'premium';

test.describe(`generate-gitops · ${minConfigLabel}`, () => {
  // TODO(fleetdm/fleet#53965): generate-gitops exits 1 on Free whenever Apple MDM
  // is configured — generateControls calls generateAssets, which 402s on Free —
  // so it writes nothing to compare. free-fleetqa has Apple MDM on, so every test
  // here fails on Free. Premium is unaffected. Un-skip when the assets fetch is
  // skipped on Free.
  test.skip(!isPremium, 'fleetdm/fleet#53965 — generate-gitops exits 1 on Free with Apple MDM on');

  test('reproduces the applied label set', async () => {
    const { global } = await generate();
    const expected = minConfig.labels.map((l) => l.name).sort();
    expect(names(global, 'labels').sort()).toEqual(expected);
  });

  test('reproduces the applied global policy set', async () => {
    const { global } = await generate();
    const expected = minConfig.policies.map((p) => p.name).sort();
    expect(names(global, 'policies').sort()).toEqual(expected);
  });

  test('reproduces the applied global report set', async () => {
    const { global } = await generate();
    const expected = minConfig.reports.map((r) => r.name).sort();
    const actual = names(global, 'reports').sort();
    expect(
      actual,
      actual.length === 0
        ? 'the instance has no global reports — this project must run in the nightly GitOps ' +
          "chain right after the min apply, before the Playwright suite's cleanup-setup " +
          'drains them'
        : 'generated report set does not match the applied min config',
    ).toEqual(expected);
  });

  test('reproduces the applied org name', async () => {
    const { global } = await generate();
    expect(at(global, 'org_settings.org_info.org_name')).toBe(minConfig.orgName);
  });

  test('emits the tier-appropriate file structure', async () => {
    const { global, fleets } = await generate();

    if (isPremium) {
      // Fleets are premium-only, and the min config provisions Workstations and
      // Compliance; generate-gitops also emits the no-team scope as a fleet file.
      expect(fleets.has('workstations')).toBe(true);
      expect(fleets.has('compliance')).toBe(true);
      expect(fleets.has('unassigned')).toBe(true);

      const workstations = fleets.get('workstations')!;
      expect(workstations.doc).toHaveProperty('name');
      expect(workstations.doc).toHaveProperty('controls');
      // Controls live per-fleet on premium rather than at global scope.
      expect(global.doc).not.toHaveProperty('controls');
    } else {
      // Free has no fleets, so controls collapse onto the global scope and
      // software — a premium-only feature — is never emitted.
      expect(fleets.size).toBe(0);
      expect(global.doc).toHaveProperty('controls');
      expect(global.doc).not.toHaveProperty('software');
    }
  });
});
