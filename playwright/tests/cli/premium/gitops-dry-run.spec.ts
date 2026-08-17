/**
 * The premium half of the tier split in `fleetctl gitops`: fleet files are
 * processed rather than skipped, and `--delete-other-fleets` is honoured.
 *
 * The mirror of `tests/cli/free/gitops-skips-teams.spec.ts`. Both drive a fresh
 * `fleetctl new` scaffold so neither depends on whatever the nightly last applied.
 *
 * Everything here is `--dry-run`. A real apply of this scaffold would create a
 * `💻 Workstations` fleet distinct from the gitops-provisioned `Workstations`,
 * and — with `--delete-other-fleets` — remove every fleet the instance has.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fleetctl, output } from '@helpers/fleetctl';

const DRY_RUN_ENV = { FLEET_ENROLL_SECRET: 'dry-run-placeholder-secret' };

async function scaffoldWithFleets(): Promise<{ root: string; fleetFiles: string[] }> {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-premium-gitops-')), 'repo');
  const created = await fleetctl(['new', '--org-name', 'Premium Dry Run Org', '--dir', root], {
    withoutConfig: true,
  });
  expect(created.code, `scaffold failed: ${output(created)}`).toBe(0);

  const fleetFiles = fs
    .readdirSync(path.join(root, 'fleets'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => path.join(root, 'fleets', f));
  expect(fleetFiles.length, 'scaffold should ship fleet manifests').toBeGreaterThan(0);

  return { root, fleetFiles };
}

test.describe('fleetctl gitops --dry-run · premium', () => {
  test('processes fleet configs instead of skipping them', async () => {
    test.setTimeout(180_000);
    const { root, fleetFiles } = await scaffoldWithFleets();

    const args = ['gitops', '--dry-run', '-f', path.join(root, 'default.yml')];
    for (const file of fleetFiles) args.push('-f', file);

    const res = await fleetctl(args, { env: DRY_RUN_ENV });
    expect(res.code, `dry run failed:\n${output(res)}`).toBe(0);
    expect(output(res)).toContain('gitops dry run succeeded');

    expect(output(res), 'premium must not skip team configs').not.toContain(
      'teams are only supported for premium Fleet users',
    );
    expect(output(res)).toMatch(/would've applied \d+ fleet/);
  });

  test('--delete-other-fleets proposes removing fleets absent from the config', async () => {
    test.setTimeout(180_000);
    const { root, fleetFiles } = await scaffoldWithFleets();

    const args = ['gitops', '--dry-run', '--delete-other-fleets', '-f', path.join(root, 'default.yml')];
    for (const file of fleetFiles) args.push('-f', file);

    const res = await fleetctl(args, { env: DRY_RUN_ENV });
    expect(res.code, `dry run failed:\n${output(res)}`).toBe(0);

    // The scaffold names none of this instance's fleets, so every one of them —
    // Workstations included — is proposed for deletion. Proposed only: this is
    // the flag whose real invocation would wipe the gitops-provisioned fleet.
    expect(output(res)).toMatch(/would've deleted .*fleet/i);
  });
});
