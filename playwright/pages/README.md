# Page Objects

This directory contains [Page Objects](https://playwright.dev/docs/pom) —
one class per Fleet screen, exposing its locators and actions. Tests never
write raw selectors; they work through these pages.

## Why POM

1. **Selectors in one place.** If the "Search" placeholder changes from "Search by name" to "Search", we update `SoftwareTitlesPage` once and every test keeps working.
2. **High-level API.** Tests read like a user flow: `await softwareTitles.applyVulnerableFilter()` instead of `await page.getByRole('button', {...}).click(); await page.locator('form').getByRole('switch').click(); ...`.
3. **TypeScript catches breakage.** If a page rename breaks a field, the compiler flags it before CI does.

## Structure

```
pages/
├── components/         # Reusable widgets used across pages (DataTable, Navbar, etc.)
├── index.ts            # Re-exports every page + component
├── DashboardPage.ts    # Top-level nav entries live at root
├── auth/               # LoginPage, ForgotPasswordPage
├── hosts/              # HostsListPage, HostDetailsPage (even though it has
│                       #   Software/Reports/Policies tabs — hosts is its
│                       #   primary nav context)
├── software/           # SoftwareTitlesPage + versions/OS/vulnerabilities/CVE
├── controls/           # ControlsPage, OsUpdates, OsSettings, profiles, etc.
├── reports/            # ReportsListPage
├── policies/           # PoliciesListPage
├── labels/             # LabelsPage
├── packs/              # PacksListPage, PackEditPage
└── settings/           # Organization info/advanced, Integrations, Users
```

Inside a feature folder, `import { Foo } from '../components/Foo'` (one
directory up). Specs and fixtures should import from `@pages` (the
barrel) — never from deep paths — so renaming a folder doesn't ripple.
For a narrower import, use `@pages/<folder>/<File>` (e.g.
`@pages/components/DataTable`).

## Page object contract

```ts
import { Page, Locator, expect } from '@playwright/test';
import { DataTable } from '../components/DataTable';
import { Navbar } from '../components/Navbar';

export class MyPage {
  readonly page: Page;
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly search: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.search = page.getByRole('textbox', { name: 'Search' });
  }

  async goto() {
    await this.page.goto('/my-page');
    await expect(this.table.firstRow).toBeVisible();
  }

  async searchFor(query: string) {
    await this.search.fill(query);
    await expect(this.table.firstRow).toBeVisible();
  }
}
```

Rules:

1. **Locators are `readonly` properties** defined in the constructor. One source of truth per element.
2. **Compose components** (`Navbar`, `DataTable`, `FilterModal`) rather than redeclaring their locators.
3. **`goto()` includes the ready-state wait.** Callers shouldn't need to separately `await expect(...).toBeVisible()` after navigating.
4. **Action methods are async.** They perform one user-meaningful action and wait for the resulting UI change.
5. **Constructor is pure.** No side effects, no network calls — just locator wiring.

## Selector priority

Per [Playwright best practices](https://playwright.dev/docs/locators), prefer in this order:

1. `getByRole('role', { name })` — what users and assistive tech see
2. `getByLabel(text)` — form fields with labels
3. `getByPlaceholder(text)` — form fields without labels
4. `getByText(text)` — non-interactive text content
5. `getByTestId('id')` — explicit test contract (Fleet has a few: `user-menu`, `user-avatar`, `dropdown-option`)
6. `page.locator('.css-class')` — **last resort, always add a comment** explaining why no role/text worked (typically: react-select internals or widgets without accessible roles)

## Authoring a new page object

1. **Inspect the live page.** Use the Playwright MCP (`mcp__playwright__browser_navigate`, `browser_snapshot`, `browser_evaluate`) to see the accessibility tree. This is how you find the right role/name — don't guess from CSS.

2. **Read the React source.** Look under `frontend/pages/` and `frontend/components/` for:
   - Exact heading text, tab labels, placeholder strings
   - Premium vs Free tier conditional sections
   - Existing `data-testid` attributes you can reuse
   - Widget class names (only as a last-resort fallback)

3. **Cover everything visible.** Include interactive elements even if no current test uses them. Example: `SoftwareTitlesPage` exposes `showVersionsSwitch`, `manageAutomationsButton`, and `addSoftwareButton` despite no tests clicking them yet. Future tests should reach for these properties rather than re-locating them.

4. **Document CSS fallbacks inline.** If you must use a class selector, add a one-line comment explaining why role/text didn't work. Future maintainers can then evaluate whether Fleet could add a `data-testid` upstream to fix it.

5. **Add a fixture.** In `fixtures.ts`, add your page to `FleetFixtures` and provide a factory. Tests can then destructure it.

## Example — annotated

```ts
export class SoftwareTitlesPage {
  readonly page: Page;

  // Components — composed, not redeclared
  readonly navbar: Navbar;
  readonly table: DataTable;
  readonly filter: FilterModal;
  readonly pagination: Pagination;

  // Page-specific controls — role-based locators, scoped to this page
  readonly search: Locator;
  readonly showVersionsSwitch: Locator;
  readonly manageAutomationsButton: Locator;  // exposed even though no test clicks it today
  readonly addSoftwareButton: Locator;

  // Tabs live at the top of the software section
  readonly softwareTab: Locator;
  readonly osTab: Locator;
  readonly vulnerabilitiesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navbar = new Navbar(page);
    this.table = new DataTable(page);
    this.filter = new FilterModal(page);
    this.pagination = new Pagination(page);

    this.search = page.getByRole('textbox', { name: /Search by name or vulnerability/ });
    this.showVersionsSwitch = page.getByRole('switch', { name: /versions/i });
    this.manageAutomationsButton = page.getByRole('button', { name: 'Manage automations' });
    this.addSoftwareButton = page.getByRole('button', { name: 'Add software' });

    this.softwareTab = page.getByRole('tab', { name: 'Software' });
    this.osTab = page.getByRole('tab', { name: 'OS' });
    this.vulnerabilitiesTab = page.getByRole('tab', { name: 'Vulnerabilities' });
  }

  // goto() handles URL + ready-state in one call
  async goto(opts: { vulnerable?: boolean } = {}) {
    await this.page.goto(opts.vulnerable ? '/software/titles?vulnerable=true' : '/software/titles');
    await expect(this.table.firstRow).toBeVisible();
  }
}
```
