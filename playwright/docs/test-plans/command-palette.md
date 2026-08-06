# Command palette (Fleet spotlight, ⌘/Ctrl + K) — E2E test plan

Feature: [fleetdm/fleet#43757](https://github.com/fleetdm/fleet/issues/43757), shipped in 4.87.
Applies to **free and premium**; a few items are premium-gated.

Source read for this plan: `frontend/components/CommandPalette/` on `rc-minor-fleet-v4.90.0`
(what both QA instances run today — `4.90.0-rc.2608060128`). The palette on that branch is
identical to `main` except three files: `settings.ts` renames "Certificate enrollment" →
"Certificate authorities", and the Report/Policy pickers switch to normalized `Tag` badges.

## Scope decision

The story's own test plan has ~200 rows because it doubles as the Jest coverage map. The
component ships with unit + integration tests that already exhaustively cover **item
derivation**: the full team-chip matrix (5 contexts × ~25 actions), tier/mode gating,
MDM add-vs-edit, picker API arguments, and the debounce hook. Re-deriving that matrix in
Playwright buys nothing and would be 200 slow tests pinned to volatile label strings.

Playwright earns its keep on the six things JSDOM and mocked props cannot do:

1. **Real cmdk filtering and Best-match ranking** — cmdk's filter never runs under JSDOM
   (the story's plan has `it.todo` for it). Every "typing filters", "No results found",
   and keyword-discoverability row is untested today.
2. **Real navigation outcomes** — where an item actually lands, and whether `fleet_id`
   rides along.
3. **Real backend pickers** — server-side search, debounce, empty-state copy, badges
   (Inherited / Critical / Patch / observer-can-run), install icons.
4. **Deep-link modals** — 10 query params consumed by 8 different pages, each stripping
   the param afterwards. All "not tested" today.
5. **Real role and tier gating** — from a live session's AppContext, not props.
6. **Dialog/keyboard mechanics** — Escape layering (capture-phase `stopImmediatePropagation`),
   overlay click, focus management, keyboard-vs-pointer auto-expand.

Everything else stays with Jest. Explicit non-goals are listed at the bottom.

## Status

Delivered and green on both tiers (38 tests): `pages/components/CommandPalette.ts`, the
`palette` fixture in `fixtures.ts`, and the three shared specs `open-close` (#1–#9),
`search-and-navigate` (#10–#24, including #21b) and `pickers` (#25–#37). Remaining: the deep-links,
commands and role-access shared specs, plus the four premium specs and the free
tier-gating spec.

## Suite placement

```
pages/components/CommandPalette.ts            # component object
tests/e2e/shared/command-palette/
  open-close.spec.ts
  search-and-navigate.spec.ts
  pickers.spec.ts
  deep-links.spec.ts
  commands.spec.ts
  role-access.spec.ts
tests/e2e/premium/command-palette/
  fleet-switcher.spec.ts
  team-context.spec.ts
  premium-items.spec.ts
  role-access.spec.ts                          # technician, observer+, team roles
tests/e2e/free/command-palette/
  tier-gating.spec.ts
```

The palette renders in `CoreLayout`, so it is reachable from any authenticated page — specs
enter through the dashboard (or whichever page the case needs) and open the palette from there.

### Component-object locators

Confirmed against the live premium instance (4.90.0-rc) by dumping the palette's
accessibility tree. cmdk gives us real roles, so almost nothing needs a class fallback:

| Target | Locator |
|---|---|
| Dialog | `getByRole('dialog', { name: 'Command palette' })` |
| Input | `getByRole('combobox')` (placeholder is the page-state signal) |
| List | `getByRole('listbox')` |
| Item / sub-item / picker row | `getByRole('option', { name })` |
| Fleet switcher | `getByRole('button', { name: /^Switch fleet \(currently / })` |
| Back | `getByRole('button', { name: 'Back' })` |
| Sub-page announcement | `getByRole('status')` |
| Host status dot | `getByLabel('status: online')` |
| Search highlight | `mark` element inside the row |
| Group | `getByRole('group', { name: 'Pages' })` — cmdk points the group's `aria-labelledby` at its heading, so groups **are** name-addressable |
| Group heading text (for order) | `[cmdk-group-heading]` — attr fallback; the heading div itself is `aria-hidden` and roleless |
| Expand chevron | the only `button` inside a row → `option.getByRole('button')` (the picker-page chevron is an `aria-hidden` span, so it doesn't collide) |
| Team chip | `.command-palette__item-fleet` — **class fallback, needs a comment** |
| Overlay | `.command-palette__overlay` — **class fallback**; Radix's backdrop is a roleless div |
| ESC hint pill | `kbd` with text `ESC` |

Row lookups anchor on the **start** of the accessible name, because a trailing fleet chip
(and, for a promoted sub-item, its parent's label) is part of that name — `option "Add report
All fleets"`, `option "Host status alerts Integrations"`.

Best match renders as an unheaded group **first** in the listbox, so assert it positionally
("the first `option` is X"). Do **not** assert the separator: cmdk suppresses
`Command.Separator` whenever a search is active, which is exactly when Best match renders,
so no rule element exists in the DOM.

## Mechanics to settle before authoring

- **Modifier key differs between local and CI.** The palette keys off `navigator.platform`:
  Cmd on macOS, **Ctrl everywhere else** — and it deliberately ignores the wrong one. Local
  runs are darwin, CI runners are Linux, so a hardcoded `Meta+K` passes locally and fails in
  CI (and vice versa). The component object must resolve it once:
  `const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'`. Same for `Cmd/Ctrl+Shift+F`.
- **Don't hardcode long label inventories.** The 4.90-vs-main "Certificate enrollment" →
  "Certificate authorities" rename is exactly the drift that would break a 40-label assertion.
  Anchor each test on the few labels it's actually about.
- **"Vulnerable software" and the QA 500.** That sub-item navigates to `?vulnerable=true`,
  historically the MySQL temp-table 500 (`table is full`) on the QA instances, and the auto
  `pageHealth` fixture fails any test that sees a 5xx. Re-checked 2026-08-06: 200 for a single
  call and for four concurrent paged calls, so the case is covered rather than skipped. If the
  500 returns it surfaces as a `pageHealth` 5xx pointing at the ops item, which is the right
  failure mode — don't "fix" it by dropping the test.
- **Sign out** must `pageHealth.disable()` for the post-logout 401s, mirroring
  `tests/e2e/shared/auth/logout.spec.ts`.
- **The "no palette on the login page" case needs a genuinely session-less context.**
  `browser.newContext()` inherits the project's `use` options — `storageState` and `baseURL`
  included — so an argument-less call is still authenticated as the admin. Fleet then
  bootstraps the session and redirects /login → /dashboard, where CoreLayout *does* mount the
  palette. Use `withCleanContext` from `@helpers/auth`, which supplies the empty-storage
  override. Symptom when this is wrong: the test passes on an idle machine (the assertion
  beats the redirect) and fails under load with an aria snapshot showing the dashboard and an
  open palette — i.e. it passes for the wrong reason until it doesn't.
- **Host names are random on the simulated pool** — resolve a host via the API first, then
  search the picker for that name. Never assume a name.
- **Picker data**: policies are stable (22 global on each tier), but **there are no reports in
  the global scope on either instance** — `GET /queries` with no `team_id` returns
  `count: 0`. Premium's three gitops reports live on Workstations only; free has none
  anywhere. A global-scope report test must seed its own report and delete it in the same
  test; the gitops reports are only reachable from a fleet-scoped premium spec. Software
  library content is wiped by the cleanup projects, so a library-picker test must upload its
  own package as a precondition and clean up in the same test.
- **Picker searches go straight to the server**, so a name that matches its siblings
  ("Battery healthy" hits both the macOS and Windows policy) leaves the row lookup ambiguous
  under strict mode. Resolve a name the server narrows to exactly one row, and skip software
  titles carrying a `display_name` — the picker renders the display name, not `name`.
- **MDM group is config-dependent.** On both QA boxes Apple and Windows MDM are configured and
  Android is not; premium has ABM configured. So expect "Edit Apple…", "Edit Windows MDM",
  "Turn on Android MDM". Read `/config` in the test rather than hardcoding, or the specs break
  the day someone turns Android on.
- **Theme toggle** is per-context localStorage (same as `shared/account/theme.spec.ts`), so it
  can't leak into stored auth state.
- **Escape is inert for one render after the dialog paints.** Radix's `DismissableLayer`
  computes the layer's index during render but registers the layer in an effect afterwards,
  so on the painting commit the index is still `-1`, the Escape handler takes its early
  return, and the press is dropped (observed as `defaultPrevented === false`). The follow-up
  render that registers the layer also gives the dialog its own `pointer-events: auto`
  (before it, `body { pointer-events: none }` is inherited), so `CommandPalette.open()`
  anchors on that style — every spec inherits it and no spec should re-assert it. Not a
  product bug: no human presses Escape inside one frame. It surfaced as a ~1-in-3 flake only
  while several suites hammered the instance concurrently, and does not reproduce on an idle
  machine, so treat the anchor as load-insurance rather than something a local run will prove.
  `Cmd+K` (Fleet's own document listener) and overlay click are unaffected.
- **`shared/` specs run on premium in the All-fleets scope**, where the whole Controls group,
  `View software library` and the four software-add commands are hidden (they need
  `hasTeamOrUnassigned`). Anything scope-dependent — including the `filevault` and `fma`
  keyword rows — belongs in the premium spec, not the shared one.

## Cases

Priority: **P1** = core contract, should exist before we call this covered. **P2** = worth
having. **P3** = nice to have. Tier column: S = shared spec, P = premium, F = free.

### `shared/command-palette/open-close.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 1 | `Cmd/Ctrl+K` from the dashboard opens the dialog; input is focused; placeholder is `Search for a page or command...` | P1 | S |
| 2 | `Cmd/Ctrl+K` again closes it | P1 | S |
| 3 | `Escape` on root closes it | P1 | S |
| 4 | Clicking the overlay closes it | P2 | S |
| 5 | Opens from Hosts, Software, Reports, Policies and Settings → Users (global via CoreLayout) | P1 | S |
| 6 | Does **not** open on the login page (no CoreLayout) — fresh context, no storage state | P2 | S |
| 7 | Reopening resets the search text **and** collapses previously expanded sub-items | P1 | S |
| 8 | Dialog exposes `aria-label="Command palette"`; the shortcut `kbd` pills are `aria-hidden` (switcher's accessible name is exactly `Switch fleet (currently <fleet>)`) | P2 | S/P |
| 9 | The wrong modifier is ignored — on Linux CI `Meta+K` does nothing (and `Ctrl+K` does nothing on macOS) | P3 | S |

### `shared/command-palette/search-and-navigate.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 10 | Typing `hosts` filters the list down — Hosts visible, unrelated rows (Sign out) gone | P1 | S |
| 11 | Typing an exact label promotes a Best-match row as the **first** option, above the first group heading, with the typed span wrapped in `<mark>` | P1 | S |
| 12 | A nonsense query renders `No results found.` | P1 | S |
| 13 | Keyword discoverability, small curated table: `queries`→View report, `endpoints`→Hosts, `logout`→Sign out, `filevault`→Disk encryption (P), `fma`→Add Fleet-maintained app (P) | P1 | S/P |
| 14 | Multi-token, order-independent search works: `settings org` surfaces Organization settings | P2 | S |
| 15 | `ArrowDown` + `Enter` activates the highlighted row and navigates | P1 | S |
| 16 | Clicking a Pages item navigates and closes the palette | P1 | S |
| 17 | Chevron click expands sub-items and does **not** navigate; clicking again collapses | P1 | S |
| 18 | Arrowing onto a parent auto-expands it; arrowing away collapses it | P2 | S |
| 19 | **Hovering** a parent does not auto-expand (pointer vs keyboard source) | P2 | S |
| 20 | While searching, a matching sub-item renders even though its parent is collapsed (`smtp` → SMTP options) | P1 | S |
| 21 | Selecting a sub-item navigates to the sub-item's path, not the parent's | P1 | S |
| 21b | Selecting `Vulnerable software` (a Software-inventory sub-item) lands on `/software/inventory?vulnerable=true` with the list rendered — the destination honours the param instead of dropping it on mount | P1 | S |
| 22 | `Packs` and `Add new pack` appear **only** when the query matches `packs` — absent from an unfiltered list | P2 | S |
| 23 | Group order is Pages → Controls → Software → Settings → MDM → Automations → Commands | P2 | S |
| 24 | Palette is reusable: open → navigate → open again → navigate somewhere else | P3 | S |

### `shared/command-palette/pickers.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 25 | `View host` opens the sub-page: placeholder `Search hosts...`, Back button and `ESC` pill appear, root's fleet switcher disappears | P1 | S |
| 26 | Searching a host name resolved via the API returns that row, with a status dot labelled `status: online` and (premium, non-Primo) a team column | P1 | S/P |
| 27 | Selecting a host navigates to `/hosts/:id/details` **without** `fleet_id` | P1 | S |
| 28 | Junk query → `No hosts match "<junk>".`; empty query with results shows rows, not the empty state | P1 | S |
| 29 | Debounce: fast typing issues one `/hosts` request for the final value, not one per keystroke | P2 | S |
| 30 | `View report` finds a gitops report by name and selects into `/reports/:id` (+`fleet_id` when scoped) | P1 | S |
| 31 | Report picker empty state suffix — **no** suffix at premium's default All fleets and on free (`getFleetSuffix` returns `""` for both), `... in Workstations.` on a fleet, `... in this fleet.` on Unassigned. Only the unsuffixed case is reachable from a shared spec | P1 | S/P |
| 32 | `View policy` finds and opens a policy; on a specific fleet a global policy shows the `Inherited` tag | P1 / P2 | S / P |
| 33 | `View software inventory` finds an installed title and opens `/software/titles/:id` — bare at All fleets / on free, `+fleet_id` only from a specific fleet | P1 | S/P |
| 34 | `Escape` on a picker sub-page returns to root instead of closing (the capture-phase interception) | P1 | S |
| 35 | `Backspace` on an empty input returns to root; `Backspace` with text in the input does not | P1 | S |
| 36 | Back button (`aria-label="Back"`) returns to root | P2 | S |
| 37 | Sub-page transition is announced through `role="status"` (`Search hosts`, ellipsis stripped) | P3 | S |
| 38 | `View software library` (premium, fleet-scoped) lists an uploaded package with its install icon; with the library empty the copy is `No software in Workstations's library.` | P2 | P |

### `shared/command-palette/deep-links.spec.ts`

Each case = palette item → destination page renders the right modal → the query param is
stripped from the URL. These specs assert *the deep link*, not the modal's behaviour — the
modals already have owners elsewhere in the suite.

| # | Case | Pri | Tier |
|---|---|---|---|
| 39 | `Add hosts` → Add hosts modal on `/hosts/manage`, `add_hosts` stripped | P1 | S |
| 40 | `Manage enroll secrets` → enroll-secrets modal, param stripped | P1 | S |
| 41 | `Manage activity automations` → Dashboard modal, param stripped | P1 | S |
| 42 | `Manage report automations` → Reports modal, param stripped | P1 | S |
| 43 | `Manage policy automations` → Policies modal, param stripped (needs ≥1 policy in scope) | P1 | S |
| 44 | `Manage software automations` → Software modal, param stripped (All fleets on premium) | P1 | S |
| 45 | `Add script` → Scripts library add modal, param stripped | P2 | S |
| 46 | `Add custom variable` → Variables add modal, param stripped | P2 | S |
| 47 | `Add self-service category` → categories add modal, param stripped | P2 | P |
| 48 | `Add fleet` → `/settings/fleets` with the Add fleet modal, `create_fleet` stripped | P1 | P |
| 49 | Reloading after a deep-linked modal opens does **not** reopen it (proves the strip, not just a cosmetic URL edit) | P2 | S |

### `shared/command-palette/commands.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 50 | `Switch to dark mode` adds `dark-mode` to `<body>`, closes the palette, and the label reads `Switch to light mode` on reopen | P1 | S |
| 51 | Changing the theme from My account flips the palette label live (`fleet-theme-change`), no reload | P2 | S |
| 52 | `Sign out` ends the session and lands on the login page (`pageHealth.disable()`) | P1 | S |
| 53 | `Add report` / `Add policy` / `Add label` land on their new-resource pages | P2 | S |
| 54 | `Run live report` / `Run live policy` land on the live-run entry points | P2 | S |

### `shared/command-palette/role-access.spec.ts` (+ premium counterpart)

Driven with `withStaticUser`, same pattern as `premium/labels/role-access.spec.ts`.

| # | Case | Pri | Tier |
|---|---|---|---|
| 55 | Global observer: Pages group only — no `Add hosts`, no Settings / MDM / Automations groups; `View host` / `View report` / `View policy` still available | P1 | S |
| 56 | Global maintainer: Controls items and write Commands present; Settings, MDM, `Add user`, `Manage software automations` absent | P1 | S |
| 57 | Global admin: Settings, MDM and Automations groups all present | P1 | S |
| 58 | Technician: Controls reachable, but `Certificates` / `Passwords` / `Host names` sub-items and `Add script` are absent | P1 | P |
| 59 | Observer+: `Run live report` present, `Run live policy` absent | P1 | P |
| 60 | Team admin (`team-admin`): Controls + report/policy automations for their own fleet; no Settings group | P2 | P |
| 61 | Fleet maintainer (`ws-maintainer`): `Add script` present, `Manage policy automations` absent (admin-only) | P2 | P |

### `premium/command-palette/fleet-switcher.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 62 | Switcher button shows the current fleet name, renders the `⌘ ⇧ F` pills, and those pills are `aria-hidden` so they stay out of its accessible name (the `kbd` pills exist only inside this premium-only button, so the shared spec can't cover them) | P1 | P |
| 62b | Host picker renders the team column (premium, non-Primo); it is absent on free — lifted out of the shared pickers spec, which must not branch on tier | P2 | P |
| 63 | `Cmd/Ctrl+Shift+F` from **closed** opens straight onto switch-fleet; placeholder `Search a fleet...` | P1 | P |
| 64 | `Cmd/Ctrl+Shift+F` from **open root** jumps to switch-fleet | P1 | P |
| 65 | Picker lists All fleets, Unassigned, Workstations, QA, VMs; the current one is styled selected | P1 | P |
| 66 | Selecting Workstations from Hosts sets `fleet_id`, the page's team dropdown follows, and the palette returns to root **still open** | P1 | P |
| 67 | Selecting `All fleets` while on Controls redirects to `/hosts/manage` (page can't render All) | P1 | P |
| 68 | Same redirect from Software library and from the new-report page | P2 | P |
| 69 | On `/settings/fleets/users` the picker omits `All fleets` | P2 | P |
| 70 | On the Dashboard the picker omits `Unassigned` | P2 | P |
| 71 | Switching fleets drops `page` (start on Hosts page 2 → `fleet_id` set, `page` gone) | P2 | P |
| 72 | Fleet search filters rows; junk → `No fleets match "<junk>".` | P2 | P |
| 73 | Selecting the already-current fleet is a no-op that returns to root | P3 | P |

### `premium/command-palette/team-context.spec.ts`

A **sample** of the chip matrix — enough to catch a wiring regression, not a re-run of
`helpers.tests.ts`.

Read the shipped code before writing these: only six items carry `teamName` in 4.90 —
`Dashboard`, `Reports`, `Add report`, `Run live report`, `Manage report automations` (all
`"All fleets"`, and only while on Unassigned) and `Controls` (the default fleet name). The
issue's `Add hosts` / `Manage enroll secrets` "Unassigned" chip rows are **stale** — neither
item has a `teamName` any more. Verified live: on All fleets, no row renders a chip at all.

| # | Case | Pri | Tier |
|---|---|---|---|
| 74 | On Unassigned: `Dashboard`, `Reports`, `Add report`, `Run live report`, `Manage report automations` each show an `All fleets` chip | P1 | P |
| 75 | On Workstations: none of those five carry a chip | P1 | P |
| 76 | On All fleets: no row carries a chip, and `Add hosts` / `Manage enroll secrets` specifically don't | P1 | P |
| 77 | Team-scoped paths carry `fleet_id` (`Add hosts` from Workstations) while Settings / Labels / My account / Sign out do not | P1 | P |
| 78 | Invoking `Add report` from Unassigned actually lands in All-fleets context — the chip's promise holds | P2 | P |

### `premium/command-palette/premium-items.spec.ts` / `free/command-palette/tier-gating.spec.ts`

| # | Case | Pri | Tier |
|---|---|---|---|
| 80 | Free: premium-gated items are absent — Disk encryption, Certificates, Passwords, Host names, Setup experience, Software library, `View software library`, `Add Fleet-maintained app`, `Add VPP app`, `Add Android app store app`, `Add custom package`, `Add self-service category`, Settings → Fleets, `Add fleet`, Conditional access, Calendar events, Change management, Certificate enrollment, ABM, VPP | P1 | F |
| 81 | Free: no fleet-switcher button, and `Ctrl+Shift+F` does nothing | P1 | F |
| 82 | Free: non-premium items are present — OS settings, Configuration profiles, Scripts, Variables, `Add script`, `Add custom variable`, Vulnerabilities, `Add label`, `Add user`, `Add API-only user` | P1 | F |
| 82b | Free: the `Controls` Pages row is absent (its landing tab, OS updates, is Premium) while the Controls **group** still lists the free sub-pages — the intended shape, see finding 1. Also covers `OS updates` and `Setup experience` being absent | P1 | F |
| 83 | Premium on a specific fleet: every item from #80 is present | P1 | P |
| 84 | Premium: `View software library` and the four software-add commands are hidden on All fleets, shown on Unassigned and on Workstations | P1 | P |
| 85 | MDM group matches live config — read `/config` first, then assert (today: `Edit Apple (macOS, iOS, iPadOS) MDM`, `Edit Windows MDM`, `Turn on Android MDM`, premium `Edit Apple Business (AB)`) | P2 | S/P |

## Findings to resolve before writing the specs

1. **`Controls` missing from the palette on Fleet Free is intended — not a bug.** The gate is
   deliberate (commit `4d0c6285f2`, "Unreleased bug fixes to command palette … Controls on
   Fleet Free"). Verified on free-fleetqa: `/controls` defaults to the **OS updates** tab,
   which is Premium, so the page renders "This feature is included in Fleet Premium." A
   palette row landing a free user on an upsell is worse than no row. The palette hides
   exactly the two paywalled tabs (OS updates, Setup experience) plus the Controls landing
   row, and surfaces the free-available sub-pages (OS settings, Configuration profiles,
   Scripts, Script library, Script batch progress, Variables, Global variables, Custom host
   vitals). The free spec asserts that shape as intended behaviour.
2. **The story's policy-automation sub-item rows are stale.** `Manage policy automations` is a
   single item now (its keywords vary by scope); the `?manage_automations=webhooks|install_software|run_script|calendar|conditional_access`
   sub-items described in the issue don't exist in 4.90. Case #43 reflects the shipped shape.
3. **Best-match ordering** is a scored ladder with near-tie alphabetical fallback. Assert only
   "exact label promotes to first row" (#11); don't assert relative order of near-ties — that
   contract belongs to `helpers.tests.ts`.
4. **Primo Mode and GitOps Mode are uncoverable here.** Neither QA instance runs Primo, and
   `gitops_mode_enabled` is false on both. The story flags both as needing manual verification
   (`Add fleet` hiding, chip suppression, switcher hiding). Standing coverage gap → `TODO.md`,
   not a skip.
5. **No no-access static user exists**, so "palette doesn't render for no-access" stays with Jest.
6. **The Controls chip is unreachable code.** `groups/pages.ts` renders the Controls row only
   when `hasTeamOrUnassigned` is true, and `deriveContext`'s `getDefaultTeamName()` returns
   `undefined` in exactly that case — the two conditions are mutually exclusive, so
   `teamName: switchesFromAllFleets` can never render. Confirmed live: on All fleets the
   Controls row is absent entirely, chip or no chip. Nothing to test; worth mentioning to the
   authors since `helpers.tests.ts` asserts the resolver in isolation and so can't catch it.

## Explicitly out of scope for Playwright

- The full chip matrix (5 contexts × ~25 actions) — `helpers.tests.ts`.
- Best-match scoring tiers and `highlightMatches` folding (accents, surrogate pairs) — unit.
- `usePickerSearch` debounce internals, react-query `staleTime` / `cacheTime` — unit.
- `isPreFilteredResult` prefix typo-guard — unit.
- Chevron rotation, sub-item indentation, focus ring recolouring — CSS only.
- `isNoAccess` → renders `null` — no static user to drive it.
