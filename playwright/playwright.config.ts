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
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html',
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
    {
      name: 'software-fleet-setup',
      testDir: './setup',
      testMatch: /software-fleet\.setup\.ts/,
      dependencies: ['premium-setup'],
    },
    {
      name: 'mdm-fleet-setup',
      testDir: './setup',
      testMatch: /mdm-fleet\.setup\.ts/,
      dependencies: ['premium-setup'],
    },
    {
      name: 'fleet-teardown',
      testDir: './setup',
      testMatch: /fleet\.teardown\.ts/,
    },
    {
      name: 'premium',
      testDir: './tests',
      grepInvert: /@free|@loadtest/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/premium-admin.json',
      },
      dependencies: ['premium-setup', 'software-fleet-setup', 'mdm-fleet-setup'],
      teardown: 'fleet-teardown',
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
      grep: /@free|@all/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/free-admin.json',
      },
      dependencies: ['free-setup'],
    },

    // ── API Verify (post-gitops state checks) ─────────────────────────────────
    // Pure API tests, no browser. Reads the gitops dir at GITOPS_DIR (default
    // ../gitops/free-fleetqa) and asserts the live Fleet instance matches.
    {
      name: 'api-verify',
      testDir: './tests/api-verify',
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
