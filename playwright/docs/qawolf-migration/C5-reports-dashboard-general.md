# C5 — reports-list + dashboard + activity-feed + general-UI — audit

## Key framing corrections (read first)

1. **The `reports-*` flows are NOT the Reports LIST page.** They almost all exercise the
   **Host Details → Reports tab** (`.host-report-card`, `.host-reports-tab__count`, the sort
   dropdown A-Z/Z-A/Oldest, the "Show reports that don't store results" switch). Only the
   *first half* of `search-for-a-report` and the settings step of `disable-stored-reports-setting`
   touch the `/reports/manage` list page — and that list-search behavior is already exercised by
   `reports.spec.ts` (`reportsList.search.fill()` + row/interval assert). So the genuine gap here is
   **host-details Reports-tab view behavior**, not list filtering.
2. **Filename/content mismatch:** `flows-Free/general-dashboard-widgets-hosts-active-ui-and-filters.flow.ts`
   does NOT contain a dashboard-widgets flow — its actual body is the **free-tier Dark mode** flow
   (verified: header reads `"Dark mode - Dark mode UI and fleet automatically uses user preference…"`).
   There is therefore **no dashboard-widgets/hosts-active flow** in this cluster, and two dark-mode
   flows (free + premium).
3. No dashboard, activity-feed, dark-mode, hover-state, host-Reports-tab, or host-Software-tab
   (Inventory/Library sub-tab) e2e spec exists today. `DashboardPage.expectActivities()` walks/paginates
   the feed but never touches the feed **filter/sort controls**. `HostDetailsPage` declares
   `reportsTab`/`inventoryTab`/`libraryTab` locators but has **no methods** for sort/search/toggle/card
   reads or Library-tab content.

## Disposition table

