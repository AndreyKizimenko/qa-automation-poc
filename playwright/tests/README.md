# Tests

This directory contains every Playwright spec in the suite. Tests use page
objects and component objects from `../pages/` via fixtures — they should
read like a user flow, not like raw Playwright API calls.

## Directory layout

```
tests/
├── e2e/                      # Browser specs in three sibling folders
│   ├── shared/               # Tier-agnostic (@free) — auth, packs, etc.
│   │   ├── auth/             # login, logout, SSO, forgot-password
│   │   └── packs/            # packs CRUD (global, no team scope)
│   ├── premium/              # Premium-only flows (Unassigned + Workstations variants)
│   │   ├── controls/
│   │   │   ├── os-settings/
│   │   │   ├── scripts/
│   │   │   └── setup-experience/
│   │   ├── policies/
│   │   ├── reports/
│   │   └── software/         # library (premium-only, paywalled on free) + vulnerabilities
│   └── free/                 # Free-tier counterparts (no dropdown) + paywall specs
├── api/                      # Pure-API specs (no browser)
│   ├── config.spec.ts        # Agnostic config-shape checks
│   ├── free/                 # Free-only API contracts
│   └── gitops-verify/        # GitOps drift checks
└── loadtest/                 # Page load / search timing tests (tagged @loadtest, gitignored)
```

Tier-routing rules:

- **Tier-agnostic** (no team/scope concept): one spec under `tests/e2e/shared/<area>/`, every test tagged `@free`. Both projects run it.
- **Premium-only**: one spec under `tests/e2e/premium/<area>/`. Loop over `['Unassigned', 'Workstations']` (or `['All fleets', 'Workstations']` for reports/policies) calling `<page>.teamDropdown.select(scope)` after navigation. Use the `workstationsFleetId` worker fixture if the page needs a direct `goto({ fleetId })` for the Workstations variant.
- **Free-tier counterpart**: mirror under `tests/e2e/free/<area>/`, drop the dropdown step, tag every test with `@free` so the free project's grep matches.

### e2e vs loadtest vs gitops-verify

- **E2E** — "Does this feature work for the user?" Runs in the
  `premium` (default) and `free` (`@free`-tagged) projects. Uses
  click-through flows, verifies the UI renders and the user can
  complete a task.

- **Loadtest** — "How fast does this load under high-scale data?"
  Runs in the `loadtest` project against a high-scale QA instance. Uses
  `measureNav` / `measureSearch` from `@helpers/perf` to time
  user-perceived page loads. Tagged `@loadtest` so the premium and free
  projects skip them.

- **GitOps verify** — "Does the live instance match the gitops config?"
  Runs in the `gitops-verify` project (no browser, just the request
  fixture). Loads the gitops target via `_config.ts` and asserts org
  settings, profiles, policies, scripts, labels, and reports match.
  Driven by the nightly orchestrators between gitops apply steps.

## Writing a new test

```ts
import { test, expect } from '@fixtures';

test('describe the user scenario', async ({ softwareTitles }) => {
  await softwareTitles.goto({ vulnerable: true });
  await softwareTitles.searchByName('Safari');
  await expect(softwareTitles.table.firstRowWithLink).toContainText('Safari');
});
```

Rules:

1. **Always import `test` and `expect` from `@fixtures`.** Never from `@playwright/test` — that skips our page-object fixtures (and the auto `pageHealth` fixture). The only exception is setup specs under `setup/`.
2. **Destructure the page objects you need.** `async ({ softwareTitles, cveDetail }) =>` — TypeScript tells you what's available.
3. **Call page methods, not raw Playwright APIs.** If you find yourself writing `page.getByRole('table').locator('tbody tr')`, the page object is missing a method — add it, don't work around it.
4. **Web-first assertions.** `await expect(locator).toBeVisible()` auto-retries. Don't `await locator.isVisible()` in assertions.
5. **Short tests.** Push multi-step logic into the page object. A spec should be a script of user actions, not a flow graph.

## Page health is automatic

Every test gets the `pageHealth` fixture applied automatically. It monitors
console errors and 5xx server errors during the run and asserts at teardown
that no un-ignored issues occurred. 4xx is not flagged — it's normal app
behaviour (auth probes, "no resource yet" 404s, premium-gated 402s) and
assertions catch the meaningful ones.

If your test intentionally produces console errors (negative-path auth,
post-logout 401), opt out:

```ts
test('shows error for invalid credentials', async ({ loginPage, pageHealth }) => {
  pageHealth.disable();
  await loginPage.login('nope@example.com', 'wrong');
  await expect(loginPage.authFailedMessage).toBeVisible();
});
```

Console-error ignore patterns live in `@helpers/console`
(`DEFAULT_IGNORED_CONSOLE_ERRORS`). Add Fleet-wide noise there.

## Anti-patterns to reject in review

- **Raw class selectors in specs.** `page.locator('.foo-bar__baz')` — belongs on a component object with a documented reason, not inline.
- **`.first()` / `.nth()` chains.** If you're writing `page.getByRole('row').first().locator('td').first()`, use `table.firstRowWithLink` on the `DataTable` component.
- **Inline `page.on('console')`.** The auto `pageHealth` fixture already does this — don't add a second listener.
- **Inline auth headers.** `{ Authorization: \`Bearer ${process.env.FLEET_API_TOKEN}\` }` — use `authHeaders()` from `@helpers/api`.
- **Duplicating existing logic.** Before writing a new helper/component/page, grep for an existing one.
- **Importing `test` from `@playwright/test`.** Import from `@fixtures` so you get page objects and ambient page-health.

## Before / after

```ts
// BEFORE — raw selectors, fragile chains, inline state
test('apply vulnerable filter', async ({ page }) => {
  await page.goto('/software/titles');
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
  await page.getByRole('button', { name: /filter/i }).click();
  await page.locator('form').getByRole('switch').click();
  const countBefore = await page.locator('text=/\\d[\\d,]*\\s+items?/').first().innerText();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('text=/\\d[\\d,]*\\s+items?/').first()).not.toHaveText(countBefore);
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
});

// AFTER — uses SoftwareTitlesPage + FilterModal components
test('apply vulnerable filter', async ({ softwareTitles }) => {
  await softwareTitles.goto();
  await softwareTitles.filter.applyVulnerable();
  await expect(softwareTitles.table.firstRowWithLink).toBeVisible();
});
```

## Test isolation

Each test gets a fresh browser context via Playwright defaults. Don't share
state between tests unless they're in a `test.describe.configure({ mode: 'serial' })`
block and explicitly depend on each other (like the vulnerability flow that
builds up `softwareByOS` across ordered tests).

## Tier routing

Routing is mostly by folder, with `@free` reserved for the tier-agnostic specs.

| Where the spec lives | premium runs it? | free runs it? |
|---|---|---|
| `tests/e2e/shared/**` (every test tagged `@free`) | yes | yes |
| `tests/e2e/premium/**` | yes | no (free's `testIgnore` excludes `**/premium/**`) |
| `tests/e2e/free/**` (every test tagged `@free`) | no (premium's `testIgnore` excludes `**/free/**`) | yes |
| Tagged `@loadtest` | no | no — loadtest project only |
| `tests/api/gitops-verify/**` | no | no — gitops-verify project only |

The grep + testIgnore matrix in `playwright.config.ts` is the source of truth.
