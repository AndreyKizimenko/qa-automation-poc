# Free-tier coverage audit

**Date:** 2026-09-27 · **Suite at:** `playwright/` on `main` (post-#60) · **Fleet source read at:**
`~/repositories/fleet` @ `1f30f3ade1` (2026-09-25)

The question this answers: **where could the suite cover free and doesn't?**

Free is historically under-covered because the suite grew premium-first — QA Wolf's premium environment
had 306 flows to free's 43, and round 1 repeatedly found that flows they labelled "premium" were
tier-agnostic accidents of their own coverage rather than real tier differences. This audit walks every
premium-only spec in the tree and decides, per spec, whether the behaviour exists on free.

**House rule the recommendations respect:** never one spec with `if (isPremium)` conditionals. Every gap
below resolves to either *move/extend to `shared/`* or *add an explicit `free/` sibling*.

---

## 1. The current picture

Counts are exact, taken from `playwright test --list` on both projects (`SUITE=premium --project=premium`
and `SUITE=free --project=free`), not estimated. Totals are **test cases**, so a parameterised spec counts
once per generated case.

| project | total test cases |
|---|---:|
| `premium` | **479** |
| `free` | **264** |

### 1.1 By tree

| tree | specs | premium cases | free cases |
|---|---:|---:|---:|
| `tests/e2e/shared/` | 26 | 90 | 90 |
| `tests/e2e/premium/` | 62 | 309 | — |
| `tests/e2e/free/` | 23 | — | 108 |
| `tests/api/` (root, agnostic) | 3 | 18 | 18 |
| `tests/api/premium/` + `tests/api/role-access/premium/` | 5 | 18 | — |
| `tests/api/free/` + `tests/api/role-access/free/` | 3 | — | 12 |
| `tests/cli/shared/` | 3 | 16 | 16 |
| `tests/cli/premium/` | 5 | 23 | — |
| `tests/cli/free/` | 3 | — | 15 |
| `setup/` (setup + cleanup projects) | 3 | 5 | 5 |

So on the browser side free runs **198 cases (90 shared + 108 free)** against premium's **399
(90 shared + 309 premium)**. The 90 shared cases are the same file list for both.

### 1.2 E2E by area — premium vs free vs shared

| area | shared specs / cases | premium specs / cases | free specs / cases |
|---|---:|---:|---:|
| account | 2 / 2 | 1 / 7 | 1 / 3 |
| auth | 5 / 13 | — | — |
| command-palette | 3 / 40 | 4 / 6 | — |
| controls | — | 9 / 85 | 2 / 23 |
| dashboard | 1 / 4 | 3 / 5 | — |
| hosts | 8 / 13 | 6 / 16 | 2 / 5 |
| labels | — | 3 / 13 | — |
| packs | 1 / 5 | — | — |
| paywalls | — | — | 1 / 18 |
| policies | — | 3 / 17 | 3 / 11 |
| reports | — | 4 / 19 | 3 / 8 |
| settings | 5 / 10 | 13 / 49 | 7 / 25 |
| software | 1 / 3 | 16 / 92 | 4 / 15 |
| **total** | **26 / 90** | **62 / 309** | **23 / 108** |

Two areas are **premium-only with no free presence at all**: `labels/` (13 cases) and `command-palette`'s
premium half. `controls/` is the biggest single-tier imbalance — 85 premium cases to 23 free — but most of
that is genuinely paywalled (setup experience, disk encryption).

### 1.3 Verdict spread over the 72 premium-only specs

| verdict | specs | what it means |
|---|---:|---|
| **PAYWALLED** | 21 | genuinely premium; gating cited below. Not gaps. |
| **N/A** | 16 | depends on fleets/teams, which free does not have. |
| **FREE GAP — shared** | 12 | identical on both tiers; belongs in `shared/`. |
| **FREE GAP — free sibling** | 8 | exists on free but role set / scope / copy differs. |
| **COVERED** | 15 | a free sibling already exists; the premium extras are real tier differences. |

Counted as gap *entries* rather than files (two files contribute to both gap lists), that is
**21 gaps — 12 shared, 9 free-sibling — worth ~44 net-new free test cases**, plus five paywall-presence
checks that cost almost nothing.

---

## 2. The gap list

### 2.1 FREE GAP — shared (12)

These are tier-agnostic today. Nothing in Fleet's source branches on `isPremiumTier` for the behaviour
they assert. The move is to `tests/e2e/shared/<area>/` (or the root of `tests/api/`, or `tests/cli/shared/`).

| # | premium spec | cases | what would have to change |
|---|---|---:|---|
| **S1** | `tests/e2e/premium/controls/custom-variables.spec.ts` | 2 | **Nothing structural.** `ManageControlsPage/Variables/Variables.tsx` has exactly one `isPremiumTier` reference and it only swaps the `PageDescription` copy ("…for all fleets"). The spec never reads that description. Move the file to `tests/e2e/shared/controls/custom-variables.spec.ts`, drop "Premium •" from the describe title. Fleet's own comment in `NewLabelPage.tsx` confirms the intent: *"Custom host vitals are a Fleet Free feature"*. |
| **S2** | signed-profile case in `premium/controls/os-settings/configuration-profiles.spec.ts` | 1 | The `MDM • OS settings — configuration profile upload validation` describe already sits **outside** the scope loop (line ~108). Lift that describe into `tests/e2e/shared/controls/os-settings/profile-upload-validation.spec.ts`. Free MDM is enabled and configured on the free instance (`mdm.enabled_and_configured: true`), so the upload path is live. |
| **S3** | 500k-char case in `premium/controls/scripts/library.spec.ts` | 1 | Same shape — the `Scripts library — upload validation` describe is standalone (line ~125). Only edit: it calls `scriptsLibrary.teamDropdown.select('Unassigned')`, which `TeamDropdown.select` already no-ops on free (`components/TeamDropdown.ts:60`). Lift as-is. |
| **S4** | `tests/e2e/premium/dashboard/automations-activity.spec.ts` | 1 | The gate is `canEditActivityFeedAutomations = isGlobalAdmin && teamIdForApi === API_ALL_TEAMS_ID` (`DashboardPage.tsx:167`) — **no tier check**, and no license gate on `webhook_settings.activities_webhook` in `server/service/appconfig.go` either. Move to `shared/dashboard/`. One live confirmation worth doing first: that free's dashboard resolves `teamIdForApi` to ALL_TEAMS so the Automations action renders. Supporting evidence it does: `free/software/manage-automations-access.spec.ts` already passes the equivalent All-fleets gate on free. |
| **S5** | `tests/e2e/premium/labels/labels.spec.ts` | 8 | **The single biggest gap.** `pages/labels/` has no `PremiumFeatureMessage` and no tier gate on the Dynamic or Manual label types — the only `isPremiumTier` in the tree is the *Host vitals* type's IdP criteria (`NewLabelPage.tsx:246`), which this spec never touches. The free instance carries **23 gitops-provisioned custom labels** (verified via `GET /labels`), so `locateRow`'s paging assumption holds. Move as-is; the activity-feed matchers in `activity-copy.ts` are already tier-aware. |
| **S6** | `tests/e2e/premium/labels/sort-view.spec.ts` | 2 | Same page, read-only, no tier branch. Needs >1 label to sort, which free has (23). Move as-is. |
| **S7** | search + platform-filter cases in `premium/reports/list-filters.spec.ts` | 2 | Both seed their own reports over the API and are pure `QueriesTable` behaviour. The only premium-ism is `teamDropdown.select('All fleets')`, a no-op on free. Split the file: two cases to `shared/reports/list-filters.spec.ts`, the third (`"Inherited"`) stays premium. |
| **S8** | `Reports — SQL validation` + `Reports — new-report defaults` describes in `premium/reports/reports.spec.ts` | 2 | Both are standalone describes outside the scope loop (lines ~132 and ~193), both non-persisting, neither touches a fleet. Lift to `shared/reports/report-editor.spec.ts`. |
| **S9** | `tests/e2e/premium/settings/advanced-options.spec.ts` | 1 | The Advanced card renders on free — `OrgSettingsPage` only filters `fleet-desktop` out of the nav. The spec's `OWNED_SUBTREES` list (`smtp_settings`, `features`, `host_expiry_settings`, `server_settings`, `activity_expiry_settings`) all exist on free; the free config read confirms `features.historical_data` is present. **Caveat:** a few sub-controls inside the card are premium-gated (vulnerabilities historical reporting, hardware attestation, host-expiry extras), but the spec edits only the SMTP `domain` and compares subtrees, so it doesn't see them. Move as-is. |
| **S10** | `Vulnerabilities tab — search narrows to a single CVE` in `premium/software/vulnerabilities.spec.ts` | 1 | Plain list-search behaviour. The vulnerabilities tab exists on free (free already has 9 vulnerability cases). Move the case into `free/software/vulnerabilities.spec.ts` or lift a shared one — see the note in §5 about why a whole-file `shared/` move of this spec is a bad idea. |
| **S11** | `tests/api/premium/max-request-file-sizes.spec.ts` | 7 | **Nothing here is premium.** Every route is registered with `WithRequestBodySizeLimit` on `ue` / `mdmAnyMW` / `mdmAppleMW` in `server/service/handler.go` (lines 608, 787, 814, 824-825, 878) — none carries a license middleware, and the size middleware fires before the service-layer license check, so an oversized body is refused identically on free. The one under-limit case (`commands/run` → 404 `No hosts targeted`) is also safe: `runMDMCommandEndpoint` → `svc.RunMDMCommand` (`server/service/mdm.go:518`) has no `ErrMissingLicense` path, only MDM-configured (true on free) and host authz. Move the whole file to `tests/api/max-request-file-sizes.spec.ts`. **Confirm the `commands/run` case live on free once before merging** — it's the only one whose assertion is not a size error. |
| **S12** | `rejects --dir and --key together` + `requires one of --dir or --key` in `tests/cli/premium/generate-gitops.spec.ts` | 2 | Pure `fleetctl` argument validation, resolved client-side before any API call. Move to `tests/cli/shared/generate-gitops-args.spec.ts`. The other three cases in that file stay premium. |

**Subtotal: 30 cases.**

### 2.2 FREE GAP — free sibling (9)

The behaviour exists on free, but the role set, the scope handling or the copy differs enough that a shared
file would need a conditional. House style says: separate file.

| # | premium spec | cases | why a sibling, not a move |
|---|---|---:|---|
| **F1** | `premium/dashboard/fleet-scoped-cards.spec.ts` | ~2 | The spec's own header says it: *"free offers a single dataset and renders a plain 'Hosts online' heading, while premium renders a dataset dropdown"* (`ChartCard.tsx:147`). The card, its info icon, `Configure chart filters` and the platform filter all exist on free — the dataset **dropdown** and the `cve` dataset do not. A free sibling asserts the plain-heading shape + the filter round-trip, and doubles as a paywall check (`chartDatasetValue` must have count 0). Everything fleet-scoped in the premium spec (`fleet_id=` in the chart request, `vmsFleetId`) drops out. |
| **F2** | `premium/hosts/cta-visibility.spec.ts` | 1 | Free's sibling covers global-admin and global-observer; premium also covers **global-maintainer**, and free has that static user (`FLEET_STATIC_TOKEN_API_GLOBAL_MAINTAINER`, `static-users.ts` marks it `FREE_AND_PREMIUM`). One row added to the free spec's role list. |
| **F3** | `premium/hosts/host-delete.spec.ts` | 2 | Host delete is not premium. Two of the three cases port: bulk delete and delete-from-host-details. **The bulk one needs a different isolation strategy** — premium stages its hosts into Workstations so `selectAllOnPage` can only touch them; free has no fleet to stage into, so select-all would take a full page of the shared load fleet. A free sibling must either select rows individually or filter the list down first. Third case (team admin) is N/A. |
| **F4** | `premium/hosts/host-report-details.spec.ts` | 1 | Real gap, **but blocked by infrastructure** — see the trap in §5.4. The drill-through itself is tier-agnostic; there is nowhere on free to park the durable seeded report. |
| **F5** | `premium/labels/role-access.spec.ts` | 1 | Only the `global observer cannot add labels and can only view hosts` case ports — free has no `ws-maintainer` or `team-admin`. `canAddLabel` / `hasEditPermission` have no tier branch, so the observer assertion is identical. Put it in `free/labels/role-access.spec.ts` alongside the moved label specs. |
| **F6** | `premium/policies/sql-validation.spec.ts` | 2 | Free's sibling has 5 of premium's 7. Missing: `a macadmins extension table is treated as macOS-compatible` and `common-table-expression names are not treated as tables`. Both are pure SQL-editor compatibility logic with no tier branch. Two cases appended to the existing free spec. |
| **F7** | `Reports — live report targets` in `premium/reports/reports.spec.ts` | 1 | The premium case targets a **fleet**. Free's live-report picker offers platforms and labels instead, so the free version asserts a different target type driving the same Run-enabled/targeted-host-summary behaviour. Different enough to be its own case. |
| **F8** | `premium/settings/enroll-secrets.spec.ts` | 1 | Premium adds a secret **to the Workstations fleet**. Free has global enroll secrets only (`GET /spec/enroll_secret` → 200 on free, verified), reached through the same `Hosts page settings → Enroll secrets` gear that `free/hosts/cta-visibility.spec.ts` already asserts is visible. Same modal, different snapshot/restore helper (global spec rather than `getTeamEnrollSecrets`). |
| **F9** | `premium/software/os.spec.ts` | 3 | Free's sibling deliberately covers only 2 of premium's 5 cases. Missing: the platform filter (macOS, Windows) and the per-row `View all hosts` hand-off. `SoftwareOSPage` has no tier branch on either; the premium versions merely `teamDropdown.select('Unassigned')` first. Three cases appended to the existing free spec. |

**Subtotal: ~14 cases across 9 gap entries.** The file-level spread in §1.3 counts 8, because
`premium/reports/reports.spec.ts` contributes to both lists (two of its describes are S8, its live-report
case is F7) and is filed once, under shared.

### 2.3 PAYWALLED (21) — not gaps

Every one grounded in source, not assumption.

| premium spec(s) | gating |
|---|---|
| `controls/os-settings/disk-encryption.spec.ts` | `DiskEncryption.tsx:470` — `{isPremiumTier ? renderContent() : <PremiumFeatureMessage />}` |
| `controls/setup-experience/` ×5 (bootstrap-package, install-software, run-script, setup-assistant, users) | `SetupExperience.tsx:30` — `if (!isPremiumTier) return <PremiumFeatureMessage …>` |
| `settings/integrations/automatic-enrollment.spec.ts` | EULA lives on the ABM card (`AppleBusinessManagerSection.tsx` → `PremiumFeatureMessage`); the end-user IdP form is `EndUserAuthSection.tsx` / `IdentityProviders.tsx`, both premium |
| `settings/integrations/mdm.spec.ts` | `EndUserMigrationSection.tsx` → `PremiumFeatureMessage` |
| `settings/organization/fleet-desktop.spec.ts` | Two gates: `OrgSettingsPage.tsx:110` filters `fleet-desktop` out of the nav, and `:122` calls `handlePageError({ status: 403 })` for free on that URL. Plus `FleetDesktop.tsx:124` returns `<></>`. |
| `software/` ×10 (add-software-validation, custom-icons, display-name, edit-package, fleet-maintained-filters, library, package-scripts, script-only-package, titles-table, version-pinning) | Every Add Software path is `PremiumFeatureMessage`: `SoftwareCustomPackage.tsx:205`, `SoftwareFleetMaintained.tsx:106`, `SoftwareAppStoreVpp.tsx:227`, `SoftwareAppStoreAndroid.tsx:107`, `AddSoftwareModal.tsx:37`. The **Library tab itself** doesn't exist on free: `SoftwarePage.tsx:363` — `const navItems = isPremiumTier ? premiumSoftwareSubNav : softwareSubNav`, with a redirect at `:325`. `fleetctl generate-gitops --key software` returns `Key software not found` on free, which `cli/free/licensing.spec.ts` already asserts. |
| `cli/premium/mdm-lock-lifecycle.spec.ts`, `cli/premium/mdm-lock-wipe.spec.ts` | `canLockHost` / `canWipeHost` start at `isPremiumTier`; free's refusals are already covered by `cli/free/mdm-licensing.spec.ts` (9 cases). |

**Sub-cases inside otherwise-covered specs that are also paywalled** (so their absence from the free
sibling is correct, not a gap):

- `settings/users/*` — Observer+, Technician and GitOps roles come from `roleOptions()`
  (`userManagementHelpers.ts:73-89`) only when `isPremiumTier`; the *Specific API endpoints* selector is
  `ApiUserForm.tsx:189`. Free's siblings correctly cover Observer / Maintainer / Admin only.
- `account/my-account.spec.ts` — the Fleets section and the premium-only roles.
- `software/vulnerabilities.spec.ts` — the **exploited-vulnerabilities** filter
  (`SoftwareVulnerabilities/.../helpers.ts` — option `isDisabled: !isPremiumTier` with tooltip
  *"Available in Fleet Premium."*) and the **severity / CVSS** block
  (`SoftwareFiltersModal.tsx:122`). Also the `cvss_score` / `epss_probability` / `cve_published` columns
  (`VulnerabilitiesTableConfig.tsx:285`), whose absence `free/software/os.spec.ts` already asserts.

#### Paywall-presence tests worth adding

`free/paywalls.spec.ts` is a flat URL list + one-line assertion, so each of these is a one-row change. All
five are currently **unasserted on free**:

| what | where | why it's worth it |
|---|---|---|
| `/software/add/package`, `/software/add/fleet-maintained`, `/software/add/app-store` | new rows in `PAYWALLED_PAGES` | Ten premium specs sit behind this gate. If it ever opened by accident, nothing in the free suite would notice. Highest-value paywall row in the list. |
| Software sub-nav has no **Library** tab on free | new case near the paywall spec, or in `shared/software/titles-table.spec.ts`'s free path | `SoftwarePage.tsx:363` is the gate; nothing asserts the free shape. |
| `/settings/organization/fleet-desktop` → 403, and no Fleet Desktop nav item | new row + a nav-absence case | Note the premium spec's header says free is "redirected away" — it's actually a **403 error page**. Worth pinning. |
| Exploited-vulnerabilities option disabled with the premium tooltip | extend `free/software/vulnerabilities.spec.ts` | Cheap, and it pins the exact copy. |
| Severity / CVSS block absent from the software filters modal | extend `free/software/vulnerabilities.spec.ts` | Mirrors the existing `PREMIUM_ONLY_COLUMNS` pattern in `free/software/os.spec.ts`. |

### 2.4 N/A (16) — depends on fleets/teams

`command-palette/deep-links` · `command-palette/fleet-switcher` · `command-palette/items` (the label
collision is only reachable via Setup experience, itself premium) · `command-palette/role-access` ·
`dashboard/historical-data-collection` (the *per-fleet* switches; free's read-only half of the surface
now ships as `tests/e2e/free/dashboard/historical-data-collection.spec.ts` — see §3, rank 20) ·
`hosts/bulk-transfer` · `hosts/host-transfer-permissions` · `settings/team-host-status-webhook`
(the global webhook is already in `shared/settings/host-status-webhook.spec.ts`) · `software/no-teams-views`
· `software/role-access` · `api/role-access/premium/` ×4 · `cli/premium/fleets` ·
`cli/premium/gitops-dry-run`.

---

## 3. Ranked recommendation

Cheapest first within each value band. Sizes: **XS** = edit one existing file · **S** = move a file, rewrite
its header · **M** = new spec, small POM growth · **L** = new POM or infrastructure.

### Band A — do these

| rank | gap | size | cases | note |
|---:|---|:--:|---:|---|
| 1 | **S5** move `labels/labels.spec.ts` → `shared/labels/` | S | 8 | Biggest single win in the audit. A whole area goes from zero free coverage to full CRUD. Verified free-safe: 23 custom labels on the instance, no tier branch in `pages/labels/`. |
| 2 | **S6** move `labels/sort-view.spec.ts` → `shared/labels/` | S | 2 | Ships in the same slice as rank 1, same page object. |
| 3 | **S11** move `api/premium/max-request-file-sizes.spec.ts` → `tests/api/` | S | 7 | No browser, no fixtures, no cleanup. Seven cases for a file move. Confirm the one `commands/run` case live on free first. |
| 4 | **S1** move `controls/custom-variables.spec.ts` → `shared/controls/` | S | 2 | A spec sitting in `premium/` that has no business being there — see §6. |
| 5 | **Paywall rows for the Add Software paths** | XS | 3 | Three lines in `free/paywalls.spec.ts`. Guards the gate that ten premium specs depend on. |
| 6 | **S2 + S3** lift the two upload-validation describes → `shared/controls/` | S | 2 | Both already standalone describes. Two files, one slice. |
| 7 | **S9** move `settings/advanced-options.spec.ts` → `shared/settings/organization/` | S | 1 | One case, but it's the one guarding `enable_software_inventory` and `server_url` from a bundled-save glitch — worth having on both instances. |
| 8 | **F9** three OS-tab cases into `free/software/os.spec.ts` | XS | 3 | Append to an existing free spec; `SoftwareOsPage` already has `selectPlatform`. |
| 9 | **F6** two SQL-compatibility cases into `free/policies/sql-validation.spec.ts` | XS | 2 | Copy-paste from the premium sibling, minus the scope select. |
| 10 | **S8** lift the two standalone report-editor describes → `shared/reports/` | S | 2 | Both non-persisting. |
| 11 | **S7** split `reports/list-filters.spec.ts`, two cases → `shared/reports/` | S | 2 | Third case (`"Inherited"`) stays premium. |
| 12 | **S12** two `generate-gitops` arg cases → `tests/cli/shared/` | XS | 2 | Pure CLI arg parsing. |
| 13 | **F2** add global-maintainer to `free/hosts/cta-visibility.spec.ts` | XS | 1 | One row in an existing role list; the static user exists on free. |
| 14 | **Paywall rows: Fleet Desktop 403 + no nav item** | XS | 1–2 | Also corrects the "redirected away" claim in the premium spec header. |
| 15 | **S4** move `dashboard/automations-activity.spec.ts` → `shared/dashboard/` | S | 1 | Gate is role+scope, not tier. One live confirmation on the free dashboard first. |

**Band A total: ~39 cases, mostly file moves.** Free's browser coverage would go from 198 to ~230 cases —
roughly a 16% increase — for a day or two of work, almost none of it new test logic.

### Band B — worth doing, costs more

| rank | gap | size | cases | note |
|---:|---|:--:|---:|---|
| 16 | **F1** free sibling for the dashboard chart card | M | ~2 | Needs `DashboardPage` accessors for the free shape (plain heading) and an absence assertion for the dataset dropdown. Doubles as a paywall check. |
| 17 | **F8** free sibling for global enroll secrets | M | 1 | Needs a global enroll-secret snapshot/restore helper (`GET/POST /spec/enroll_secret`) beside the existing team one. |
| 18 | **F5** `free/labels/role-access.spec.ts` (observer only) | XS | 1 | Trivial once the label specs land (ranks 1–2). |
| 19 | **Paywall extensions in `free/software/vulnerabilities.spec.ts`** (exploited option disabled, severity block absent) | S | 2 | Needs `FilterModal` accessors for the severity block's absence. |
| 20 | **F3** free sibling for host delete | M | 2 | The bulk case needs a **new** isolation strategy — free has no fleet to stage hosts into (see §5.2). Deletes real simulated hosts from the free pool, which only the daily `tools/perf-hosts/` refresh replenishes. Budget the host cost deliberately. |
| 21 | **F7** free live-report targeting by platform/label | M | 1 | Different picker shape from premium's; genuinely a new case rather than a port. |

### Band C — real, but low value. Be honest about it.

| gap | why it's low value |
|---|---|
| **S10** `Vulnerabilities tab — search narrows to a single CVE` on free | It's one search box. Free already has nine vulnerability cases including the CVE-detail flows. The marginal risk this catches is small, and the `vulnerable=true` query it rides on is the slowest the suite issues (8–15 s per page, worse under concurrency). Adding another free case in that file costs real wall-clock. |
| **F4** host report details on free | Blocked by infrastructure, not effort — see §5.4. Not worth unblocking for one case unless someone independently wants a non-wiped scheduled report on free. |
| Arg-validation cases from `cli/premium/mdm-lock-wipe.spec.ts` (`requires the --host flag`, `unknown host identifier`) | Six of the twelve cases are arg parsing that would behave the same on free, but `cli/free/mdm-licensing.spec.ts` already proves the licence refusal on nine paths. Duplicating flag parsing across tiers buys almost nothing. |
| *Flipping* the global historical-data-collection switches on free | The switches **do** exist on free (`features.historical_data` is present in free's config, and only the *vulnerabilities* checkbox is premium-gated in `ActivityDataRetentionSection.tsx:182`). But flipping them **deletes collected history instance-wide and cannot be undone**, and free has no per-fleet scope to fall back on the way the premium spec does — so `tests/e2e/free/dashboard/historical-data-collection.spec.ts` asserts the switches' state and the chart they drive, and never writes them. The write half stays premium-only. |

---

## 4. Top five

1. **`labels/` → `shared/`** (ranks 1–2, 10 cases). An entire area with zero free coverage, no tier gate in
   the source, and a free instance already carrying 23 provisioned labels.
2. **`api/premium/max-request-file-sizes.spec.ts` → `tests/api/`** (rank 3, 7 cases). Seven cases for a file
   move; none of the seven routes carries a license middleware.
3. **`controls/custom-variables.spec.ts` → `shared/`** (rank 4, 2 cases). The clearest mis-filing in the
   tree — Fleet's own source calls custom host vitals "a Fleet Free feature".
4. **Add Software paywall rows in `free/paywalls.spec.ts`** (rank 5, 3 lines). Ten premium specs depend on
   that gate and nothing on free watches it.
5. **The three standalone validation/editor describes** (ranks 6, 10 — signed profile, oversized script,
   report SQL + defaults; 4 cases). All already live outside their scope loops; lifting them is mechanical.

---

## 5. Traps

Things that would make a naive `shared/` move fail.

### 5.1 Free has no team dropdown — but that's mostly already handled

`TeamDropdown.select()` returns early when `process.env.SUITE !== 'premium'` (`pages/components/TeamDropdown.ts:60`),
so a moved spec that calls `select('Unassigned')` is safe. What is **not** safe is `selectByLabel(...)` (used
by `dashboard/fleet-scoped-cards.spec.ts` for `'VMs'`) — that has no free branch. And `goto({ fleetId })`
with a resolved id must go, along with any `workstationsFleetId` / `vmsFleetId` fixture: `fixtures.ts:242`
**throws** if a premium-only worker fixture is requested under `SUITE=free`. Strip fixtures before moving,
don't rely on them no-op'ing.

### 5.2 Premium's isolation trick doesn't exist on free

Several premium specs get isolation by staging rows into a fleet — `hosts/host-delete.spec.ts` transfers its
hosts into Workstations so `selectAllOnPage` can only act on them, and `hosts/bulk-transfer.spec.ts` uses the
QA fleet for the same reason. On free there is nowhere to stage. A naive port of the bulk-delete case would
select-all a page of the **shared 603-host load fleet** and delete it. Any free bulk-selection spec needs its
own isolation (per-row selection, or a filter that narrows the list to this test's hosts first).

### 5.3 The premium specs enter at a scope that doesn't exist on free

Premium's read-only specs frequently enter at `'All fleets'` or `'Unassigned'`. On free there is one global
scope, and the two premium scopes render *different row sets*. Two consequences:

- `software/vulnerabilities.spec.ts`'s skipped case exists because of exactly this
  (fleetdm/fleet#50059: the `vulnerable=true` filter isn't fleet-scoped, so a title whose vulnerable version
  lives in another fleet renders `---`). That failure mode **cannot occur on free**, which is why the free
  counterpart of that assertion runs. Don't "fix" it by unifying the two.
- Report/policy visibility differs: a global report renders in a fleet list as `Inherited` on premium and has
  no analogue on free.

### 5.4 Free cannot hold a durable report

`hosts/host-report-details.spec.ts` depends on `pw-host-report-results` being **instance furniture** — a
scheduled report living on the premium VMs fleet, which `cleanup.steps.ts` never touches. On free:

- there is no fleet to park it on, and
- `cleanup.steps.ts`'s `wipe unassigned state` calls `deleteAllQueries(request)`, which is **global** on the
  Fleet API — it drains every report on the free instance at the start of *and* after every run.

So a free port would have to create the report and wait ~3.5 minutes for a real scheduled run, every
execution. That is the whole reason this one is Band C.

### 5.5 `cleanup-setup` does run on free — CLAUDE.md says otherwise

`playwright/CLAUDE.md` line 126 states *"The `free` project depends only on `free-setup`."* **That is stale.**
`playwright.config.ts` gives the `free` project `dependencies: ['free-setup', 'cleanup-setup']` and
`teardown: 'cleanup-teardown'`, the same as premium. What actually differs is one step inside the file: the
`wipe Workstations team state` test is `test.skip(process.env.SUITE === 'free', …)`. Everything in
`wipe unassigned state` — queries, global policies, packs, install-software titles, profiles, scripts,
QA test users — **runs on free**. Anyone planning a free spec around "nothing wipes this on free" is working
from a wrong premise. (The doc line should be corrected; not doing it here, this is a research-only pass.)

### 5.6 Free's role roster is three humans deep

`helpers/api/static-users.ts` marks only `global-admin`, `global-maintainer`, `global-observer` (plus the
three matching API users) as `FREE_AND_PREMIUM`. Every `ws-*`, `team-admin`, `observer-plus`, `technician`
and `gitops` static user is `PREMIUM_ONLY`. Any role-matrix spec moved to `shared/` must have a role list
that free can satisfy — otherwise `withStaticUser` fails on a missing credential, not on a product
assertion.

### 5.7 Activity-feed copy is tier-dependent, and already handled

`helpers/activity-copy.ts` reads `process.env.SUITE` for the profile suffix (`for all fleets` vs bare) and
the role-change copy. That machinery is what makes a `shared/` move of a CRUD spec viable at all — but it
means the **matcher must go through the helper**, never an inline string. A moved spec that hardcodes a
premium suffix will pass on premium and fail on free with a confusing diff.

### 5.8 Same-named describes across tiers

Several free/premium sibling pairs use the same describe titles (`upload`, `create`, `edit`, `delete`).
Splitting a premium file into a `shared/` half and a `premium/` remainder can produce two specs with
identical fully-qualified titles in the premium project. Rename on the way out.

---

## 6. Surprising things

**A spec in `premium/` with no business being there:** `tests/e2e/premium/controls/custom-variables.spec.ts`.
`ManageControlsPage/Variables/Variables.tsx` contains exactly one `isPremiumTier` reference and it changes a
sentence of page description the spec never reads. Fleet's own source comments the feature as free
("*Custom host vitals are a Fleet Free feature, so this query runs on all tiers*", `NewLabelPage.tsx:224`).
Nothing about this file is premium.

**A whole API spec file that is tier-agnostic:** `tests/api/premium/max-request-file-sizes.spec.ts`. Seven
cases, none of them behind a license check. The request-size middleware is applied at route registration and
runs before any service-layer license gate, so free rejects the same payloads with the same messages. It was
almost certainly filed under `premium/` because that's where the EULA route lives conceptually, not because
anything there is premium.

**`labels/` is an entire premium-only area with no tier gate at all.** Three specs, 13 cases, zero free
coverage — and the free instance is already provisioned with 23 labels for gitops-verify. Nobody ever wrote
the free half.

**CLAUDE.md is wrong about free's cleanup chain** (§5.5). The free project does run `cleanup-setup` and
`cleanup-teardown`; only the Workstations step skips.

**`tests/cli/` is missing from CLAUDE.md's Layout section.** It carries 54 cases across
`shared/` (16) · `premium/` (23) · `free/` (15) and follows the same tier-folder convention as `tests/e2e/`
and `tests/api/`, but the Layout list jumps from `tests/api/gitops-verify/` to `tests/loadtest/`.

**Free's MDM is fully configured** — `mdm.enabled_and_configured: true` *and*
`windows_enabled_and_configured: true`. Several "premium" assumptions about MDM-dependent surfaces
(configuration-profile upload, `commands/run`) don't hold; free's own configuration-profiles spec already
proves the point with 8 passing cases.

---

## 7. How this was verified

- **Counts:** `SUITE=premium npx playwright test --project=premium --list --reporter=json` and the free
  equivalent, flattened per file. No suite was executed.
- **Paywall calls:** read from `~/repositories/fleet/frontend` at `1f30f3ade1` — every `PAYWALLED` row above
  cites a file and line. Server-side gates read from `server/service/handler.go`, `server/service/mdm.go`
  and `server/service/appconfig.go`.
- **Live checks:** read-only `GET` against the free instance only — `/api/v1/fleet/config` (tier, features,
  MDM state), `/api/v1/fleet/labels` (23 custom labels), `/api/v1/fleet/hosts/count` (603),
  `/api/v1/fleet/spec/enroll_secret` (200). Nothing was written to either instance and no browser session
  was opened.
