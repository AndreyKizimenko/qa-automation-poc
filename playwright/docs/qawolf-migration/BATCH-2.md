# Batch 2 — Net-new specs (host-independent + Unassigned host-data reads)

Scope (confirmed by the lead): **only** host-independent UI specs + host-data *reads* scoped to
Unassigned. Anything needing an ONLINE host (live-query runs, refetch, run-script, executing
automations, batch-script lifecycle) is the FINAL batch (after the daily host-autoenroll action lands).

Validation gate per slice: `npm run check` (0 errors) → live `test:premium` + `test:free` → commit to
`main` in a logical chunk (no PR, no push). Selectors re-authored + grounded in
`~/repositories/fleet/frontend`; QA Wolf selectors are hints only.

Legend: [ ] todo · [x] done (green + committed) · [~] blocked/needs-input

## Order (from HANDOFF) + status
1. [x] **software manage-automations-access** (premium + free) — commit `be1e420`.
2. [x] **policies sql-validation** (premium + free) — commit `e12a28c`.
3. [x] **software os** (premium) — commit `795159e`.
4. [ ] **reports save-as-new + list-filters**.
5. [ ] **labels CRUD** — big `LabelsPage` build.
6. [ ] **org-settings** — build an appConfig save/restore helper FIRST.
7. [ ] **vuln/report/policy automations** — global config → save/restore (depends on #6's helper).

## Done — grounding notes (revisit, don't re-derive)

### 1. software manage-automations-access — `{premium,free}/software/manage-automations-access.spec.ts`
- The control's **visible label is "Automations"** (settings icon + "Automations"), NOT "Manage
  automations" — `frontend/components/buttons/AutomationsButton`. It opens the **"Manage automations"**
  modal. The old `SoftwareTitlesPage.manageAutomationsButton` locator (`name: 'Manage automations'`) was
  **stale and never matched**; the QA Wolf negative flows only "passed" because they asserted a
  non-existent button was not visible (false-safe). Fixed the POM locator + the pages/README example.
- Gating (`frontend/pages/SoftwarePage/SoftwarePage.tsx`): `canManageAutomations = isGlobalAdmin`
  (maintainer/observer/observer+/technician/team-roles never see it). Even for the admin, the button is
  **disabled unless `isAllTeamsSelected || isPrimoMode`** — a specific fleet disables it with the tooltip
  `Select "All fleets" to manage automations.` (folds in the C7 disabled-on-team-select flow).
- POM: `SoftwareTitlesPage.manageAutomationsButton` → `getByRole('button', {name:'Automations',exact:true})`;
  added `manageAutomationsModal` = `.modal__modal_container` filtered by "Manage automations".
- Roles via `withStaticUser` on shared static users (global-admin/maintainer/observer) — no ws-admin dep.
  Free has no team dropdown so the aggregate is always in effect → admin button simply enabled.
- Live: premium 4 passed, free 3 passed.

### 2. policies sql-validation — `{premium,free}/policies/sql-validation.spec.ts`
- All read-only on `/policies/new` — **no policy created** (matches the shipped reports SQL-validation
  augment pattern). Covers the lead's three sub-behaviors: compat badge / no-platform / bad-SQL-saves.
- Platform-compatibility badge (`frontend/components/PlatformCompatibility`): renders one
  `<span class="platform">` per OS; compatible ones carry a `compatible-platform` (check) Icon,
  incompatible a `incompatible-platform` (close) Icon. **The QA Wolf `data-testid="darwin-icon"` selectors
  do NOT exist** — `Icon` emits `data-testid="check-icon"`/`"close-icon"` and `class="icon <passed>"`. Count
  `.compatible-platform` under `.platform-compatibility` to get the number of supported platforms.
  - invalid table → "No platforms (check your query for invalid tables or tables that are supported on
    different platforms)"; no tables (`SELECT * WHERE 1 = 1`) → 4; `gatekeeper`/`mdm` → 1 (macOS); CTE name
    ignored (`WITH defined_cte AS (…osquery_info) …`) → not "No platforms".
- Syntax error → text `Syntax error. Please review before saving.` (reused `ReportEditPage`'s text locator)
  and **Save stays enabled** — `PolicyForm.disableSaveFormErrors` explicitly excludes syntax errors.
- No-platform gating: the **Save policy modal** (`SaveNewPolicyModal.disableSave`) disables Save when
  `!isAnyPlatformSelected`. (The main-page `disableSaveFormErrors` "no platforms" clause is EDIT-mode only;
  new-policy platform selection lives in the save modal via `PlatformSelector` — checkboxes
  `getByRole('checkbox',{name: macOS|Windows|Linux|ChromeOS})`, macOS checked by default.)
- POM: `PolicyEditPage` gains `platformCompatibility`/`compatiblePlatforms`/`sqlSyntaxError` locators,
  `compatiblePlatform(os)` accessor, `clearNewPolicyPlatforms()`.
- Free is a subset per C3 (#8 no-platform, #9 compat 3 cases) + the tier-agnostic syntax check.
- Live: premium 8 passed, free 5 passed.

### 3. software OS tab — `premium/software/os.spec.ts`
- Entry: `softwareTitles.goto()` → `teamDropdown.select('Unassigned')` → `softwareTitles.gotoOsTab()`
  (mirrors the vulnerabilities.spec sub-tab entry; SoftwareOsPage has no teamDropdown of its own).
- Platform filter is a `DropdownWrapper` (`name="os-platform-dropdown"`, baseClass `software-os-table`):
  trigger `.software-os-table__platform-dropdown .react-select__control`, options
  `data-testid="dropdown-option"`, value `.react-select__single-value`. Labels/values: All platforms=all,
  macOS=darwin, Windows=windows, Linux=linux, ChromeOS=chrome, iOS=ios, iPadOS, Android.
- **keepPreviousData race** (SoftwareOS.tsx `useQuery` keepPreviousData:true): after selecting a platform the
  URL flips (`?platform=darwin`) but the table keeps the prior rows until the refetch lands. Do NOT read row
  text once — assert with a retrying locator `rows.filter({ hasNotText: token }).toHaveCount(0)`.
- Row-content tokens: macOS rows contain "macOS", Windows rows contain "Windows" (name is "Microsoft
  Windows …"). **Linux omitted** — rows are distro-named (Ubuntu), not "Linux".
- "View all hosts" per-row → Hosts list filtered by that OS. `FilterPill`
  (frontend/.../ManageHostsPage/components/FilterPill) renders `role="status"`
  aria-label `hosts filtered by <label>` → `HostsListPage.filterPill = getByRole('status', {name:/hosts filtered by/})`.
  **Name mismatch**: the OS row shows "Microsoft Windows 11 Enterprise 22H2"; the pill shows "Windows 11
  Enterprise 22H2 10.0.22621" (no "Microsoft ", + build). Normalize row name via `.replace('Microsoft ','')`
  then `toContainText`. `viewHostsForFirstOs()` already existed on the POM.
- POM adds: `SoftwareTitlesPage.gotoOsTab()`; `SoftwareOsPage.platformFilter`/`platformFilterValue`/
  `selectPlatform()`/`firstOsName()`; `HostsListPage.filterPill` (reusable for Batch 3 hosts filtering).
- Live: premium 3 passed (stable over --repeat-each=3).

## Deferred within Batch 2 (revisit)
- **policies bad-SQL persistence** (C3 #11): save a syntax-error policy → reopen → SQL persisted. Skipped
  for now — it mutates (create+delete) and the "Save stays enabled" assertion already captures the intent,
  matching the read-only reports precedent. Add later as a self-contained create→reopen→delete test if wanted.
