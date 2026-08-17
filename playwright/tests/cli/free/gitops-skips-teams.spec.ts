/**
 * Fleets are premium-only, so `fleetctl gitops` on free must skip every team
 * file — loudly, and without failing the run.
 *
 * This matters more than a skipped-file message usually would: the repository
 * `fleetctl new` hands every new customer ships `fleets/workstations.yml` and
 * `fleets/personal-mobile-devices.yml`. On free, both are inert. A free-tier
 * user who follows Fleet's own onboarding gets a repo that silently manages less
 * than it appears to, and this line is the only thing telling them so.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fleetctl, output } from '@helpers/fleetctl';

const DRY_RUN_ENV = { FLEET_ENROLL_SECRET: 'dry-run-placeholder-secret' };

test.describe('fleetctl gitops · free skips team configs', () => {
  test('skips every fleet file in the fleetctl new scaffold', async () => {
    test.setTimeout(180_000);

    const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-skip-')), 'repo');
    const created = await fleetctl(['new', '--org-name', 'Free Skip Org', '--dir', root], {
      withoutConfig: true,
    });
    expect(created.code, `scaffold failed: ${output(created)}`).toBe(0);

    const fleetFiles = fs
      .readdirSync(path.join(root, 'fleets'))
      .filter((f) => f.endsWith('.yml'))
      .map((f) => path.join(root, 'fleets', f));
    expect(fleetFiles.length, 'scaffold should ship fleet manifests').toBeGreaterThan(0);

    const args = ['gitops', '--dry-run', '-f', path.join(root, 'default.yml')];
    for (const file of fleetFiles) args.push('-f', file);

    const res = await fleetctl(args, { env: DRY_RUN_ENV });

    // Skipping is not an error — the global config still applies.
    expect(res.code, `dry run failed:\n${output(res)}`).toBe(0);
    expect(output(res)).toContain('gitops dry run succeeded');

    for (const file of fleetFiles) {
      expect(output(res)).toContain(
        `[!] skipping team config ${file} since teams are only supported for premium Fleet users`,
      );
    }
  });
});
