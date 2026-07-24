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
4a. [x] **reports save-as-new** (premium + free) — commit `60944c1`.
4b. [x] **reports list-filters** (premium) — commit `613b5be`.
5. [x] **labels CRUD** (premium, Dynamic + Manual) — commits `01ad292`, `757a8c7`.
6. [x] **org-settings** organization-info (premium + free) + **appConfig save/restore helper** — commit `4e6a85a`.
7. [x] **vuln/report/policy automations** — all three shipped.
   - [x] **software vulnerability-automations** (premium + free) — commit `1ac34fe`.
   - [x] **reports automations** (premium + free) — commit `711ff90`.
   - [x] **policy automations** (premium + free) — commit `b27bbe7`.

## ✅ HANDOFF order (items 1–7) COMPLETE.

## Extras (beyond the named order) — status
- [x] **labels sort-view** (premium) — commit `e25893d`. Name column sorts **case-sensitively** (UTF-16
  code-unit: "ARM…" < "Apple…", "…1Password" < "…Brave") — not lowercased. Read the Name column via
  `DataTable.cellByColumn(row,'Name')` (the `.name__cell` class guess was wrong) and wait for `firstRow`
  (goto only anchors the heading). "View all hosts" → Hosts `filterPill`.
- [x] **labels role-access** (premium) — commit `2e0e9f8`. `canAddLabel` = global admin/maint/tech OR any
  team maint/admin/tech; `hasEditPermission` = global admin/maint/tech OR author+team-role OR team-scoped
  label. So global-observer: no Add + only "View all hosts"; ws-maintainer: has Add but only "View all
  hosts" on a GLOBAL label (must use ws-maintainer, not global-maintainer, for the can't-edit assertion).
  POM: `openRowActions()` + `rowActionOption()`.
- [x] **software no-teams-views** (premium) — commit `cf253f9`. Read-only: Unassigned scope persists across
  Inventory/OS/Vulnerabilities (assert via `TeamDropdown.currentValue`); drilling a title → detail with no
  "Add software". Reuses SoftwareTitlesPage; premium-only (Unassigned is a premium scope).
