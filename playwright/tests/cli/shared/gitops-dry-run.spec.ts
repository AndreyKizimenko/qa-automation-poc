/**
 * `fleetctl gitops --dry-run` — validation and the promise that it changes nothing.
 *
 * The fixture is a fresh `fleetctl new` scaffold rather than anything under
 * `gitops/`. That buys three things: it needs no environment beyond `FLEET_URL`
 * (the repo configs interpolate ABM/VPP/SSO vars the suite deliberately does not
 * require), it cannot be perturbed by whatever the nightly last applied, and it
 * doubles as a check that the repository Fleet hands new customers actually
 * validates against a real server.
 *
 * Tier-specific behaviour lives next door: the free team-skip in
 * `tests/cli/free/gitops-skips-teams.spec.ts`, the premium counterpart in
 * `tests/cli/premium/gitops-dry-run.spec.ts`.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { apiUrl, authHeaders } from '@helpers/api';
import { fleetctl, output } from '@helpers/fleetctl';

/** A placeholder the scaffold interpolates; never applied, since every run is a dry run. */
const DRY_RUN_ENV = { FLEET_ENROLL_SECRET: 'dry-run-placeholder-secret' };

async function scaffold(): Promise<string> {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-gitops-')), 'repo');
  const res = await fleetctl(['new', '--org-name', 'Dry Run Org', '--dir', root], {
    withoutConfig: true,
  });
  expect(res.code, `scaffold failed: ${output(res)}`).toBe(0);
  return root;
}

test.describe('fleetctl gitops --dry-run', () => {
  test('validates the fleetctl new scaffold without changing anything', async ({ request }) => {
    test.setTimeout(180_000);
    const root = await scaffold();

    const before = await request.get(apiUrl('labels'), { headers: authHeaders() });
    await expect(before).toBeOK();
    const labelsBefore = ((await before.json()).labels as Array<{ name: string }>).map(
      (l) => l.name,
    );

    const res = await fleetctl(['gitops', '--dry-run', '-f', path.join(root, 'default.yml')], {
      env: DRY_RUN_ENV,
    });
    expect(res.code, `dry run failed:\n${output(res)}`).toBe(0);
    expect(output(res)).toContain('gitops dry run succeeded');

    // The scaffold declares none of this instance's labels, so the dry run
    // announces deleting them. Nothing may actually go.
    expect(output(res)).toMatch(/would've deleted/);

    const after = await request.get(apiUrl('labels'), { headers: authHeaders() });
    await expect(after).toBeOK();
    const labelsAfter = ((await after.json()).labels as Array<{ name: string }>).map((l) => l.name);

    expect(labelsAfter.sort(), 'a dry run must not delete anything').toEqual(labelsBefore.sort());
  });

  test('rejects an unknown key', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-gitops-bad-'));
    const file = path.join(dir, 'default.yml');
    fs.writeFileSync(file, 'org_settings:\n  bogus_key: true\n');

    const res = await fleetctl(['gitops', '--dry-run', '-f', file]);
    expect(res.code).toBe(1);
    expect(output(res)).toContain('unknown key "org_settings.bogus_key"');
  });

  test('reports a missing config file', async () => {
    const missing = path.join(os.tmpdir(), 'fleetctl-gitops-does-not-exist.yml');

    const res = await fleetctl(['gitops', '--dry-run', '-f', missing]);
    expect(res.code).toBe(1);
    expect(output(res)).toContain('failed to read file');
  });
});
