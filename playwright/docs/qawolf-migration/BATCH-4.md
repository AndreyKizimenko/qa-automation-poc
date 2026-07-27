# Batch 4 — online-host / destructive / provisioning-blocked — HANDOFF & PLAN

> **Read this top-to-bottom before writing any code.** This is the entry point for the agent picking up
> Batch 4 of the QA Wolf → Fleet Playwright migration. Batches 1–3 (everything authorable *without* an online
> host) are done and in **PR #35** (`playwright/qawolf-migration`). Batch 4 is everything that was gated on
> infrastructure — and the gate is now (assumed) open: **online hosts are enrolled.**
>
> Do the work in three phases: **(1) Orient** → **(2) Verify prerequisites** → **(3) Build slices**. Do not
> skip phase 1 or 2. Everything you write must match the suite's existing standards exactly.

---

## Phase 1 — Orient (do not skip)

Working dir: `/Users/andrey/repositories/qa-automation`; the suite is under `playwright/`.

1. **Invoke and follow both project skills** (they live in `playwright/.claude/skills/`):
   - `playwright:playwright-test-author` — for writing/scaffolding specs, POMs, components, fixtures.
   - `playwright:playwright-test-reviewer` — for reviewing/auditing test code (POM, locators, isolation).
   These encode the locator priority, POM rules, and the catalogue of *legitimate* class fallbacks. Read them.

2. **Read `playwright/CLAUDE.md` end to end.** It is the canonical reference: the folder-based projects
   (`premium`/`free`/`shared`/`loadtest`/`gitops-verify`), the `workstationsFleetId` worker fixture, API helpers
   (`apiUrl`/`authHeaders`), the CRUD-serial + dashboard-activity-feed conventions, the team/scope dropdown, and
   the always-on locator/wait rules.

3. **Skim the code you'll build on:**
   - `playwright/pages/` (+ `pages/components/`) — POM style. Note `HostsListPage`, `HostDetailsPage`,
     `SoftwareTitleDetailPage`, `ReportLivePage`, `DashboardPage`, and the shared components
     (`DataTable`, `TeamDropdown`, `StatusFilter`, `LabelFilter`, `AddHostsModal`, `FileUploader`, `Toast`).
   - `playwright/fixtures.ts` — how specs get page objects; the worker fixtures (`workstationsFleetId`,
     `qaFleetId`, `firstHostId` [loadtest-only]).
   - `playwright/helpers/` — esp. `helpers/api/` (barrel `@helpers/api`): `hosts.ts` (`transferHosts`,
     `transferHostsByFilter`, `findHostWithSoftware`, `findHostByPlatform`), `config.ts` (appConfig
     save/restore), `activities.ts`, `static-users.ts`, `activity-copy.ts`, `team-scope.ts`, `auth.ts`
     (`withStaticUser`).

