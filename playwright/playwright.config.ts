import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

type Suite = 'free' | 'premium' | 'loadtest';
const VALID_SUITES: readonly Suite[] = ['free', 'premium', 'loadtest'] as const;

// Projects that uniquely target one tier. Setup projects map to the suite
// of the browser project they support. Anything not in this map (cleanup
// dependencies, gitops-verify) is treated as suite-ambiguous and requires
// SUITE= to be set explicitly.
const PROJECT_TO_SUITE: Readonly<Record<string, Suite>> = {
  premium: 'premium',
  'premium-setup': 'premium',
  free: 'free',
  'free-setup': 'free',
  loadtest: 'loadtest',
  'loadtest-setup': 'loadtest',
};

const SUITE_AMBIGUOUS_PROJECTS: ReadonlySet<string> = new Set([
  'cleanup-setup',
  'cleanup-teardown',
  'gitops-verify',
]);

function parseProjectArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') return argv[i + 1];
    if (a.startsWith('--project=')) return a.slice('--project='.length);
  }
  return undefined;
}

function isSuite(s: string | undefined): s is Suite {
  return s !== undefined && (VALID_SUITES as readonly string[]).includes(s);
}

function fail(message: string): never {
  // Throwing at config load makes the suite refuse to start rather than
  // silently load the wrong .env and target the wrong Fleet instance.
  throw new Error(`[playwright.config] ${message}`);
}

function resolveSuite(): Suite {
  const fromEnv = process.env.SUITE;
  const project = parseProjectArg(process.argv);

  if (fromEnv) {
    if (!isSuite(fromEnv)) {
      fail(`Invalid SUITE="${fromEnv}". Expected one of: ${VALID_SUITES.join(', ')}.`);
    }
    const mapped = project ? PROJECT_TO_SUITE[project] : undefined;
    if (mapped && mapped !== fromEnv) {
      fail(
        `SUITE=${fromEnv} conflicts with --project=${project} (which targets ${mapped}). Drop one of them.`,
      );
    }
    return fromEnv;
  }

  if (project) {
    const mapped = PROJECT_TO_SUITE[project];
    if (mapped) return mapped;
    if (SUITE_AMBIGUOUS_PROJECTS.has(project)) {
      fail(
        `--project=${project} can target either tier. Set SUITE=free|premium|loadtest explicitly (the test:gitops-verify:* npm scripts already do this).`,
      );
    }
    const known = [...Object.keys(PROJECT_TO_SUITE), ...SUITE_AMBIGUOUS_PROJECTS]
      .sort()
      .join(', ');
    fail(`Unknown --project="${project}". Known projects: ${known}.`);
  }

  fail(
    `No SUITE env var or --project=<name> given. Use \`npm run test:premium|test:free|test:loadtest\`, or pass both SUITE=<tier> and --project=<name> when running playwright directly.`,
  );
}

const suite = resolveSuite();
// Mirror the resolved suite back into the environment so cleanup.steps.ts
// and any spec code can read process.env.SUITE without a fallback default
// — the "|| 'premium'" fallback was the original silent-footgun pattern.
process.env.SUITE = suite;

dotenv.config({ path: path.resolve(__dirname, `.env.${suite}`), quiet: true });

export default defineConfig({
  globalTeardown: './helpers/perf-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Cap at 2 in every environment — the Fleet QA instance has limited
  // concurrency headroom and higher worker counts surface as flaky
  // navigation timeouts even though the test logic is correct.
  workers: 2,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'html',
  use: {
    baseURL: process.env.FLEET_URL,
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    // ── Premium ────────────────────────────────────────────────────────────────
    {
      name: 'premium-setup',
      testDir: './setup',
      testMatch: /premium\.setup\.ts/,
    },
    // Same wipe steps run twice per browser project:
    //   1. as a dependency (cleanup-setup) — pre-test, so the run is
    //      self-healing regardless of leftover state
    //   2. as a teardown (cleanup-teardown) — post-test, so a crashed
    //      worker still leaves a clean instance
    // Both reference setup/cleanup.steps.ts; project role is decided by
    // whether premium / free lists it under `dependencies` or `teardown`.
    {
      name: 'cleanup-setup',
      testDir: './setup',
      testMatch: /cleanup\.steps\.ts/,
    },
    {
      name: 'cleanup-teardown',
      testDir: './setup',
      testMatch: /cleanup\.steps\.ts/,
    },
    // Project scope is set by folder, not by tag. Premium picks up
    // tests/e2e/premium/, tests/e2e/shared/, tests/api/ (minus the
    // free-only and gitops-verify subtrees, plus the dedicated loadtest
    // tree). Free is the mirror image.
    {
      name: 'premium',
      testDir: './tests',
      testIgnore: ['**/gitops-verify/**', '**/free/**', '**/loadtest/**'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/premium-admin.json',
      },
      dependencies: ['premium-setup', 'cleanup-setup'],
      teardown: 'cleanup-teardown',
    },

    // ── Free ───────────────────────────────────────────────────────────────────
    {
      name: 'free-setup',
      testDir: './setup',
      testMatch: /free\.setup\.ts/,
    },
    {
      name: 'free',
      testDir: './tests',
      testIgnore: ['**/gitops-verify/**', '**/premium/**', '**/loadtest/**'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/free-admin.json',
      },
      dependencies: ['free-setup', 'cleanup-setup'],
      teardown: 'cleanup-teardown',
    },

    // ── GitOps Verify (post-gitops state checks) ──────────────────────────────
    // Pure API tests, no browser. Reads the gitops dir at GITOPS_DIR (default
    // ../gitops/free-fleetqa) and asserts the live Fleet instance matches.
    {
      name: 'gitops-verify',
      testDir: './tests/api/gitops-verify',
      use: {
        extraHTTPHeaders: {
          Authorization: `Bearer ${process.env.FLEET_API_TOKEN ?? ''}`,
        },
      },
      retries: 0,
    },

    // ── Loadtest ───────────────────────────────────────────────────────────────
    {
      name: 'loadtest-setup',
      testDir: './setup',
      testMatch: /loadtest\.setup\.ts/,
    },
    {
      name: 'loadtest',
      testDir: './tests/loadtest',
      timeout: 60000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/loadtest-admin.json',
      },
      expect: { timeout: 30000 },
      dependencies: ['loadtest-setup'],
      retries: 0,
    },
  ],
});
