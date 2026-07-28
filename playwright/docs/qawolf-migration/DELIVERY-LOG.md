# Delivery log

What shipped, in order, and the decisions behind each batch. Consolidates the four per-batch trackers and the
original batch plan. Per-slice grounding now lives in the **spec headers** — that's deliberate, and it's where
to look first. Superseded originals (`BRIEF.md`, `MASTER.md`, `HANDOFF.md`, `BATCH-1..4.md`) remain in git
history if you need the raw trackers.

Batches were ordered by **dependency**, not by area: cheap coverage capture first, the big page-object
investment next, and everything gated on infrastructure last.

---

## Batch 1 — dedupe + augment · PR #35

~20 duplicate flows confirmed and dropped with no code written, plus **18 augments** grafted onto existing
specs as separate `describe` blocks.

Shipped: signed-out→`/login` redirect · forgot-password reset form · script download-matches-source (both
tiers) · >500k-char script rejection · invalid-SQL report still saves · new-report default state · vulnerability
search-narrows-to-one-CVE · exploited-vulnerabilities filter · policy details CTA visibility (both tiers) ·
signed `.mobileconfig` rejection · "Add software" All-fleets gating + tooltip · dark-mode theme · "Lock end
user info" gating · session-reset → API-token rotation · edit API-only user (All → Specific endpoints).

Infrastructure added: `ws-admin`/`api-ws-admin` catalog entries, `createApiUser()`, a generated signed
`.mobileconfig` fixture, and several POM accessors.

**Deferred with grounding notes:** admin-edits-password (verify via API login, not a UI landing), vulnerability
column-sort (assertion is an implementation detail), the CVE-filter pill, and setup-assistant bad-DEP (needs an
Apple ABM round-trip).

## Batch 2 — net-new, no host dependency · PR #35

~21 specs across software, policies, reports, labels, settings and controls. The prerequisite for the settings
work was an **appConfig snapshot/restore helper** (`helpers/api/config.ts`), which every global-config spec
since has used.

Shipped: software (manage-automations-access, os, vulnerability-automations, no-teams-views, edit-package) ·
policies (sql-validation, policy-automations) · reports (save-as-new, list-filters, automations) · labels
(CRUD, sort-view, role-access) · settings (org-info, fleet-desktop, enroll-secrets, mdm-migration-validation,
automatic-enrollment) · controls (custom-variables, disk-encryption).

Two items were **moved to Batch 4** rather than forced: `advanced-options` (the bundled save needed care) and
the labels team-admin variants (no team-admin user existed yet).

## Batch 3 — hosts area, host-independent · PR #35

The biggest page-object investment. The hosts area had **zero** e2e specs before this — only a loadtest spec —
so `HostsListPage` and `HostDetailsPage` grew from thin locator bags into real page objects, and a new
`AddHostsModal` component appeared.

Shipped (all `shared/` where behaviour was genuinely tier-identical): export-csv · edit-columns ·
add-hosts-download · host-status-webhook · host-software · cta-visibility (explicit `free/` + `premium/`,
because the role dimension differs).

Notable finding: Fleet **hides the "User email" column by default**, so `edit-columns` runs hidden→show→hide
and self-restores. `labels-crud` via the hosts label-filter was skipped as redundant with the Batch-2 labels
specs.

## Batch 4 — host-dependent, destructive, team-admin · PR #36

Everything gated on infrastructure. The gate opened in stages during the batch, which is why the plan changed
underneath it twice.

### Group A — host details reads and execution
`host-details-smoke` (refetch, local-user-accounts search, Agent tooltip) · `host-live-query` (Actions → Live
report → run → `Report finished` with the real result row) · `host-reports-tab` (count, toggle, search, Name
A-Z/Z-A sort) · `host-report-details` (C2 #24 — card → Show details → per-host results → View data for all
hosts).

All landed **`shared/`** rather than per-tier: the behaviours are identical on both, and the "premium-only"
Agent tooltip was an accident of QA Wolf's coverage.

### Group B — host↔team transfer
`bulk-transfer` (select-all bar, transfer modal, fleet typeahead, select-all-matching affordance) ·
`host-transfer-permissions` (admin and maintainer can; team admin correctly cannot).

Reworked from QA Wolf's create-two-teams-and-move-50-hosts to staging a handful of simulated hosts into a
low-traffic fleet, so "select all on this page" can only ever act on the test's own hosts.