4. **Read the migration docs** in `playwright/docs/qawolf-migration/` (this folder):
   - `HANDOFF.md` — the top banner has live status.
   - `BATCH-3.md` — its `[→4]` / `[cut]` lists are the source of the Batch-4 backlog (per-flow grounding).
   - `MASTER.md` §6 (batch plan) + §7 (open decisions).
   - **`C1-hosts-list.md` and `C2-hosts-details.md`** — the per-flow disposition tables for the hosts area.
     Batch-4 flow numbers below reference these. Read the "POM/helper work required" and "infra gaps" sections.
   - `BATCH-1.md` / `BATCH-2.md` — for how earlier slices were grounded (don't re-derive; reuse).

5. **QA Wolf source flows** live at repo root: `flows-Free/` (52) and `flows-Premium/` (217), untracked. They
   are **coverage transcripts, not runnable code** (absent imports, `@qawolf.email` accounts, `waitForTimeout`,
   brittle selectors, inline team create/delete). Harvest **intent**; re-author in our POM style.

6. **Grounding sources (authoritative — never guess a selector or API shape):**
   - Frontend React source: `~/repositories/fleet/frontend`. Verify role/label/text/class against the
     component, not just the rendered DOM.
   - REST API: `~/repositories/fleet/docs/REST API/rest-api.md`.
   - Activity types: `~/repositories/fleet/server/service/activities/` (and `server/fleet/activities.go`).

---

## Phase 2 — Verify prerequisites (before building anything host-dependent)

Batch 4 was blocked on infrastructure. **Confirm each of these is actually true on the instance now — do not
assume.** If one isn't ready, that group of specs stays blocked; do the groups that are unblocked.

- [x] **Online hosts enrolled and reporting — DONE (2026-07-27).** A persistent **osquery-perf** load fleet
      runs on a MacStadium macOS VM (`launchd` daemons; source + setup in `tools/perf-hosts/`), keeping
      **~300 online hosts on premium and ~268 on free**, split ~100/100/100 across macOS 14.1.2 / Windows 11 /
      Ubuntu 22.04, refreshed continuously. `host_expiry` = 1 day sweeps offline leftovers. Confirm current
      state anytime: `GET /api/v1/fleet/hosts?status=online`.
      - **CRITICAL — these are osquery-perf *simulations*, not real/MDM hosts.** They DO respond to
        distributed/live queries and report software inventory, so they unblock: host-live-query,
        run-existing-query, refetch, host-reports-tab (cached results), and give real online hosts to
        transfer. They are **NOT MDM-enrolled** (`mdm enrolls: 0`), so **lock/wipe stay blocked** (need a real
        MDM-enrolled host). They ARE effectively the **disposable pool** for delete/bulk-delete — see below.
      - They live where osquery-perf enrolls them: **premium hosts land in "No team"/Unassigned by default**
        (osquery-perf doesn't set a team), NOT the QA fleet. So the "durable host in the QA fleet" note below
        needs rethinking — either transfer some sims into the QA fleet as a fixture precondition, or resolve
        the live host by API from Unassigned each run. Decide when building the fixture.
- [x] **Real VMs added — DONE (2026-07-27).** Alongside the sim fleet, both instances now carry **three real
      VMs** each (macOS 26.6 / Ubuntu 26.04 / Windows 11 24H2, osquery 5.23.1, fleetd 1.58.0). Premium keeps
      them in a dedicated **"VMs" fleet (id 103)**; free has no fleets so they sit in no-team among the sims.
      The macOS and Windows VMs are **MDM-enrolled** ("On (manual)"); the Linux ones aren't.

### Host-selection policy (applies to every spec in this batch)

Two populations share each instance. Pick by what the test actually needs:

| Need | Population | How to resolve |
|---|---|---|
| Genuine device behaviour — live-query results, real users/agent versions, MDM-gated features, scripts | **real VM** | `liveMacosHost` fixture, or `findOnlineHost(request, platform, { kind: 'real' })` |
| Volume — bulk select / transfer / delete, where the individual host is incidental | **simulated** | `findSimulatedHostIds(request, platform, n)` |

Implemented via Fleet's documented `mdm_enrollment_status` filter (`enrolled` = the real macOS/Windows VMs,
`unenrolled` = the sims) — the only discriminator that works on **both** tiers, since free has no fleets to
scope by. **Never destroy a real VM**: there are only three per tier and no re-provisioning path.

> ⚠️ **The real Linux VMs are not MDM-enrolled, so they fall inside the `'simulated'` set.** Destructive specs
> must target **`darwin` or `windows`**, never `linux`, or they risk deleting a real VM.

Why it matters beyond convenience: the sims are actively unfaithful. They ignore live-query SQL (answering any
query with one canned dpkg row), return no rows ~20% of the time, and match **contradictory labels** — a single
darwin sim is simultaneously in "Fedora Linux", "MS Windows", "All Linux" and "chrome". Any spec asserting on
query results, label membership, or MDM state must use a real VM.
- [x] **A committed live-host worker fixture — DONE (2026-07-27).** `liveMacosHost` (worker-scoped, in
      `fixtures.ts`) returns a `HostRef` for an online macOS host, resolved via the new
      `findOnlineHost(request, platform, requirements)` in `helpers/api/hosts.ts`. Fails loud (naming
      `tools/perf-hosts/`) when no macOS host is online.
      - **The parked stash (`stash@{0}`) was reviewed and only partly reusable.** Its premise — resolve a
        *named* durable VM via `findOnlineHostByName(request, 'MacOS 26')` — is **dead**: the sim fleet's hosts
        get **random 12-char display names** (`_0DKvbg2kgOu`) and fresh ids on every daemon restart. Resolution
        is therefore by **platform + `status=online`**, never by name or a pinned id. Its `refetch()` and
        Actions-menu ideas were re-authored (see below); its `TeamDropdown.selectByLabel` QA-fleet escape hatch
        is **not needed** — the sims live in Unassigned, so no fleet scoping applies. Nothing was committed from
        the stash directly; leave it parked (its `runSavedScript` / `expectPolicyStatus` are still useful for a
        future run-script / CIS slice).
      - **The C2 "durable host in the QA fleet" constraint no longer applies.** It existed to dodge
        `cleanup.steps.ts`; the sims are in Unassigned and cleanup doesn't touch *hosts*, only content. Specs
        still self-provision + self-clean their own reports.
      - **Sim vitals vary per host** — a spec must request what it asserts on via `requirements`:
        `withUsers` (only ~50–75% of sims have populated "Local user accounts"; the `users` detail query has a
        50% simulated failure rate per cycle) and `withOrbit` (the sim fleet is a **mix** of fleetd hosts
        reporting `orbit_version` and vanilla-osquery hosts reporting none — the Agent tooltip only renders for
        the former).
- [x] **`team-admin` static user provisioned — DONE (2026-07-27).** `team-admin@fleetdm.com` ("QA Static Team
      Admin"), **admin on both Workstations and VMs**, using the shared `FLEET_STATIC_USER_PASSWORD`. The
      catalog's old placeholder `ws-admin` (`ws-admin@fleetdm.com`, Workstations only) never existed on the
      instance and was renamed to `team-admin` to match. Reach it with
      `withStaticUser(browser, 'team-admin', …)`.
      - **Gotcha when provisioning any static user:** a user created by an admin comes back with
        `force_password_reset: true`, and Fleet then bounces every login to `/login/reset` — which in a spec
        looks exactly like a wrong password. `PATCH /users/:id` will **not** clear the flag; the only route is
        `POST /perform_required_password_reset` as that user, which rejects reusing the old password. Clearing
        it therefore takes two hops: reset to a throwaway password, then `POST /change_password` back to the
        shared one. Done for this account; check `force_password_reset` is `false` for any future one.
- [~] **Disposable-host decision (destructive tests) — partly resolved by the sim pool.**
      - **delete / bulk-delete:** the osquery-perf fleet IS a disposable, self-regenerating pool, so deleting a
        handful of sim hosts is now safe (they're fake and plentiful; host_expiry + the load fleet backfill).
        **Verify osquery-perf's behavior when its host is deleted** (it keeps checking in with the old node key
        → it may re-enroll as a new host or error) before relying on exact count assertions. Prefer deleting a
        small, clearly-identified subset and asserting *those* are gone, not brittle total-count arithmetic.
      - **lock / wipe:** still blocked — the sims aren't MDM-enrolled. Needs osquery-perf started with MDM
        flags, or a real MDM-enrolled disposable host. Keep CUT for now, or cover as API-level role checks.
- [ ] **Creds present** for whatever you run: `playwright/.env.{premium,free}` (`FLEET_URL`, `FLEET_API_TOKEN`,
      `FLEET_STATIC_USER_PASSWORD`, static-user tokens). Every var in `.env.<project>.example` is required.

---

## Phase 3 — The Batch-4 work plan

Order suggestion: **Group A (non-destructive host reads/execution) → Group B (reversible transfer) → Group D
(provisioning-unblocked) → Group E (reassign) → Group C (destructive, only if unblocked).** Ship each slice as
a small, `npm run check`-clean, live-verified, committed chunk — same cadence as Batches 2–3.

### Group A — host-details reads & execution (needs an online host; non-destructive)
Reference `C2-hosts-details.md`. Land under `tests/e2e/{premium,free}/hosts/`. Reuse the `liveMacosHost`
fixture; self-provision + self-clean any reports/queries/software the spec needs.
- [x] **`host-details-smoke`** (C2 #7/#10/#17/#19/#22) — **DONE**, landed **shared** rather than per-tier:
  `tests/e2e/shared/hosts/host-details-smoke.spec.ts`. All three concerns behave identically on both tiers
  (the "premium-only" Agent tooltip was an accident of QA Wolf's coverage — the feature and the sim mix exist
  on free too), so per the Batch-3 convention (tier-agnostic-identical → `shared/`) it's one file, 3 tests:
  - **Refetch** → header reads "Last fetched less than a minute ago" (60s budget). Asserted on
    `.host-header__last-fetched` with `toContainText` — the nested tooltip injects a `<style>` block and an
    absolute timestamp into that element's text, so `toHaveText` would fail. Backed by an
    `expect.poll` on the API's `detail_updated_at` (new `getHostDetailUpdatedAt`) so a background detail
    cycle that already read "less than a minute ago" can't make the assertion pass vacuously.
  - **Local user accounts** card search → filters to 1 row. Scoped to `.local-user-accounts-card`: the
    Details tab renders a **second table** (host certificates) that an unscoped table locator also matches.
    The search token is picked as a username no other username contains (the card filters by substring).
  - **Agent tooltip** → hover the tooltip wrapper inside the Agent `DataSet` value; asserts the
    `role="tooltip"` text matches the API's `osquery_version` / `orbit_version`.
  Live-verified green on **premium + free**.
- [x] **`host-live-query`** (C2 #1/#3/#8/#11/#13/#20) — **DONE**, landed **shared**:
  `tests/e2e/shared/hosts/host-live-query.spec.ts`. Seeds a uniquely-named report via the API, then walks
  Actions → Live report → "Select a report" → the report's **edit** screen (`/reports/:id/edit?host_id=N` —
  the modal does *not* go straight to `/live`) → "Live report" → Select targets (host pre-selected, asserted)
  → Run → "Report finished" + "1 host targeted" + "100% responded". Reuses the existing
  `ReportEditPage.clickLiveReport()`; `ReportLivePage` extended to the run screen.
  - **Do not assert a specific result row or value here.** The sims **ignore the SQL** and answer any live
    query with a fixed canned row, and return **no rows at all ~20%** of the time
    (`--live_query_no_results_prob`, default 0.2, not overridden in the perf plists). So QA Wolf's
    "1 result / value `bar`" assertions are unportable; the spec asserts the run *completed* and the host
    *responded*, and accepts either terminal results state via `.or(noResultsState)`. Verified stable over
    5 repeats (20/20 executions green). **If we want a row-level assertion**, add
    `--live_query_no_results_prob 0` to `tools/perf-hosts/com.fleetqa.perf.{premium,free}.plist` and
    re-run `install.sh` on the VM — then the results row becomes deterministic.
  - Copy drift: the modal's authoring link reads **"create a report"** (QA Wolf said "create your own
    report"). The "Select a report" modal has a dedicated `.select-report-modal` class.
  - **Role dimension not folded in** (C2 open question #3 still open): admin-vs-maintainer "can run" is left
    for either a `withStaticUser` loop here or `tests/api/role-access/`. Not blocked — just undecided.
  Live-verified green on **premium + free**.
- [x] **`host-reports-tab`** (C2 #5/#15/#23) — **DONE**, landed **shared**:
  `tests/e2e/shared/hosts/host-reports-tab.spec.ts`. Seeds two uniquely-named reports, then asserts the count,
  the "don't store results" toggle default, name search, and **Name A-Z / Z-A reordering** (`?sort=name_asc`
  / `name_desc`).
  - **C2's "precondition-heavy" premise was wrong.** Reports appear on the tab as soon as they *apply* to the
    host — **no cached result needed**; one without results renders "Fleet is awaiting results from `<host>`".
    So no gitops reports, no scheduled-query wait.
  - **Isolation matters here:** other specs seed **global** reports, which apply to this host too, so the
    unfiltered list and count are shared mutable state. Every assertion is made against the test's own two
    reports by first searching its marker; the count is only asserted to match `/\d+ reports?/`.
  - Grounding: card name is an **`h3`** (`getByRole('heading', { level: 3 })` — no class needed); the sort
    trigger is `.host-reports-tab__sort-dropdown .react-select__control` (**not** the card Actions menu's
    `.actions-dropdown-select__control` — mixing those up hangs the click until the test times out); options
    carry `data-testid="dropdown-option"`; the toggle is a `role="switch"` with **no accessible name** (its
    label is a sibling span) → read `aria-checked`.
  Live-verified green on **premium + free**.
- [ ] **`host-report-details`** (C2 #24 — the only Group A item left): report-card Actions → **Show details** →
  this host's report-results page (perf-impact + "View data for all hosts"). **Still gated on a stored result:**
  `HostReportCard.tsx` gates that action on `report.last_fetched !== null`, and with none the card offers only
  "View report for all hosts". Getting one needs a report with an `interval` whose scheduled run the host
  actually submits. **Unresolved constraint:** `cleanup-setup` wipes global reports at the start of every run,
  so such a report can't be pre-seeded out of band — it must be created inside the test and waited on, bounded
  by osquery-perf's config interval + the query interval (the sims poll queries every 10s per
  `--query_interval` in the perf plists, but an end-to-end cached-result timing was **not** confirmed — an
  attempt was wiped by `cleanup-setup` mid-experiment). Measure that wait before committing to a UI spec.

### Group B — host↔team transfer (reversible via API; mind parallel workers)
Reference `C1-hosts-list.md`. **No team create/delete in bodies** — rework to Unassigned↔Workstations using the
existing `transferHosts` / `transferHostsByFilter` helpers (`helpers/api/hosts.ts`) for preconditions AND
guaranteed restore in teardown. Transferring shared hosts changes their scope for other specs mid-run, so
restore reliably and consider whether these should run less-parallel.
- [x] **`bulk-transfer`** (C1 #10/#12/#25 + #13 salvage) — **DONE**:
  `tests/e2e/premium/hosts/bulk-transfer.spec.ts`. Three tests: staged bulk transfer to Unassigned (toast +
  API-verified), the searchable fleet dropdown narrowing to one match, and the
  "Select all matching hosts" affordance appearing on a full page but not on a small fleet.
  - Staged into the **QA** fleet (not Workstations): least-trafficked, and cleanup doesn't touch it. The
    staging *is* the safety property — the fleet holds only this test's hosts, so select-all can't over-reach.
  - **"Select all matching hosts" is only ever observed, never clicked.** It widens the selection to every
    matching host, which on Unassigned is the whole load fleet sibling specs are reading.
  - It only renders when **≥ one page (50)** of rows is selected (`DataTable.tsx` `shouldRenderToggleAllPages`),
    which is why the small-fleet case asserts its *absence* rather than a filter-based unhappy path.
  - Copy drift: the modal's link reads **"Add a fleet"** (QA Wolf said "Create a fleet"), and its submit stays
    disabled until a destination is picked.
- [x] **`host-transfer-permissions`** (C1 #20/#22) — **DONE**:
  `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts`. Global admin and global maintainer each
  transfer a host via host details Actions → Transfer, verified by API and by the host's "Fleet" vital.
  Uses **Windows** simulations so its pool can't overlap bulk-transfer's macOS one.
  **C1 #27 (team admin must NOT see Transfer) remains blocked** on the unprovisioned `ws-admin` user.

### Group C — host deletion (DONE; simulated hosts only)
- [x] **`host-delete`** (C1 #11, C2 #12) — **DONE**: `tests/e2e/premium/hosts/host-delete.spec.ts` (one file,
  two describes: bulk from the list, and single from host details — the C1 table proposed `bulk-delete.spec.ts`
  before the details case was unblocked). Bulk stages into **Workstations** (the transfer specs use QA) so
  select-all can only reach this test's hosts. Assertions are on **host ids** via `hostExists`, never total
  counts and never display names.
- ⚠️ **Measured cost — the pool does not self-heal.** The earlier assumption that the load fleet backfills a
  deleted host is **wrong**: osquery-perf's `enroll()` runs once at agent start and has **no node-invalid
  recovery**, so a deleted sim just keeps posting a dead node key and never comes back. Verified live — a host
  deleted at 22:16 had not returned 3 minutes later, and the online count stayed down.
  - **The pool is repopulated by the scheduled daily refresh** in `tools/perf-hosts/`, so the budget is
    per-day rather than per-run. Agreed ceiling: **delete at most ~5 hosts per run.** This file currently
    deletes **4** (2 bulk + 1 from details + 1 team-admin); anything added must stay inside that.
  - Fleet's own delete modal says hosts "will re-appear unless Fleet's agent is uninstalled" — true of real
    fleetd, **not** of osquery-perf. Don't trust that copy for the sim fleet.
- [x] **`team-admin` delete** (C1 #26) — a team admin can delete a host on a fleet they administer
  (`canDeleteHost` admits team admins). Stages into **VMs** rather than Workstations, since the bulk case
  stages there and the two run in parallel.

### Group D — provisioning-unblocked (moved here from Batches 2 & 3)
- [x] **`settings/advanced-options`** (moved from Batch 2) — **DONE**:
  `tests/e2e/premium/settings/advanced-options.spec.ts`. Reframed around the actual risk: the bundled
  `performSave` posts host-lifecycle, activity-retention, features and server-authentication together, so the
  spec edits the card's most inert field (**SMTP `domain`** — SMTP is deliberately unconfigured on QA) and
  asserts every neighbouring subtree survives byte-identical, naming software-inventory and the server URL.
  Never touches `host_expiry_settings`.
  - **Restore only the edited field.** Patching whole snapshotted subtrees back **400s** — they carry
    read-only members such as `smtp_settings.configured`. A neighbour that *does* change is a real Fleet bug
    and should fail the assertion, not be quietly repaired.
  - Fixed a stale readiness anchor in `OrganizationAdvancedPage`: it waited on an "Advanced options" heading
    the page no longer renders (it opens straight into its sections; **"Host lifecycle"** is the first).
    Nothing had used the POM, so this was invisible until now.
- [x] **`labels` team-admin variant** (moved from Batch 2; C9) — **DONE**, folded into the existing
  `tests/e2e/premium/labels/role-access.spec.ts` as a third case. A team admin **can** add labels but
  **cannot** edit a global one — the same outcome as the team maintainer, but through a different branch of
  each gate (`canAddLabel` via `isAnyTeamMaintainerOrTeamAdmin`; `hasEditPermission` omits team roles), so the
  two can regress independently.
- [ ] **`settings/team-host-status-webhook`** (C1 #16) — **now unblocked** by the team-admin user; not yet
  built. Team-level host-status webhook (`teamHostStatusWebhookEnabled` / `…DestinationUrl` / percentage /
  window) → Save → "Successfully updated settings." → persists across reload. Plus the host-expiry trio:
  hover "Enable host expiry" → tooltip, help text "Host expiry is globally enabled in organization
  settings…", and a **disabled** expiry input. That last group needs host expiry enabled globally — it is
  (`host_expiry` = 1 day, set for the load fleet), so the precondition holds. Needs a team-settings POM plus
  an API snapshot/restore of the fleet's webhook config. (The **global** host-status webhook already shipped
  in Batch 3: `tests/e2e/shared/settings/host-status-webhook.spec.ts`.)

### Group E — reassign
- [x] **`dashboard/automations-activity`** (C1 #8 — mis-filed under hosts) — **DONE**:
  `tests/e2e/premium/dashboard/automations-activity.spec.ts`. Enable → edit → disable the activity webhook,
  each verb landing in the very feed the modal configures. Adds `activityCopy.activityAutomations` matchers
  plus a case in the `tests/api/activity-copy.spec.ts` gate, and an `ActivitiesWebhook` config interface.
  - **The API check between UI steps is load-bearing.** Closing the modal doesn't mean the PATCH landed;
    reopening immediately can load pre-save config, and the next save then writes that stale value back,
    silently undoing the edit. Don't remove those assertions as redundant.
  - `PATCH /config` merges **within** `webhook_settings` (verified — sibling webhooks survive a restore that
    sends only `activities_webhook`). This is the **opposite** of `PATCH /teams/:id`, which replaces the
    subtree wholesale.
  - There is one global activity webhook, so the test can't run beside a copy of itself (`--repeat-each` with
    parallel workers fails it). Sibling appConfig specs are fine — they restore only their own subtree.
  - Modal gotcha: `.activity-feed-automations-modal` is on **both** the container and its inner form div, so
    the container is pinned with `.modal__modal_container` too.

---

---

## Deferred indefinitely — destructive MDM actions (Lock / Wipe)

**Not part of the Batch-4 delivery. Do not author these without an explicit decision to take them on.**
Parked here so the coverage gap stays visible rather than being silently dropped.

Flows: **C2 #18 `lock-via-host-details`** (Actions → Lock → "I wish to lock `<host>`" checkbox → Lock →
"LOCK PENDING" + toast + "locked this host" activity) and **C2 #25 `wipe-via-host-details`** (Actions → Wipe →
"I wish to wipe" → "WIPE PENDING"/"WIPED" + script activity).

Why they stay parked even though they are now *technically* possible:

- They are **genuinely destructive and effectively one-shot.** The real macOS/Windows VMs are now MDM-enrolled,
  so Fleet would really lock or wipe them. There are only three VMs per tier and **no re-provisioning
  automation** — a wipe ends every other real-device spec in this batch until someone rebuilds the VM by hand.
- Unlocking needs the recovery PIN Fleet surfaces after a lock, so even the "reversible" one is a manual
  recovery chore, not an API teardown.
- They must **never** be pointed at the simulated fleet as a workaround: sims aren't MDM-enrolled, so the
  actions aren't even offered (verified live — a sim's Actions menu shows only Transfer / Live report /
  Run script / Delete).

If they are ever taken on, the prerequisite is a **dedicated sacrificial MDM-enrolled VM** with a scripted
re-enroll, kept out of `liveMacosHost`'s resolution (e.g. its own fleet on premium, and on free some signal
other than MDM enrollment, which no longer discriminates once a second enrolled host exists).

Cheaper partial coverage available today, if the risk is unacceptable but the gap matters: assert the
**permission surface** rather than the effect — that Lock/Wipe appear in the Actions menu for an admin on an
MDM-enrolled host and are absent for an observer — plus API-level role checks in `tests/api/role-access/`.
That covers the RBAC regression risk without ever firing the command.

---

## How we work (always-on — full detail in CLAUDE.md + the skills)

- **Ground every selector** in `~/repositories/fleet/frontend`; QA Wolf selectors are stale hints. Priority:
  `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > documented `.class` **with an inline comment**.
- **Probe stateful UI live before asserting.** This session repeatedly found source-only reads insufficient for
  stateful modals/defaults (e.g. the "Edit package" modal only exists as multi-package on premium; the
  "User email" column is hidden by default). When a flow has conditional rendering, confirm with the Playwright
  MCP or a first live run rather than trusting a static read.
- **No** `waitForTimeout`, `networkidle`, `toHaveScreenshot`, or team create/delete in test bodies.
- **Tiers are explicit** (`free/` + `premium/`); `shared/` only for genuinely tier-agnostic behavior (a shared
  spec runs under both projects; `teamDropdown.select` is a no-op on free). A new concern on an existing spec =
  a separate `describe` in that spec.
- **Global-config specs**: snapshot the touched subtree in `beforeEach` via `getAppConfig`, restore in
  `afterEach` via `patchAppConfig` (PATCH `/config` merges). Verify instance state after; confirm the restore
  endpoint.
- **Isolation**: clean up by the test's **own unique name**, never a shared marker (parallel workers delete
  each other's data otherwise). `saveX()` methods wait for the modal to close; verify persistence via the
  **API**, not a stale UI reopen.
- **Cookie-less context** for Bearer-token checks that must dodge the admin session cookie:
  `playwright.request.newContext({ baseURL: process.env.FLEET_URL, ignoreHTTPSErrors: true })`.
- **Role-based specs**: `withStaticUser(browser, key, async (page) => { const pom = new SomePage(page); … })` —
  construct the POM manually inside the callback (the fixture `page` is the admin session). See
  `premium/hosts/cta-visibility.spec.ts` and `premium/software/manage-automations-access.spec.ts`.
  - **Logins are a shared, rate-limited resource.** Fleet throttles `POST /login` to **10/min, burst 9, in one
    bucket shared by every user and every parallel worker** (`server/service/handler.go`; measured — the 11th
    login in a minute returns 429). A throttled login silently leaves the browser on `/login` with no error
    message, which reads like a bad password. `withStaticUser` therefore caches each user's `storageState`
    under `.auth/static-<suite>-<key>.json` and reuses it (falling back to a fresh login if the session went
    stale), and `loginAsAdmin` retries. **Don't reintroduce a per-test login** — adding a handful of role
    specs that each log in is enough to starve the rest of the suite.
- **`pageHealth`** is auto-applied (asserts no console/5xx errors at teardown); `pageHealth.disable()` only for
  known-benign 4xx noise (e.g. a host-target search), with a comment.

### Recurring frontend gotchas (learned the hard way — will bite host specs too)
- Fleet **Radio** hides the real `<input>` → click the associated `<label>`, not the radio.
- Fleet **Checkbox** exposes `role="checkbox"` whose **accessible name is the `name` prop**, not the visible
  label; read state via `aria-checked`. Fleet **Slider** is `role="switch"` with **no** accessible name; read
  `aria-checked`.
- **Tooltip-wrapped `InputField` labels** are usually still `htmlFor`-associated (getByLabel works), but some
  are unassociated → target by placeholder or the `name`/`id` attr. When invalid, `FormField` swaps the label
  text for the error message — don't re-locate a field by label after invalidating it.
- **DropdownWrapper** options carry `data-testid="dropdown-option"`; the **row `ActionsDropdown`** options match
  by **text** (no testid) and portal to `<body>`, revealing on row hover.
- **Icon-only buttons** have no text/aria-label → target the child icon's `data-testid` (Fleet's `Icon` emits
  `<name>-icon`, e.g. `trash-icon`) or a documented BEM class.
- Tables with **react-query `keepPreviousData`** show stale rows during refetch → use retrying web-first
  locators (`rows.filter({ hasNotText: token }).toHaveCount(0)`), never a one-shot read. Some lists are
  **client-side paginated** (labels 20/page) and sort **case-sensitively** (UTF-16 code-unit).
- **Fleet's `Modal` has no `role="dialog"`** → scope by `.modal__modal_container` filtered on the visible title
  text, or a dedicated modal class.
- **Button/label drift** is common (e.g. "Automations" not "Manage automations"; "Enroll secrets" not "Manage
  enroll secrets") — trust the source over QA Wolf.

### Validation & commit workflow
1. `npm run check` from `playwright/` (tsc + eslint) — must be **0 errors**. Baseline is **14 pre-existing
   warnings** (12 `no-explicit-any` in `gitops-yaml.ts`, 2 accepted `no-force-option`); don't add new ones.
2. Live-run the slice: `npm run test:premium -- --reporter=list --output=<scratch> <path>` (and `test:free`
   for `shared/` specs). Target one test with `-g "<title>"`. The setup/cleanup projects run automatically.
   - **Background-run gotcha:** a backgrounded `npm` command starts from the repo root — always prefix
     `cd /Users/andrey/repositories/qa-automation/playwright && …` in backgrounded runs, or it fails with
     "no package.json".
3. Commit green work to the branch in logical chunks. End commit messages with
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Update this doc's checklist as you go.

### Branch / PR strategy
Batches 1–3 are in **PR #35** (`playwright/qawolf-migration`). **After #35 merges to `main`**, branch fresh
off `main` (e.g. `playwright/qawolf-migration-batch4`) and open a new PR for Batch 4. If #35 hasn't merged yet,
coordinate with the lead before deciding whether to stack on it. Leave the pre-existing untracked/modified
items alone (`CLAUDE.md`, `flows-*/`, `docs/run-reviews/` — not ours).

---

## Where this leaves the migration
After Batch 4, the QA Wolf intake is essentially exhausted: ~40% of the ~228 portable flows are already covered
(Batches 1–3), and Batch 4 is the remaining host-execution / destructive / team-admin surface. The per-area
disposition tables (`C1`–`C10`) plus `MASTER.md` are the source of truth for anything not spelled out here;
resume from them, don't re-derive.
