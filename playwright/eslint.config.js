// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const playwright = require('eslint-plugin-playwright');
const suite = require('./eslint-rules');

module.exports = tseslint.config(
  // Base JavaScript recommended
  js.configs.recommended,

  // TypeScript recommended (type-aware, so we pass the tsconfig)
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },

  // Playwright plugin — applied only to test + page-object files
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**/*.ts', 'pages/**/*.ts', 'helpers/**/*.ts', 'fixtures.ts', 'setup/**/*.ts'],
  },

  // Project-specific rules
  {
    files: ['tests/**/*.ts', 'pages/**/*.ts', 'helpers/**/*.ts', 'fixtures.ts', 'setup/**/*.ts'],
    rules: {
      // Critical: catches missing `await` on expect() and other async calls
      '@typescript-eslint/no-floating-promises': 'error',

      // Playwright anti-patterns
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'warn',
      'playwright/no-element-handle': 'error',
      'playwright/no-networkidle': 'warn',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/valid-expect': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
      'playwright/expect-expect': 'off', // too many false positives with custom assert helpers
      'playwright/no-conditional-in-test': 'off', // legitimate in graceful-skip / optional-widget flows
      'playwright/no-conditional-expect': 'off', // same reason

      // Relax some typescript-eslint defaults that aren't relevant for test code
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off', // env.FLEET_ADMIN_EMAIL! is intentional
      '@typescript-eslint/no-unsafe-assignment': 'off', // noisy on API response bodies
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off', // some actions are async by contract even if trivial today
    },
  },

  // The suite's own contract, from ./eslint-rules (CLAUDE.md → Pre-PR check
  // describes each rule). Errors, with the places that predate each rule
  // recorded per file in eslint-suppressions.json: those stay quiet, a new one
  // fails, and the file only shrinks (`npm run lint:prune`).
  { plugins: { suite } },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'suite/no-class-locator-in-spec': 'error',
      'suite/no-date-now-in-name': 'error',
      'suite/activity-needs-baseline': 'error',
      // Off until toast copy has a home outside the specs (docs/architecture-audit.md,
      // roadmap item 9): until then the rule would name a problem with no fix.
      'suite/no-toast-copy-in-spec': 'off',
    },
  },
  {
    // Browser specs only: API and CLI specs have no page, and the load-test
    // specs time raw locators on purpose.
    files: ['tests/e2e/**/*.ts'],
    rules: { 'suite/no-page-locator-in-spec': 'error' },
  },
  {
    files: ['helpers/**/*.ts', 'setup/**/*.ts', 'fixtures.ts'],
    rules: { 'suite/no-swallowed-response': 'error' },
  },

  // Ignore generated / vendored / local-only paths
  {
    ignores: [
      'node_modules/**',
      '.auth/**',
      '.perf-results/**',
      '.perf-history/**',
      '.perf-results-api/**',
      '.perf-history-api/**',
      'test-results/**',
      'playwright-report/**',
      '.playwright-mcp/**',
      'eslint.config.js', // This config file itself — can't type-check with its own rules
      'eslint-rules/**', // Plain JS outside the tsconfig, for the same reason; `npm run lint:rules` tests it
    ],
  },
);
