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

- [ ] **Online host(s) enrolled and reporting.** Check via the API with a cookie-less/admin request:
      `GET /api/v1/fleet/hosts?status=online` (use `apiUrl('hosts')` + `authHeaders()`). Note how many, and
      which **platforms** (macOS/Windows/Linux). The roadmap target is a **macOS 26 VM** (see the
      `project_host_tests` memory) plus ideally Windows/Linux for cross-platform reads.
- [ ] **A committed live-host worker fixture.** There is **no committed e2e live-host fixture** — `firstHostId`
      is loadtest-only. A `liveMacosHost` fixture + host-Actions POM methods were **prototyped and parked in a
      git stash**: `git stash@{0}: "CIS host-tests WIP parked 2026-06-28"`. **Review it before reusing**
      (`git stash show -p stash@{0}`) — it may be stale. Also check whether any host-test foundation was
      *committed* since (the `project_host_tests` memory mentions a CIS policy↔script hero spec); reconcile the
      stash against `git log` and current `pages/hosts/*`. Build/commit the fixture as the first Batch-4 step.
      **Key constraint (from C2):** on premium the durable host should live in the **QA fleet** (resolve via the
      existing `qaFleetId` worker fixture) — `cleanup.steps.ts` wipes Unassigned/Workstations/global but **not**
      the QA fleet. On free the host is no-team, and its reports/software get wiped by cleanup, so free
      host-data specs must self-provision + self-clean.
- [ ] **`team-admin` static user provisioned.** Needed for every team-admin flow. Catalog entries `ws-admin` /
      `api-ws-admin` exist in `helpers/api/static-users.ts` (Workstations-scoped admin) but were **not
      provisioned on the instance**. Provision (POST `/users/admin` with a fleets-scoped `admin` assignment;
      password from `FLEET_STATIC_USER_PASSWORD`) and confirm `withStaticUser(browser, 'ws-admin', …)` logs in.
      Until then, the team-admin flows below stay blocked.
- [ ] **Disposable-host decision (destructive tests).** delete / lock / wipe / bulk-delete **irreversibly
      remove or mutate hosts** with no re-enroll path, and would break every other host spec by destroying the
      shared host. **Do NOT run these against the sole live host.** Decide with the lead: a disposable/
      re-enrollable pool (and for lock/wipe, an MDM-enrolled disposable host)? Reframe as API-level role checks?
      Or keep CUT? **Do not author destructive UI specs until this is resolved.**
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
- **`host-details-smoke`** (C2 #7/#10/#17/#19/#22): **Refetch** vitals → "Last fetched less than a minute ago"
  (the online-only part); Local-user-accounts card search; premium: hover Agent underline → osquery/Orbit
  tooltip. `HostDetailsPage.refetchButton` exists; add a `refetch()` that clicks and waits out the
  "Fetching fresh vitals…" state (prototyped in the stash).
- **`host-live-query`** (C2 #1/#3/#8/#11/#13/#20): Actions → Live report → "Select a report" modal →
  pick a saved report → Run → "Report finished" with a result row. De-stale `ReportLivePage` for the
  completed-run screen. Role dimension (admin + maintainer both allowed) via `withStaticUser`, or defer to
  `tests/api/role-access/`.
- **`host-reports-tab`** (C2 #5/#15/#23/#24): Reports tab renders cards/count/sort/search; premium adds
  sort A-Z/Z-A ordering + report-card Actions → Show details → report-results page. **Precondition-heavy:**
  cards only appear once a saved query has a **cached result** for the host (needs a real run or a
  short-interval scheduled query). Premium can lean on QA-fleet gitops reports; free must run one itself.

### Group B — host↔team transfer (reversible via API; mind parallel workers)
Reference `C1-hosts-list.md`. **No team create/delete in bodies** — rework to Unassigned↔Workstations using the
existing `transferHosts` / `transferHostsByFilter` helpers (`helpers/api/hosts.ts`) for preconditions AND
guaranteed restore in teardown. Transferring shared hosts changes their scope for other specs mid-run, so
restore reliably and consider whether these should run less-parallel.
- **`bulk-transfer`** (C1 #10/#12/#25): header select-all → "Select all matching hosts" → transfer; team
  typeahead in the transfer modal; unhappy-path (filter applied → "Select all matching" hidden). Also assert
  the "Create a fleet" link is present (salvage of the CUT #13). Needs a reusable transfer-modal component.
- **`host-transfer-permissions`** (C1 #20/#22/#27): single-host transfer (host details Actions → Transfer) by
  role — admin/maintainer can; **team-admin can't (#27, needs the `ws-admin`/team-admin user)**.

### Group C — destructive (BLOCKED until the disposable-host decision; see Phase 2)
Do not author against the live host. Reference C1 #11 (`bulk-delete`) and C2 #2/#4/#12/#14/#18/#25
(delete/lock/wipe). Lock/wipe additionally need an MDM-enrolled disposable host. If never unblocked, keep CUT
or reduce to API-level role-permission checks in `tests/api/role-access/`.

### Group D — provisioning-unblocked (moved here from Batches 2 & 3)
- **`settings/advanced-options`** (moved from Batch 2): the Advanced card's `performSave` bundles
  `scripts_disabled`, `host_expiry`, software-inventory, smtp, sso, etc. into ONE payload — a formData glitch
  could reset fields other specs depend on. Do it with a **full appConfig snapshot/restore** (get the whole
  `/config`, restore it verbatim in `afterEach`), pick a genuinely innocuous field, and **avoid `host_expiry`
  (can delete hosts)**. Run it away from the parallel suite if possible. Verify instance state after.
- **`labels` team-admin variants** (moved from Batch 2; C9): maintainer own-only / observer view-only /
  team-admin cases — needs the team-admin user. `LabelsPage` already has the row-action + filter-pill plumbing.
- **`settings/team-host-status-webhook`** (C1 #16): team-level host-status webhook + host-expiry
  tooltip/help/disabled-input — needs the team-admin user. (The **global** host-status webhook already shipped
  in Batch 3: `tests/e2e/shared/settings/host-status-webhook.spec.ts`.)

### Group E — reassign
- **`dashboard/automations-activity`** (C1 #8 — mis-filed under hosts): the **dashboard** "Automations" modal
  (enable/disable/edit activity-feed automations) + activity-feed assertions. Land under
  `tests/e2e/premium/dashboard/`. Reuse `dashboard.expectActivities([...])`; ground the activity copy in
  `GlobalActivityItem.tsx` and add matchers to `helpers/activity-copy.ts` (with a case in
  `tests/api/activity-copy.spec.ts`, the gate).

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