### Group C — host deletion
`host-delete` — bulk from the list, single from host details, and as a team admin. Simulated hosts only,
asserted by host **id** rather than display name, budgeted to 4 deletions per run.

### Group D — provisioning-unblocked
`team-host-status-webhook` (fleet webhook + host-expiry inherited-and-locked state) · `advanced-options` (the
bundled save must not disturb its neighbours) · the labels team-admin variant.

### Group E — reassigned
`dashboard/automations-activity` — filed under hosts in the audit, but it's the dashboard's automations modal.
Enable → edit → disable, each verb landing in the feed it configures.

### Group F — MDM action availability
`mdm-actions-availability` (premium + free) — asserts which of **Lock / Wipe / Turn off MDM** Fleet offers
across macOS, Windows and Ubuntu on both tiers. Six cases, and it never clicks a destructive item.

Added after the rest of the batch, once the real VMs made a per-platform matrix possible. It closes the gating
half of the Lock/Wipe gap: the commands still aren't fired, but a change that exposed one to the wrong platform,
tier or role would now fail a test. Two findings from grounding it in
`HostActionsDropdown/helpers.tsx` were counter-intuitive enough to be worth carrying forward:

- **Turn off MDM is Apple-only** — a Windows host never offers it, MDM-enrolled or not.
- **Lock and Wipe need no MDM on Linux** — both accept `isLinuxLike` outright, so the Ubuntu VM offers them
  with no enrollment at all.

It also exposed a real helper bug: `?platform=linux` returns **zero** hosts from Fleet's API (the `platform`
param matches label groups, and `linux` isn't one), so `findOnlineHost` now omits the param for Linux and
relies on the client-side platform filter.

### Deliberately not built
**Firing Lock or Wipe.** Rationale, the residual risk, and the full asserted matrix:
[`PARITY.md` §6](PARITY.md#6-lock-and-wipe-gated-not-ignored).

---

## Suite bugs found and fixed while porting

These were pre-existing defects the migration surfaced, not regressions it caused.

| fix | why it mattered |
|---|---|
| **`withStaticUser` now caches sessions to `.auth/`** | `POST /login` is throttled to 10/min in one bucket shared by every user and worker; a throttled login silently lands on `/login` looking like a bad password. Adding two role logins starved *pre-existing* specs (`labels/role-access`). Now one login per user per suite instead of per test — also measurably faster. |
| **`DataSet.value()` matches the whole term** | it matched substrings, so `"Fleet"` also resolved `"Added to Fleet"` on host vitals. Expressed as one selector, because a `filter({ has })` locator inherits the chain of whatever root built it — which silently matched nothing for container-scoped DataSets. |
| **`OrganizationAdvancedPage.goto()` anchor** | waited on an "Advanced options" heading the page no longer renders. Nothing had used the POM, so it had been quietly broken. |
| **`ReportLivePage` extended to the run screen** | previously only covered the targets picker, so no spec could assert a completed run. |

## Fixture and helper inventory added

`liveMacosHost` (real macOS VM, worker-scoped) · `vmsFleetId` · `findOnlineHost(request, platform, { kind, withUsers, withOrbit })` · `findSimulatedHostIds` · `hostExists` · `getHostFleetId` · `getHostDetailUpdatedAt` · `getFleetWebhookSettings`/`setFleetWebhookSettings` · `findReportByName`/`getHostReportLastFetched` · `activityCopy.activityAutomations` · `TransferHostModal` · `SelectReportModal` · `TeamSettingsPage` · `HostQueryReportPage` · `TeamDropdown.selectByLabel`.

## Plan corrections worth remembering

The plan was wrong in three places, each caught by checking the instance instead of the document:

1. **A named durable VM ("MacOS 26") no longer existed.** A parked fixture prototype resolved hosts *by name*;
   the load fleet regenerates names and ids on every restart. Resolution is by platform + status + MDM
   enrollment now, never by name.
2. **"Report cards need a cached result"** was wrong for the Reports *tab* — reports appear as soon as they
   apply to the host. It was right only for the per-host results drill (C2 #24).
3. **"The sim pool self-heals after a delete"** was wrong — osquery-perf enrolls once at startup with no
   node-invalid recovery, so a deleted simulation never returns on its own.
