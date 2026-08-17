/**
 * `fleetctl new` scaffolds a GitOps repository. It never contacts a server, so
 * it behaves identically on both tiers and runs with `withoutConfig`.
 *
 * This is the repo Fleet hands a brand-new customer, so the value here is that
 * the scaffold is complete and its org name substitution survives — not that
 * every .gitkeep is present.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fleetctl, output } from '@helpers/fleetctl';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fleetctl-new-'));
}

test.describe('fleetctl new', () => {
  test('scaffolds a GitOps repository with the given org name', async () => {
    const root = path.join(tempDir(), 'it-and-security');
    const res = await fleetctl(['new', '--org-name', 'Playwright QA Org', '--dir', root], {
      withoutConfig: true,
    });

    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Created new Fleet GitOps repository');
    expect(res.stdout).toContain('Organization name: Playwright QA Org');

    for (const expected of ['default.yml', 'README.md', '.gitignore']) {
      expect(fs.existsSync(path.join(root, expected)), `${expected} missing`).toBe(true);
    }

    const doc = yaml.load(fs.readFileSync(path.join(root, 'default.yml'), 'utf-8')) as {
      org_settings: { org_info: { org_name: string } };
    };
    expect(doc.org_settings.org_info.org_name).toBe('Playwright QA Org');
  });

  test('scaffolds the fleet manifests and CI workflow', async () => {
    const root = path.join(tempDir(), 'it-and-security');
    const res = await fleetctl(['new', '--org-name', 'Playwright QA Org', '--dir', root], {
      withoutConfig: true,
    });
    expect(res.code).toBe(0);

    for (const expected of [
      'fleets/workstations.yml',
      'fleets/personal-mobile-devices.yml',
      '.github/workflows/workflow.yml',
      '.gitlab-ci.yml',
    ]) {
      expect(fs.existsSync(path.join(root, expected)), `${expected} missing`).toBe(true);
    }
  });

  test('prints the GitOps user setup next steps', async () => {
    const root = path.join(tempDir(), 'it-and-security');
    const res = await fleetctl(['new', '--org-name', 'Playwright QA Org', '--dir', root], {
      withoutConfig: true,
    });

    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Next steps:');
    expect(res.stdout).toContain('--global-role gitops --api-only');
  });

  test('refuses to write into an existing directory without --force', async () => {
    const root = path.join(tempDir(), 'it-and-security');
    const first = await fleetctl(['new', '--org-name', 'First', '--dir', root], {
      withoutConfig: true,
    });
    expect(first.code).toBe(0);

    const second = await fleetctl(['new', '--org-name', 'Second', '--dir', root], {
      withoutConfig: true,
    });
    expect(second.code).toBe(1);
    expect(output(second)).toContain('already exists; use --force');

    const forced = await fleetctl(['new', '--org-name', 'Second', '--dir', root, '--force'], {
      withoutConfig: true,
    });
    expect(forced.code).toBe(0);

    const doc = yaml.load(fs.readFileSync(path.join(root, 'default.yml'), 'utf-8')) as {
      org_settings: { org_info: { org_name: string } };
    };
    expect(doc.org_settings.org_info.org_name).toBe('Second');
  });

  test('requires an organization name', async () => {
    const root = path.join(tempDir(), 'it-and-security');
    // An empty --org-name skips the interactive prompt and fails validation,
    // which keeps the assertion deterministic in a non-TTY runner.
    const res = await fleetctl(['new', '--org-name', '   ', '--dir', root], {
      withoutConfig: true,
    });
    expect(res.code).toBe(1);
    expect(output(res)).toContain('organization name is required');
  });
});
