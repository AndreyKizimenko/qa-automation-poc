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
| `CommandPalette` | Every authenticated page (rendered by `CoreLayout`) | Fleet spotlight (⌘/Ctrl + K). cmdk supplies real roles — `dialog` / `combobox` / `listbox` / `option` / `group` — so rows and groups are role-addressed; only the Radix backdrop and the fleet chip fall back to classes. Resolves the platform modifier at runtime (Cmd on macOS, Ctrl on CI) |
| `PlatformDropdown` | `/software/add/app-store` | Apple-vs-Android selector for the App Store add-software form (react-select v5) |
| `Toast` | Anywhere a CRUD action confirms via a Sonner toast | Anchors on `role="alert"` narrowed by `.toast-notification__card--{success,error}`; has `expectSuccess` / `expectError` |
| `FileUploader` | Bootstrap, scripts, profiles, custom packages, setup-assistant | Wraps Fleet's `<input id="upload-file">`; handles auto-submit and manual-submit pages |
| `SoftwareInstallerCard` | `/software/titles/:id` | The Library section's installer accordion row; exposes the active row + its Delete action |
| `DataSet` | Detail pages + side panels (host vitals, policy details, my-account) | Fleet's `<dt>`/`<dd>` term-value pairs, which carry no role — looks up a value by its term. Construct with a scoped container |
| `AddHostsModal` | Hosts list | The "Add hosts" modal; its Advanced tab and "Plain osquery" reveal expose the certificate / enroll-secret / flagfile downloads |
| `TransferHostModal` | Hosts list bulk-select bar, host Actions menu | Fleet picker for moving hosts between fleets (and back to Unassigned) |
| `EditSoftwareModal` | `/software/titles/:id` Library accordion | The edit-package form. Titled "Edit package" on premium custom packages and "Edit software" otherwise, so the container is scoped by whichever is present |
| `SelectReportModal` | Host Actions → Live report | Lists the reports the host's fleet can run; picking one navigates to its edit screen with the host pre-targeted |
| `clickHoverAction` | Any hover-revealed row/card icon (download, trash, refetch) | Not a class — a helper function. Fleet keeps these icons `display: none` until the parent is hovered, and a plain `hover()` + `click()` can lose the hover mid-click |

## Promoting a page-local locator to a component

When you find yourself declaring the same locator on two page objects:

1. Create `pages/components/<Widget>.ts` with the shared locators and actions.
2. Import and instantiate it in each page object's constructor.
3. Remove the now-redundant `readonly` properties from the pages.
4. Update `pages/index.ts` to re-export the component.

## CSS fallbacks

Several components reach for CSS classes because the underlying Fleet widget
exposes no role, label, text, or testid. **Every such usage carries an inline
comment naming why** — that comment is the contract, and it's where the
authoritative list lives. Don't maintain an inventory here; it rots.

The recurring categories:

- **react-select triggers** — the visible click target is a role-less `<div>`
  and the accessible `<input role="combobox">` is hidden. Affects
  `TeamDropdown`, `LabelFilter`, `StatusFilter`, `PlatformDropdown`. Options
  *are* addressable: Fleet's `DropdownWrapper` emits
  `data-testid="dropdown-option"`.
- **Modals** — Fleet's `Modal` renders its title in a `<span>` with no
  `role="dialog"`, so modal containers are scoped by
  `.modal__modal_container` narrowed by title text.
- **Plain-`<div>` regions** — `DataTable.emptyState` (`.empty-state`),
  `DataSet`'s `<dt>`/`<dd>` pairs, `Toast`'s success/error variant classes.

The `playwright-test-reviewer` skill catalogues which of these are legitimate
today, so review doesn't re-litigate them. Anything *not* in that catalogue and
without an inline comment is a finding.

When Fleet adds a role or `data-testid` upstream, update the component to use it
and delete the fallback plus its comment.
