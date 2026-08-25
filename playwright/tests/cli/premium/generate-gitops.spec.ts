/**
 * Premium-only shape and flags of `generate-gitops`, asserted against the live
 * instance rather than a known applied config.
 *
 * The entity-set comparison against the min GitOps config lives in
 * `tests/cli/nightly/`, which runs in the nightly chain only. What is
 * left here is tier shape, which holds whatever state the instance is in.
 */
import { test, expect } from '@playwright/test';
import { fleetctl, output } from '@helpers/fleetctl';

test.describe('fleetctl generate-gitops · premium', () => {
  test('emits premium-only SSO JIT provisioning', async () => {
    const res = await fleetctl(['generate-gitops', '--key', 'org_settings.sso_settings']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('enable_jit_provisioning');
  });

  test('scopes controls to a fleet rather than the global config', async () => {
    const globalControls = await fleetctl(['generate-gitops', '--key', 'controls']);
    expect(globalControls.code).toBe(0);
    // Premium keeps controls per-fleet, so the global config carries none.
    expect(output(globalControls)).toContain('Key controls not found in default.yml');

    const fleetControls = await fleetctl([
      'generate-gitops',
      '--fleet',
      'Workstations',
      '--key',
      'controls',
    ]);
    expect(fleetControls.code).toBe(0);
    expect(fleetControls.stdout).toContain('enable_disk_encryption');
  });

  test('rejects --dir and --key together', async () => {
    const res = await fleetctl(['generate-gitops', '--dir', '/tmp/unused', '--key', 'controls']);
    expect(output(res)).toContain('Only one of --dir or --key may be specified');
  });

  test('requires one of --dir or --key', async () => {
    const res = await fleetctl(['generate-gitops']);
    expect(output(res)).toContain('Either --dir or --key must be specified');
  });

  test('reports an unknown fleet by name', async () => {
    const res = await fleetctl([
      'generate-gitops',
      '--fleet',
      'no-such-fleet-here',
      '--key',
      'controls',
    ]);
    expect(output(res)).toContain('not found');
  });
});
