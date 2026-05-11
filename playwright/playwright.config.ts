import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

const suite = process.env.SUITE || 'premium';
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
    {
      name: 'premium',
      testDir: './tests',
      grepInvert: /@loadtest/,
      testIgnore: ['**/gitops-verify/**', '**/free/**'],
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
      grep: /@free/,
      // Free runs anything @free-tagged outside premium-only territory.
      // Premium-only specs in tests/e2e/premium/ stay out of scope; the
      // @free tag matrix is reserved for tier-agnostic flows (auth, etc.)
      // and the dedicated tests/e2e/free/ tree.
      testIgnore: ['**/gitops-verify/**', '**/premium/**'],
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
      testDir: './tests',
      grep: /@loadtest/,
      testIgnore: '**/gitops-verify/**',
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
