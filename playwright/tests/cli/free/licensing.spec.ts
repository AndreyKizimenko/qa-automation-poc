/**
 * Every fleetctl command that Fleet gates behind a premium licence must refuse
 * on free, with the licence error rather than a generic failure.
 *
 * Mutating commands are asserted through their *denial* only — the call never
 * reaches a host, so nothing here needs a host to target.
 */
import { test, expect } from '@playwright/test';
import { fleetctl, output } from '@helpers/fleetctl';

const LICENCE_ERROR = /missing or invalid license/;

test.describe('fleetctl · free licence gating', () => {
  test('get fleets is refused', async () => {
    const res = await fleetctl(['get', 'fleets']);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(LICENCE_ERROR);
  });

  test('get teams (deprecated alias) is refused', async () => {
    const res = await fleetctl(['get', 'teams']);
    expect(res.code).toBe(1);
    expect(output(res)).toMatch(/'fleetctl teams' is deprecated; use 'fleets' instead/);
    expect(res.stderr).toMatch(LICENCE_ERROR);
  });

  test('get mdm-apple-bm is refused', async () => {
    const res = await fleetctl(['get', 'mdm-apple-bm']);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(LICENCE_ERROR);
  });

  // TODO(fleetdm/fleet#53965): generate-gitops exits 1 on Free whenever Apple MDM
  // is configured — generateControls calls generateAssets, which 402s on Free —
  // so it writes nothing and these two premium-omission assertions can't run.
  // This instance has Apple MDM on, so it fails every time. Un-skip when the
  // assets fetch is skipped on Free.
  test('generate-gitops omits premium-only SSO fields', async () => {
    test.skip(
      true,
      'fleetdm/fleet#53965 — generate-gitops exits 1 on Free with Apple MDM on',
    );
    const res = await fleetctl(['generate-gitops', '--key', 'org_settings.sso_settings']);
    expect(res.code).toBe(0);
    // JIT provisioning is premium-only, so the key must be absent entirely
    // rather than emitted as false.
    expect(res.stdout).not.toContain('enable_jit_provisioning');
    expect(res.stdout).toContain('enable_sso');
  });

  // TODO(fleetdm/fleet#53965): same cause as above.
  test('generate-gitops omits software, which is premium-only', async () => {
    test.skip(
      true,
      'fleetdm/fleet#53965 — generate-gitops exits 1 on Free with Apple MDM on',
    );
    const res = await fleetctl(['generate-gitops', '--key', 'software']);
    expect(res.code).toBe(0);
    expect(output(res)).toContain('Key software not found');
  });
});