| # | QA Wolf flow (basename) | Tier | Behavior (1 line) | Disposition | Target (existing or proposed path) | Notes |
|---|---|---|---|---|---|---|
| 1 | dashboard-teams-dropdowns-not-searchable-in-free | Free | Free tier renders no team dropdown & no team_name column | AUGMENT | tests/e2e/free/paywalls.spec.ts | Small tier-absence assertion; `TeamDropdown.select()` already no-ops on free, so this just makes the absence explicit. Low value but cheap. Pairs with #10. |
| 2 | general-dashboard-widgets-hosts-active-ui-and-filters | Free | **(mislabeled file = free Dark mode)** system default + Light/Dark toggle + persist across relogin | AUGMENT | tests/e2e/free/account/my-account.spec.ts | Graft a non-visual "theme radio persists after logout/login" assertion (`.radio__control-button` checked state). **CUT the `toHaveScreenshot` visual-diff assertions** (we keep no baselines; brittle). MERGE-pair with #11. |
| 3 | reports-reports-filter-by-name-a-z | Free | Host-details Reports tab: sort "Name A-Z", cards sorted asc | NEW (anchor) | tests/e2e/free/reports/host-reports-tab.spec.ts | Real behavior (sort order verified), lower priority. POM gap: host Reports-tab methods. |
| 4 | reports-reports-filter-by-name-z-a | Free | Sort "Name Z-A", cards sorted desc | MERGE | → #3 spec | Sort variant. |
| 5 | reports-reports-filter-by-older-results | Free | Sort "Oldest results", cards ordered oldest→newest, pending last | MERGE | → #3 spec | Sort variant; adds the "pending cards sort last" edge case. |
| 6 | reports-reports-search-for-a-report | Free | List search (verify not-inherited + results count) + host-tab search filters cards | MERGE | → #3 spec | **List-search half is DUP of free reports.spec.ts**; unique part = host-tab search box filtering cards. Flow code is buggy (`for i<searchResults` iterates over an array, not length) — don't port logic. |
| 7 | reports-reports-show-reports-that-have-no-results | Free | Host-tab "Show reports that don't store results" toggle → count +1, card appears | MERGE | → #3 spec | Genuinely useful behavior. Its create-report-if-missing preamble = DUP of reports.spec create; use API seeding instead. |
| 8 | activity-feed-filter-activity-feed-by-actor-full-name-email-type-and-date-sort-by-time | Premium | Dashboard activity feed filter by actor/type/date + sort by time | NEW | tests/e2e/premium/dashboard/activity-feed-filters.spec.ts | Real gap — filter/sort controls untested. But heavy: 10-page while loops, `waitForTimeout`, faker randomness, hardcoded qawolf actor counts & seeded activity data. Needs substantial rework + new POM (feed filter/sort methods on DashboardPage). Medium-high value, expensive. |
| 9 | activity-feed-labels-label-related-activities-appear-in-feed-create-edit-and-delete | Premium | Label create→edit→delete, then feed shows all three activities | NEW | tests/e2e/premium/labels/labels.spec.ts | Really a **Labels CRUD lifecycle** spec (activity feed is just the final assertion, our standard pattern). Overlaps a probable "labels" cluster owned by another agent — flag ownership. POM gap: LabelsPage has no create/edit/delete; needs `activityCopy.label.{created,edited,deleted}`. |
| 10 | dashboard-team-dropdowns-searchable-searching-and-selecting-a-valid-team-shows-proper-hosts | Premium | Team dropdown is type-searchable; selecting a team filters hosts table to that team | NEW (small) | tests/e2e/premium/hosts/team-scope-filtering.spec.ts | Two behaviors: (a) dropdown search (minor), (b) **team scope actually filters the hosts table** (genuine, currently unasserted). Must rework off hardcoded "Ducks" team → use `Workstations`. Overlaps a hosts cluster — flag. Pairs with #1. |
| 11 | general-dark-mode-dark-mode-ui-and-fleet-automatically-uses-user-preference-on-dark-mode | Premium | system default + Light/Dark toggle + persist across relogin | AUGMENT | tests/e2e/premium/account/my-account.spec.ts | Same as #2 (premium copy). Keep theme-persistence assertion; **CUT the screenshot assertions**. MERGE-pair with #2. |
| 12 | general-inventory-verify-tab-availability-and-content | Premium | Host Software → Inventory tab: columns, item count, search, filters, rows non-empty, pagination | NEW (anchor) | tests/e2e/premium/hosts/host-software-tabs.spec.ts | Mostly presence/content checks (medium value) but does assert per-row data presence. POM: extend HostDetailsPage (has `inventoryTab`/`openSoftwareTab`/`showFullInventory` already). Selects "Virtual Machines" team + random host — rework to Workstations + API-found host. |
| 13 | general-library-verify-tab-availability-and-content | Premium | Host Software → Library sub-tab: heading, count, availability dropdown, search, Add software, columns, per-row Install/Reinstall/Uninstall/Retry | MERGE | → #12 spec | Same host Software-tab area, sibling sub-tab. Distinct from top-level `premium/software/library.spec.ts` (that's `/software/titles` CRUD, this is the host-scoped install list). |
| 14 | general-new-hover-states-and-gray-underlines-across-fleet | Premium | Avatar src attr, hover background rgb, focus outline radius/color, link ::before/::after CSS, hover screenshots | CUT | — | Pure cosmetic. Asserts exact CSS pixel/color values + visual snapshots; brittle, tests styling not behavior. Exactly the CUT candidate the brief flagged. |
| 15 | reports-reports-disable-stored-reports-setting | Premium | Org Advanced-options "Store report results" ↔ host Reports-tab "show no-results" toggle visibility | NEW | tests/e2e/premium/reports/stored-results-setting.spec.ts | Real feature interaction (org setting gates the host-tab toggle). Mutates a **global org setting** with save+restore → keep isolated, not folded into #16. Could also be a serial sub-test of #16. |
| 16 | reports-reports-filter-by-name-a-z | Premium | Host-details Reports tab sort "Name A-Z" (Virtual Machines host) | NEW (anchor) | tests/e2e/premium/reports/host-reports-tab.spec.ts | Premium copy of #3; rework team to Workstations + API-found host. |
| 17 | reports-reports-filter-by-name-z-a | Premium | Sort "Name Z-A" | MERGE | → #16 spec | Sort variant. |
| 18 | reports-reports-filter-by-older-results | Premium | Sort "Oldest results", pending last | MERGE | → #16 spec | Sort variant. |
| 19 | reports-reports-search-for-a-report | Premium | List search + host-tab search | MERGE | → #16 spec | List-search half DUP of premium reports.spec.ts; same buggy loop as #6. |
| 20 | reports-reports-show-reports-that-have-no-results | Premium | Host-tab show-no-results toggle → count +1 | MERGE | → #16 spec | Premium copy of #7. |

## Summary

