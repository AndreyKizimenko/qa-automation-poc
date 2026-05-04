# Component Objects

This directory contains component objects — classes that wrap reusable UI
widgets that appear on multiple pages (tables, filter modals, navigation,
dropdowns, etc.). Page objects compose components rather than redeclaring
their locators.

## When to make a component

**Make a component** when one of these is true:

- The widget appears on 2+ pages (DataTable, Navbar — appear everywhere)
- The widget is a self-contained interaction (FilterModal, dropdowns)
- Multiple page objects would otherwise duplicate the same locators

**Don't make a component** for:

- One-off page-specific buttons (those live directly on the page object)
- Trivial wrappers around a single `getByRole` call (just use the locator)

## Contract

Same shape as pages — constructor takes `Page`, exposes `readonly`
locators, and provides action methods for interactions. No side effects
in the constructor.

```ts
import { Page, Locator, expect } from '@playwright/test';

export class MyWidget {
  readonly page: Page;
  readonly trigger: Locator;
  readonly output: Locator;

  constructor(page: Page) {
    this.page = page;
    this.trigger = page.getByRole('button', { name: 'Open' });
    this.output = page.getByRole('textbox', { name: 'Result' });
  }

  async open() {
    await this.trigger.click();
    await expect(this.output).toBeVisible();
  }
}
```

## Current components

| Component | Used on | Purpose |
|-----------|---------|---------|
| `Navbar` | Every authenticated page | Top nav: Hosts / Controls / Software / Reports / Policies, user menu, sign-out |
| `DataTable` | Every list page | `<table>` rows, primary-link first row, cell lookup by column, empty state |
| `ContentList` | Profiles, Certs, Scripts, Variables | `<li>` lists with timestamps (not `<table>`) |
| `Pagination` | Most paginated lists | Next / Previous controls; asserts the first row's text changes |
| `FilterModal` | Software Titles, Host Details > Software | "Add filters" modal for vulnerable software + severity |
| `LabelFilter` | Hosts list | Label-scoped host filter (react-select v5 trigger) |
| `StatusFilter` | Hosts list | Online / offline / new status filter |
| `TeamDropdown` | Most pages | Team / fleet picker in the page header |
| `Toast` | Anywhere a CRUD action confirms via banner | Scoped to `.flash-message--success` / `.flash-message--error`; has `expectSuccess` / `expectError` |
| `FileUploader` | Bootstrap, scripts, profiles, custom packages, setup-assistant | Wraps Fleet's `<input id="upload-file">`; handles auto-submit and manual-submit pages |
| `SoftwareInstallerCard` | `/software/titles/:id` | Hover-revealed Download + Delete actions on the installer card |

## Promoting a page-local locator to a component

When you find yourself declaring the same locator on two page objects:

1. Create `pages/components/<Widget>.ts` with the shared locators and actions.
2. Import and instantiate it in each page object's constructor.
3. Remove the now-redundant `readonly` properties from the pages.
4. Update `pages/index.ts` to re-export the component.

## CSS fallbacks

A few components use CSS classes because Fleet's underlying widget doesn't
expose ARIA roles or a `data-testid`. Each such usage is documented inline
with a comment. Current documented fallbacks:

- `DataTable.emptyState` → `.empty-state` (Fleet's `EmptyState` is a plain `<div>`)
- `CveDetailPage.description` → `.software-vuln-summary__description` (premium-tier description block)

When Fleet adds `data-testid` upstream to any of these, update the component
to use `getByTestId` and remove the fallback.
