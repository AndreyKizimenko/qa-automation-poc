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
  'gitops-mode': 'premium',
  'gitops-mode-teardown': 'premium',
  'premium-exclusive': 'premium',
  free: 'free',
  'free-exclusive': 'free',
  'free-setup': 'free',
  loadtest: 'loadtest',
  'loadtest-setup': 'loadtest',
  'loadtest-api': 'loadtest',
};

const SUITE_AMBIGUOUS_PROJECTS: ReadonlySet<string> = new Set([
  'cleanup-setup',
  'cleanup-teardown',
  'gitops-verify',
  'gitops-nightly',
]);

function parseProjectArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') return argv[i + 1];
    if (a.startsWith('--project=')) return a.slice('--project='.length);
  }
  return undefined;
}

/** Every `--project` named on the command line. */
function parseProjectArgs(argv: readonly string[]): string[] {
  const names: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' && argv[i + 1]) names.push(argv[i + 1]);
    else if (a.startsWith('--project=')) names.push(a.slice('--project='.length));
  }
  return names;
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

// A main project and its exclusive one must never share an invocation: the
// exclusive project depends only on login setup, so in one invocation the two
// would run side by side — the one thing the exclusive specs exist to avoid.
// gitops-mode can't share one with any other browser project either: enabling
// gitops mode makes every mutating control read-only.
// Worker processes get no `--project` flags, so this only ever acts in the runner.
{
  const named = parseProjectArgs(process.argv);
  for (const tier of ['premium', 'free']) {
    if (named.includes(tier) && named.includes(`${tier}-exclusive`)) {
      fail(
        `--project=${tier} and --project=${tier}-exclusive can't run in one invocation — the exclusive specs would run beside the main ones. Run them one after the other (npm run test:${tier} does).`,
      );
    }
  }
  // One invocation loads one `.env.<suite>`, so projects of two tiers in one
  // invocation would point the second tier's setup and specs at the first
  // tier's instance — its login state written with the other instance's session.
  const tiers = [...new Set(named.map((n) => PROJECT_TO_SUITE[n]).filter(Boolean))];
  if (tiers.length > 1) {
    fail(
      `--project=${named.join(', --project=')} target ${tiers.join(' and ')} — one invocation loads one instance's .env. Run each tier in its own invocation.`,
    );
  }
  if (named.includes('gitops-mode')) {
    const beside = named.filter(
      (n) => n !== 'gitops-mode' && PROJECT_TO_SUITE[n] !== undefined && !n.endsWith('-setup'),
    );
    if (beside.length) {
      fail(
        `--project=gitops-mode can't run in one invocation with --project=${beside.join(', ')} — gitops mode would disable every control they click. Run it on its own, after them (npm run test:premium does).`,
      );
    }
  }
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
  // In CI the whole run stops at 100 min — under the job's 120-min limit — so a
  // run that grows too long ends with its remaining tests marked not run and the
  // HTML report written, instead of being killed by the job timeout with no
  // report at all. The real-VM specs are what make a run long: each VM works one
  // queue, and a retried VM test can cost 5–15 min.
  globalTimeout: process.env.CI ? 100 * 60_000 : 0,
  // CI runs free at 2 and premium at 3 — the shared Fleet QA instances have
  // limited concurrency headroom, and more workers there surface as flaky
  // navigation timeouts under load even when the test logic is correct.
  // Premium's third worker leans on its MySQL's 2 CPU / 4 GB; the real VMs
  // still work one queue each, so VM specs share it. Local dev defaults to 4
  // for faster feedback. `WORKERS` env or `--workers=N` overrides either.
  workers: process.env.WORKERS
    ? Number(process.env.WORKERS)
    : process.env.CI
      ? suite === 'premium' ? 3 : 2
      : 4,
  // Fleet serves /assets/bundle-*.js without Cache-Control, so Cloudflare
  // doesn't cache it (cf-cache-status: DYNAMIC) and every cold browser
  // context refetches the 4.7 MB bundle from origin. Under origin load
  // that can exceed Playwright's default 30 s and surface as `page.goto`
  // timeouts with a blank screenshot. Drop back to 30 s once
  // fleetdm/fleet#45682 ships and the bundle is edge-cached.
  timeout: 60000,
  // Web-first assertions get a wider window than Playwright's 5s default: the
  // shared QA instance renders slowly under concurrent load (the bundle refetch
  // noted above), so transient render latency shouldn't surface as a flake.
  expect: { timeout: 10_000 },
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
    // Playback throttle for watching a headed run by eye: PW_SLOW_MO=500 pauses
    // half a second between browser actions. Unset resolves to 0, so normal and
    // CI runs are unaffected.
    launchOptions: { slowMo: Number(process.env.PW_SLOW_MO) || 0 },
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
      testIgnore: [
        '**/gitops-verify/**',
        '**/cli/nightly/**',
        '**/free/**',
        '**/loadtest/**',
        // Enabling gitops mode is a global config write that disables the
        // controls every other mutating spec depends on. It gets its own
        // single-worker project, run in its own invocation after this one's.
        '**/gitops-mode/**',
        // Specs that hold a global lock of their own; see premium-exclusive.
        '**/exclusive/**',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/premium-admin.json',
      },
      dependencies: ['premium-setup', 'cleanup-setup'],
      teardown: 'cleanup-teardown',
    },

    // ── Exclusive (its own invocation after the main project, single worker) ───
    // For specs that flip a global setting which breaks whatever runs beside
    // them — turning off script execution makes Fleet refuse every new script
    // run and hold every queued one — and for specs that need a real VM's queue
    // to themselves: a policy automation's runs queue below every user-requested
    // one, so beside the install specs they starve. They live under an
    // `exclusive/` folder in their tier's tree, and run only once every parallel
    // spec has finished.
    //
    // "After the main project" is ordered by running them as a separate
    // `playwright test` invocation (a second CI step; `npm run test:premium`
    // chains the two), not by a dependency on the main project: a dependency
    // that fails skips its dependents, so one unrelated red test would take
    // every exclusive spec with it. They depend only on login setup, and share
    // cleanup-teardown so a dead exclusive spec's switch is put back.
    {
      name: 'premium-exclusive',
      testDir: './tests/e2e',
      testMatch: ['**/shared/exclusive/**/*.spec.ts', '**/premium/exclusive/**/*.spec.ts'],
      workers: 1,
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/premium-admin.json',
      },
      dependencies: ['premium-setup'],
      teardown: 'cleanup-teardown',
    },

    // ── GitOps mode (its own invocation after the exclusive specs, one worker) ─
    // Enabling gitops mode is a global config write that makes every mutating
    // control read-only, so these specs run alone: CI's third `playwright test`
    // step, and `npm run test:premium`'s third invocation. Like the exclusive
    // projects they depend only on login setup — a dependency on `premium` would
    // skip them whenever one unrelated main-project test is red, and put the
    // whole suite in front of a local `npm run test:gitops-mode`.
    // The teardown turns the flag back off however the run ended. It is not the
    // only safety net: `cleanup-setup` clears the flag too, because a Playwright
    // teardown project doesn't run on a SIGKILL and a stuck flag disables the
    // *next* run's entire premium suite.
    {
      name: 'gitops-mode-teardown',
      testDir: './setup',
      testMatch: /gitops-mode\.teardown\.ts/,
    },
    {
      name: 'gitops-mode',
      testDir: './tests/e2e/premium/gitops-mode',
      workers: 1,
      // Explicit even though `workers: 1` already serialises: the top-level
      // `fullyParallel: true` would otherwise interleave a file's tests across
      // the single worker's queue, and zz-everything-is-back.spec.ts has to run
      // after everything that turns the flag on.
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/premium-admin.json',
      },
      dependencies: ['premium-setup'],
      teardown: 'gitops-mode-teardown',
      // A retry re-enters a test whose setup assumes a known exception state,
      // and a gitops failure is something to read rather than paper over.
      retries: 0,
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
      testIgnore: [
        '**/gitops-verify/**',
        '**/cli/nightly/**',
        '**/premium/**',
        '**/loadtest/**',
        // Specs that hold a global lock of their own; see premium-exclusive.
        '**/exclusive/**',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/free-admin.json',
      },
      dependencies: ['free-setup', 'cleanup-setup'],
      teardown: 'cleanup-teardown',
    },
    {
      name: 'free-exclusive',
      testDir: './tests/e2e',
      testMatch: ['**/shared/exclusive/**/*.spec.ts', '**/free/exclusive/**/*.spec.ts'],
      workers: 1,
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/free-admin.json',
      },
      dependencies: ['free-setup'],
      teardown: 'cleanup-teardown',
    },

    // ── GitOps Verify (post-gitops state checks) ──────────────────────────────
    // Pure API tests, no browser. Reads the gitops target at GITOPS_TARGET
    // (default ../gitops/free-fleetqa) and asserts the live Fleet instance matches.
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

    // ── gitops-nightly (nightly GitOps chain only) ────────────────────────────
    // CLI checks that are only meaningful in one window: immediately after the
    // min GitOps apply, before the Playwright suite's cleanup-setup drains
    // global reports and policies. Covers `generate-gitops` output against the
    // config that produced the state, and a `gitops --dry-run` of that same
    // config reporting no deletions. Excluded from premium and free; the
    // nightly workflow runs it with --project=gitops-nightly.
    {
      name: 'gitops-nightly',
      testDir: './tests/cli/nightly',
      // A whole-instance generate walks every fleet and downloads software
      // icons — well past the 60s the browser projects need.
      timeout: 180_000,
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
      // The API-timing specs live beside the page-load ones but run in their
      // own project below, without a browser.
      testIgnore: ['**/api/**'],
      // One page load at a time: four workers timing against one instance
      // measured their own contention, not the server. A loadtest run is a
      // manual, local one, so the extra runtime is accepted.
      workers: 1,
      fullyParallel: false,
      timeout: 60000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/loadtest-admin.json',
      },
      expect: { timeout: 30000 },
      dependencies: ['loadtest-setup'],
      retries: 0,
    },

    // ── Loadtest API timing (no browser; one request in flight) ─────────────
    // Samples every request shape in tests/loadtest/api/shapes.ts against the
    // loadtest instance with a bearer token — no login setup, no page health.
    // A family test samples hundreds of requests, and the per-request cap is
    // API_TIMEOUT_MS in helpers/perf-api.ts, so the test timeout is off.
    {
      name: 'loadtest-api',
      testDir: './tests/loadtest/api',
      workers: 1,
      fullyParallel: false,
      timeout: 0,
      retries: 0,
    },
  ],
});