- **Counts:** DUP 0, AUGMENT 3, NEW 7, CUT 1, MERGE 9  (total 20)
  - (Note: the "list-search" halves of #6/#19 are DUP of the existing reports.spec.ts but the flows as
    a whole are MERGE into the host-reports-tab spec, so they're counted as MERGE with a DUP note.)

- **NEW specs recommended (proposed paths):**
  - `tests/e2e/free/reports/host-reports-tab.spec.ts` — host-details Reports tab: sort (A-Z/Z-A/oldest), search-filter, show-no-results toggle (flows 3–7).
  - `tests/e2e/premium/reports/host-reports-tab.spec.ts` — premium copy scoped to Workstations (flows 16–20).
  - `tests/e2e/premium/reports/stored-results-setting.spec.ts` — org "Store report results" setting ↔ host-tab toggle (flow 15).
  - `tests/e2e/premium/hosts/host-software-tabs.spec.ts` — host Software tab Inventory + Library sub-tab availability/content (flows 12–13).
  - `tests/e2e/premium/dashboard/activity-feed-filters.spec.ts` — dashboard feed filter-by-actor/type/date + sort (flow 8). Expensive; lower priority.
  - `tests/e2e/premium/labels/labels.spec.ts` — Labels CRUD lifecycle + activity-feed assertion (flow 9). *Likely belongs to a labels cluster — confirm ownership.*
  - `tests/e2e/premium/hosts/team-scope-filtering.spec.ts` — team dropdown searchable + team scope filters hosts table (flow 10). *Overlaps hosts cluster — confirm ownership.*

- **Notable CUTs:**
  - #14 hover-states / gray-underlines — pure CSS/visual assertions (rgb values, outline radius, pseudo-element backgrounds, screenshots). No user-facing behavior; brittle. Full CUT.
  - Visual `toHaveScreenshot` assertions inside both dark-mode flows (#2, #11) — CUT the screenshots, keep only the theme-persistence radio assertion.

- **POM / helper work required:**
  - **HostDetailsPage** (biggest): add Reports-tab methods (open tab, select sort option via `.react-select__indicators`, read `.host-report-card__name` list, read `.host-reports-tab__count`, toggle "Show reports that don't store results", search box). Add Software→Inventory + Software→Library sub-tab content readers (column headers, item count, per-row cells, action buttons). Rework off `hostName` hardcodes + random-host selection to API-found hosts.
  - **DashboardPage:** add activity-feed **filter/sort** controls (actor search box, `.activity-type-dropdown`, date-filter dropdown, sort dropdown) — none exist today; only `expectActivities()` pagination does.
  - **LabelsPage:** currently goto+table only — needs create (name/SQL), edit-via-row-action, delete methods; plus `activityCopy.label.*` entries.
  - **MyAccountPage:** add theme radio controls (`.radio__control-button` System/Light/Dark) for the dark-mode persistence assertion.
  - **TeamDropdown:** add a `searchByTyping()` / option-count reader for flow 10 (currently only idempotent `select()`).

- **Role-model / infra gaps:**
  - Flows use hardcoded qawolf accounts (`fleet+GlobalAdmin*@qawolf.email`) and env `GLOBAL_ADMIN_EMAIL` — map to our admin storage state / static users.
  - Premium reports/inventory/library flows hardcode team **"Virtual Machines"** and host **`qawolf-premium-macos-14`**, and flow 10 hardcodes team **"Ducks"** — none exist in our gitops model. Rework to `Workstations`/`Unassigned` + API host discovery. No teams may be created/deleted in-test.
  - Flow 8 depends on **pre-seeded activity volume** (specific per-actor activity counts, ≥1 of each activity type, multi-page feeds) — our instances won't have this deterministically; needs seeding strategy or major rework.
  - Flow 9 (labels) depends on `Global Admin User 2` display name in feed copy — use our admin's actual name.

- **Open questions for the human:**
  1. **Ownership:** flow 9 (Labels CRUD) and flow 10 (hosts team-scope filtering) sit at cluster boundaries — should they move to a labels / hosts cluster rather than this one?
  2. The host-details Reports-tab sort trio (A-Z/Z-A/oldest) is low-value ("does the sort dropdown sort?"). Author all three, or just keep the show-no-results toggle + one sort sanity check?
  3. Dark mode: acceptable to drop all visual-screenshot coverage and keep only the theme-persistence assertion? (We maintain no screenshot baselines except one in sso-login.)
  4. Is "Store report results" (flow 15) actually premium-gated, or should there be a free counterpart too?
  5. Free/premium host-reports-tab specs are near-identical behavior — keep two tier specs (team preference) or a single `shared/` spec? The team's stated preference is explicit tier separation, so I proposed two.
