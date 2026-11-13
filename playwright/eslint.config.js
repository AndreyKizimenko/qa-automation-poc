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

      // Playwright anti-patterns. No rule here is a warning: `npm run lint` runs
      // with --max-warnings 0, so a line it prints is a line to act on.
      'playwright/no-wait-for-timeout': 'error',
      // Allowed only with its reason: `// eslint-disable-next-line playwright/no-force-option -- <why>`
      'playwright/no-force-option': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/valid-expect': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'off', // suite/skip-needs-reason checks what this suite asks of a skip
      // The only tags are the real-VM ones (helpers/api/hosts.ts, VM_TAGS), so a
      // misspelt tag fails here instead of leaving a VM test out of its lane.
      'playwright/valid-test-tags': ['error', { allowedTags: ['@vm-macos', '@vm-windows', '@vm-linux'] }],
      'playwright/prefer-hooks-in-order': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/expect-expect': 'off', // too many false positives with custom assert helpers
      'playwright/no-conditional-in-test': 'off', // legitimate in graceful-skip / optional-widget flows
      'playwright/no-conditional-expect': 'off', // same reason

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Relax some typescript-eslint defaults that aren't relevant for test code
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
    files: ['tests/**/*.ts', 'pages/**/*.ts', 'helpers/**/*.ts', 'fixtures.ts', 'setup/**/*.ts'],
    rules: {
      'suite/skip-needs-reason': 'error',
      'suite/no-to-be-ok': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'suite/no-class-locator-in-spec': 'error',
      'suite/no-date-now-in-name': 'error',
      'suite/use-own-name': 'error',
      'suite/no-api-cleanup-in-finally': 'error',
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
  {
    // Page objects outside pages/components/, which is where each shared
    // widget's selector lives.
    files: ['pages/**/*.ts'],
    ignores: ['pages/components/**'],
    rules: {
      'suite/modal-in-component': 'error',
      'suite/react-select-in-component': 'error',
      'suite/actions-menu-in-component': 'error',
      'suite/sql-editor-in-component': 'error',
    },
  },
  {
    // Specs with no page. The browser `test` carries an automatic fixture that
    // asks for one, so importing it here would launch a browser for every test.
    files: ['tests/api/**/*.ts', 'tests/cli/**/*.ts', 'tests/loadtest/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@fixtures',
              importNames: ['test'],
              message:
                "An API or CLI spec imports `apiTest` (`import { apiTest as test } from '@fixtures'`): `test` opens a page for every test.",
            },
          ],
        },
      ],
    },
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
      'scripts/**', // Plain JS outside the tsconfig, for the same reason; `npm run lint:claims` runs it
    ],
  },
);
