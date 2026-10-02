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
| `Pagination` | Most paginated lists | Next / Previous controls; asserts the first row's link text changes (the whole row's text on a table with no links, like Labels) |
| `FilterModal` | Software Titles, Host Details > Software | "Add filters" modal for vulnerable software + severity |
| `LabelFilter` | Hosts list | Label-scoped host filter (react-select v5 trigger) |
| `StatusFilter` | Hosts list | Online / offline / new status filter |
| `TeamDropdown` | Most pages | Team / fleet picker in the page header |
| `CommandPalette` | Every authenticated page (rendered by `CoreLayout`) | Fleet spotlight (⌘/Ctrl + K). cmdk supplies real roles — `dialog` / `combobox` / `listbox` / `option` / `group` — so rows and groups are role-addressed; only the Radix backdrop and the fleet chip fall back to classes. Resolves the platform modifier at runtime (Cmd on macOS, Ctrl on CI) |
| `PlatformDropdown` | `/software/add/app-store` | Apple-vs-Android selector for the App Store add-software form (react-select v5) |
| `Toast` | Anywhere a CRUD action confirms via a Sonner toast | Anchors on `role="alert"` narrowed by `.toast-notification__card--{success,error}`; has `expectSuccess` / `expectError` |
| `FileUploader` | Bootstrap, scripts, profiles, custom packages, setup-assistant | Wraps Fleet's `<input id="upload-file">`; handles auto-submit and manual-submit pages |
| `SoftwareInstallerCard` | `/software/titles/:id` | The Library section's installer accordion row; exposes the active row, its pin-state badges (Latest / Pinned / Major version), and its Edit / Download / Delete actions; `scopeBadge` / `openScopeEditor()` opens Edit from the label-scope badge whether it reads "All hosts" or a label count |
| `DataSet` | Detail pages + side panels (host vitals, policy details, my-account) | Fleet's `<dt>`/`<dd>` term-value pairs, which carry no role — looks up a value by its term. Construct with a scoped container |
| `AddHostsModal` | Hosts list | The "Add hosts" modal; its Advanced tab and "Plain osquery" reveal expose the certificate / enroll-secret / flagfile downloads |
| `EnrollSecretModal` | Hosts list (gear → Enroll secrets, `?manage_enroll_secrets=1`), fleet settings | *Manage enroll secrets* plus its *Add secret* editor and *Delete secret* confirmation. Every action takes the secret's value (`rowFor`, `copy`, `delete`) — no first-row shortcut, since a wrong-row delete on the global list stops the simulations re-enrolling. `expectLoaded(n)` waits out the empty state the modal flashes before its list arrives. `rowControls(row)` is for reading gated state. `HostsListPage.enrollSecrets` holds one |
| `TransferHostModal` | Hosts list bulk-select bar, host Actions menu | Fleet picker for moving hosts between fleets (and back to Unassigned) |
| `UpdateEndUserModal` | Host details → User card | *Add user* / *Edit user*: the one *Username (IdP)* field and Save; saving it empty removes the user. On free it shows the Fleet Premium message instead |
| `RecoveryLockPasswordModal` | Host Actions → Show Recovery Lock password | The escrowed password (masked, *Show secret*), the auto-rotation banner, *Rotate password*. Opening it is a view: Fleet logs it and schedules a rotation |
| `EditSoftwareModal` | `/software/titles/:id` Library accordion | The edit-package form. Titled "Edit package" on premium custom packages and "Edit software" otherwise, so the container is scoped by whichever is present. Also owns Advanced options — the four Ace editors, told apart by their wrapper ids, plus `normalizeScript` for comparing what they render against what the API stored. `setTarget()` scopes the package through its `TargetLabelSelector`, replacing any scope it had |
| `EditAppearanceModal` | `/software/titles/:id` summary card | Fleet's `EditIconModal`: custom icon + display name behind one Save. The file control swaps between an empty uploader and a staged-file card, so it targets `input[type="file"]` rather than a fixed id |
| `VersionsModal` | `/software/titles/:id` summary card + accordion badge | Version pinning for Fleet-maintained apps: latest / exact / major-version radios. `pinTargetLabel` and `pinTargetApiValue` map a target to its radio label and to the `version` value Fleet stores |
| `SelectReportModal` | Host Actions → Live report | Lists the reports the host's fleet can run; picking one navigates to its edit screen with the host pre-targeted |
| `TargetLabelSelector` | Add / Edit profile modals, Save policy, Save report, Edit software (premium) | Fleet's label target: All hosts / Custom, then either the tabbed Include (Any / All) and Exclude lists (profiles, declarations, policies — Exclude has its own Any / All on a policy) or, via `scope()`, the react-select v1 dropdown of Include any / Include all / Exclude any (software, reports). A tab's name gains " check" once it holds a label. Constructed on the modal or form that owns it. Radios are hidden inputs, so a choice clicks the `<label>` wrapping the radio — with a page-rooted `has`, since a `has` locator carrying the container's chain matches nothing |
| `PolicyAutomationsFields` | Policies list → a row's Automations cell (*Manage automations* modal); also rendered by the policy form and the Save policy modal | One policy's automations: a checkbox row per type, named by Fleet's snake_case `name` (`install_software`, `run_script`, …) since that's the checkbox's accessible name; the Install software / Run script pickers (react-select v5 — the control's class is the click target, options carry `dropdown-option`) and the *Continuous* checkbox. A fleet policy lists six rows; a global one — every policy on free — only `ticket_webhook`, with no Continuous |
| `SoftwareDeploySelector` | Title → Actions → Deploy (on `SoftwareTitleDetailPage.deploy`); the add-software pages render the same selector | Force install / Patch checkboxes (named `force-install` / `patch` — Fleet's `Checkbox` uses its `name`), the *Patch options* radiogroup (hidden radio inputs, so a choice clicks the wrapping `<label>`) and, under Force patch on macOS only, the *End user experience* react-select |
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
