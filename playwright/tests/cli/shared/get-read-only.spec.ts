/**
 * The read-only `fleetctl get` surface that behaves identically on both tiers.
 *
 * Assertions are structural — an exit code plus one shape property per
 * subcommand (a table header, a YAML `kind`). Data contracts belong to
 * `tests/api/`; the instances are mutable and asserting on their contents here
 * would duplicate that coverage and flake against it.
 */
import { test, expect } from '@playwright/test';
import { withApiRequest } from '@helpers/api';
import { findOnlineHost } from '@helpers/api/hosts';
import { fleetctl, output } from '@helpers/fleetctl';

test.describe('fleetctl · read-only get subcommands', () => {
  test('get labels renders a table', async () => {
    const res = await fleetctl(['get', 'labels']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('NAME');
    expect(res.stdout).toContain('PLATFORM');
  });

  test('get user_roles renders a table', async () => {
    const res = await fleetctl(['get', 'user_roles']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('USER');
    expect(res.stdout).toContain('GLOBAL ROLE');
  });

  test('get enroll_secret emits an enroll_secret spec', async () => {
    const res = await fleetctl(['get', 'enroll_secret']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('kind: enroll_secret');
    expect(res.stdout).toContain('apiVersion: v1');
  });

  test('get software renders a table', async () => {
    const res = await fleetctl(['get', 'software']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('VERSIONS');
    expect(res.stdout).toContain('VULNERABILITIES');
  });

  test('get mdm-apple reports APNs certificate details', async () => {
    const res = await fleetctl(['get', 'mdm-apple']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Common name (CN):');
    expect(res.stdout).toContain('Renew date:');
  });

  test('get mdm-commands lists the commands run on a host', async () => {
    // `--host` is required (fleetdm/fleet#45476), and it takes a hostname, UUID
    // or serial. The host is resolved at run time: the pools are osquery-perf
    // simulations whose names change on every daemon restart.
    const host = await withApiRequest(async (request) => {
      for (const platform of ['darwin', 'windows', 'linux'] as const) {
        const found = await findOnlineHost(request, platform);
        if (found) return found;
      }
      return null;
    });
    test.skip(!host, 'no online host to query MDM commands for');

    const res = await fleetctl(['get', 'mdm-commands', '--host', host!.displayName]);
    expect(res.code).toBe(0);
    // Either a populated table or the explicit empty state — both are healthy.
    expect(output(res)).toMatch(/most recent commands|No MDM commands/);
  });

  test('get carves succeeds', async () => {
    const res = await fleetctl(['get', 'carves']);
    expect(res.code).toBe(0);
  });

  test('debug migrations reports the schema is current', async () => {
    const res = await fleetctl(['debug', 'migrations']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Migrations up-to-date.');
  });
});