- [x] **controls custom-variables** (premium) — commit `e4a030a`. Redesigned table UI; add/delete + name
  validation (auto-uppercase; format error disables Save; "required" is suppressed until save, so Save is
  ENABLED on an empty form). New `helpers/api/variables.ts`. Per-test cleanup by created name (shared-marker
  purge deletes a sibling's variable under parallel workers).
- [x] **settings Fleet Desktop** (premium) — commit `e66ef72`. Presence check (premium-only "Custom
  transparency URL"); inline locators.
- [x] **settings enroll-secrets** (premium) — commit `00042b5`. Add secret to Workstations, API-verified;
  snapshot/restore via new `helpers/api/enroll-secrets.ts`. Opened via ?manage_enroll_secrets=1 deep link;
  SecretEditorModal scoped by "Must contain at least 32 characters" (shares "Add secret" title with the list
  button). POM on HostsListPage.
- [ ] software **edit-package** (EditSoftwareModal + 4 ACE editors — biggest lift, deferred from Batch 1).
- [ ] (superseded — see custom-variables DONE above) UI has been **REDESIGNED** since the QA Wolf
  flow. Now Controls→Variables → a `SideNav` with two cards: **Global variables** (name+value, the
  custom-variable-with-secret) and **Custom host vitals**. Both are **table-based** (not the flow's
  `.list-item`). `AddCustomVariableModal` (title "Add custom variable", InputField Name/Value, name
  auto-uppercases, validation "Name is required"/"Value is required"/"Name may only include uppercase
  letters, numbers, and underscores"); delete via a trash `Icon` button `ariaLabel="Delete <name>"` +
  `DeleteCustomVariableModal`. Frontend: `pages/ManageControlsPage/Variables/**`. Premium (gated on
  isPremiumTier). Re-ground against `cards/GlobalVariables` — the QA Wolf `.list-item` selectors are stale.
- [ ] other **settings**: advanced-options (appConfig save/restore; **AVOID host-expiry — can delete hosts**,
  and most advanced toggles have side effects: scripts/software-inventory off would break other specs — pick
  a truly innocuous field or skip), fleet-desktop (premium-only presence), enroll-secrets (view = safe read).
- [ ] **mdm** (disk-encryption, mdm-settings), **controls** (batch-progress nav/empty, run-script-modal),
  **automatic-enrollment**, API file-size spec.
- [ ] Batch 3 (hosts area) + Batch 4 (host-dependent).

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

### 4a. reports Save as new — `{premium,free}/reports/save-as-new.spec.ts`
- Grounded in `frontend/pages/queries/edit/components/SaveAsNewQueryModal`. Modal title "Save as new";
  name `InputField name="queryName"` → `#queryName`, default `Copy of <name>`; submit `.save-as-new-query`
  ("Save"); success `Successfully added report <name>.`; dup error `A report called "<name>" already exists
  for <all fleets|the <Team> fleet|this fleet>.`. The in-modal Fleet dropdown renders only when
  `isPremiumTier && userTeams.length > 1`.
- "Save as new" trigger button renders on the **edit form** only for existing reports + save-permitted
  roles (EditQueryForm `hasSavePermissions && isExistingQuery`); disabled on form errors.
- New API helper `helpers/api/reports.ts`: `createReport` (POST `queries`, body `{name,query,description,
  team_id?}`; omit team_id → global), `listReports`, `deleteReport`, `deleteReportsMatching(substring)`.
- **Isolation lesson**: first run flaked under 4 workers — (1) `Date.now()`-only names collided across
  workers → seed 409; (2) afterEach cleaning by a shared marker nuked a sibling test's base mid-flight.
  Fix: base name = `<marker>-<Date.now()>-<rand>`, and afterEach cleans by that per-test `baseName` (which
  also matches its own "Copy of <baseName>"). POM: `ReportEditPage.openSaveAsNew()`/`submitSaveAsNew()`.
- Live: premium 2, free 2 (stable in parallel).

### 4b. reports list-filters — `premium/reports/list-filters.spec.ts`
- Grounded in `frontend/.../ManageQueriesPage/components/QueriesTable` (baseClass `queries-table`).
- Platform filter: `DropdownWrapper name="platform-dropdown"`, `.queries-table__platform-dropdown
  .react-select__control`, options `data-testid="dropdown-option"`, drives `?platform=darwin|windows`.
  `variant="table-filter"` + `isDisabled` when the list is truly empty — so seed reports first.
- Inherited: `<PillBadge>Inherited</PillBadge>` shown when `viewingTeamScope && team_id !== currentTeamId`
  (i.e. a global report viewed under a team). Assert via row-scoped `getByText('Inherited')`. Count widget
  is `TableCount name="reports"` (`.table-count`).
- `createReport` gained an optional `platform` (comma-separated targeted platforms, e.g. "darwin").
- Isolation: each test seeds uniquely-named reports + cleans by its own marker; assertions target specific
  named rows (visibility), so parallel siblings sharing the list don't interfere. Search+platform compose
  (both URL params). POM: `ReportsListPage.searchByName()` + `selectPlatform()`.
- **Team-admin variants (P24/P25) skipped** — no team-admin static user provisioned (see cross-cutting gaps).
- Live: premium 3 (stable over --repeat-each=3).

### 5. labels CRUD — `premium/labels/labels.spec.ts` (+ big `LabelsPage` build)
Two serial lifecycles (Dynamic + Manual): create → edit → delete → activity feed. Grounded in
`frontend/pages/labels/{ManageLabelsPage,NewLabelPage,EditLabelPage}` (thorough Explore grounding — see
the corrections below).
- **Instance reality (matters a lot):** ~27 gitops-provisioned custom labels; the list is **client-side
  paginated (20/page, DEFAULT_PAGE_SIZE)** sorted by name → a new label often lands on page 2. →
  `LabelsPage.locateRow(name)` pages via the `Pagination` component until found; `runRowAction()` +
  create/edit verifications all go through it. Do NOT use `rowFor` alone for a fresh label.
- **Grounding corrections vs QA Wolf hints:** Type cell is `.label_membership_type__cell` (not
  `.type__cell`); row Actions is a react-select `ActionsDropdown` (`.actions-dropdown-select__control` +
  `__option`, matched by TEXT — **no** `data-testid="dropdown-option"`; that testid is only on the Platform
  DropdownWrapper), menu portals to `<body>`, reveals on row hover; edit is `/labels/:id` (not `/edit`);
  Dynamic query is immutable on edit; delete → "Delete label" modal (confirm "Delete"), toast
  `Successfully deleted <name>.`. Create toast `Label added successfully.` → redirect `/labels/manage`;
  edit toast `Label updated successfully.` (no redirect).
- **Fleet Radio** hides the real `<input>` (display:none) → `selectType()` clicks the `<label>` text, not
  the radio (`.check()` only worked because Dynamic is the default).
- **Manual host picker (TargetsInput):** `getByRole('searchbox')`, results `.display_name__cell` (click to
  add), selected table `.targets-input__hosts-selected-table`, remove via `.delete__cell`. `addHost()`
  **verifies the host landed in the selected table** — a manual label saved with 0 hosts is rejected with a
  `missing required parameter(s)` 422 (was an intermittent create-fail). The search also logs that same
  benign 4xx to the console while typing (label still saves) → Manual `create` uses `pageHealth.disable()`.
- **Dynamic create is host-independent** (form ships a valid default query). **Manual** picks a host via
  `firstHostDisplayName()` (offline hosts resolve).
- **Cleanup:** `cleanup.steps.ts` does NOT wipe labels → each lifecycle's `beforeAll` purges its own marker
  (`pw-label-dyn` / `pw-label-man`) via a cookie-less API context (`deleteLabelsMatching`). Distinct markers
  per describe so parallel describes don't delete each other's in-flight labels.
- **activityCopy.label** added (`created a label` / `edited the label` / `deleted the label`) + gate case.
- **Do NOT validate with `--repeat-each`** here: the serial `name` is a module-level `Date.now()` shared
  across repeats, so parallel repeats collide on the same label name (harness artifact, not a real bug).
- **Not yet done in the labels area (follow-ups):** sort-headers + "View all hosts" spec (C9 #13),
  role-access (maintainer own-only / observer view-only, C9 #14/#15). `LabelsPage` already has the row-action
  + `filterPill` plumbing to build these on.
- Live: premium 8 sub-tests (single run).

### 6. org-settings organization-info + appConfig helper — `{premium,free}/settings/organization/organization-info.spec.ts`
- **New shared infra `helpers/api/config.ts`:** `getAppConfig` (GET /config) + `patchAppConfig` (PATCH
  /config, merge). This is the prereq for all global-config-mutating specs. Pattern: snapshot the touched
  subtree in `beforeEach`, restore it in `afterEach` (runs even on body failure) so the shared instance is
  left unchanged.
- **Grounding:** the "Organization support URL" field is `org_info.contact_url` in the API — **NOT**
  `org_support_url` (PATCH rejects that with `unsupported key provided`). From
  `frontend/pages/admin/OrgSettingsPage/cards/Info` `formDataToSubmit`. Save toast: "Successfully updated
  settings.". Org name field label "Organization name" (role textbox); support URL "Organization support URL".
- Built out the bare `OrganizationInfoPage` (orgName/supportURL/save + toast).
- **fleet-web-address deliberately NOT ported** (C7 #4/#14) — rewriting the server URL can break instance
  auth. If ever wanted, do it purely via the appConfig helper with a guaranteed restore, or reduce to presence.
- Live: premium 1, free 1.

## Item 7 — automations: kickoff notes
All three mutate GLOBAL config → reuse `helpers/api/config.ts` snapshot/restore in `afterEach`.
- [DONE] **software vulnerability-automations** (C6 #16/#17) — commit `1ac34fe`. Grounding that transfers to
  the other two: Fleet's `Slider` is a `role="switch"` button with `aria-checked`; the modal can open on the
  "Ticket" workflow (disabled Save, no URL field) so select the "Webhook" radio (hidden-input Radio → click
  the label) before the URL field renders; the "Destination URL" label is tooltip-wrapped (no htmlFor) so
  target by placeholder `https://server.com/example`; config key `webhook_settings.vulnerabilities_webhook`
  (`enable_vulnerabilities_webhook` + `destination_url`); toast "Successfully updated vulnerability
  automations.". **saveAutomations() waits for the modal to CLOSE** (the 5s success toast lingers between
  consecutive saves and falsely satisfies a wait). **Assert persistence via the API, not a second UI reopen**
  — a reopened modal renders stale config (observed live; the disable-direction reopen showed stale on free,
  so the spec is scoped to a single enable→persist flow).
- [DONE] **reports automations** (C4 P2/P7) — commit `711ff90`. KEY: report automations are **per-report**
  state (`automations_enabled` on the query), NOT global config — the list-level "Manage automations" modal
  (`ManageQueryAutomationsModal`) Save PATCHes each query via `queriesAPI.update`. So NO appConfig
  save/restore: seed a report + toggle its checkbox (accessible name = report name) + Save (toast
  "Successfully updated report automations.") + verify `automations_enabled` via `findReportById`. The
  AutomationsButton is enabled once the scope has ≥1 report.
- [DONE] **policy automations** (C3 #10/#12/#14) — commit `b27bbe7`. This one IS global config
  (`webhook_settings.failing_policies_webhook`) → appConfig save/restore. Modal title "Automations" (not
  "Manage automations"); controls in the nested `OtherWorkflowsModal` (Slider role=switch, Webhook/Ticket
  radios, "Destination URL" by placeholder); toast "Successfully updated policy automations." The
  "Automations" button is `disabled={!hasPoliciesToAutomate}` → seed a global policy first via new
  `helpers/api/policies.ts` (`createPolicy` POST `/global/policies`, `deletePolicies` POST
  `/global/policies/delete` — NOT `/policies`, which 404s).

## Deferred within Batch 2 (revisit)
- **policies bad-SQL persistence** (C3 #11): save a syntax-error policy → reopen → SQL persisted. Skipped
  for now — it mutates (create+delete) and the "Save stays enabled" assertion already captures the intent,
  matching the read-only reports precedent. Add later as a self-contained create→reopen→delete test if wanted.
