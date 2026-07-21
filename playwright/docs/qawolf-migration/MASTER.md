# QA Wolf → Fleet Playwright migration — MASTER audit & strategy

Source: 269 QA Wolf flows (52 `flows-Free`, 217 `flows-Premium`) audited against the existing
`playwright/` suite across 10 area clusters. Per-flow tables live in `C1..C10-*.md` (same dir).

## 0. The one-line reality

The QA Wolf flows are **coverage transcripts, not portable code** — they depend on
`@qawolf/flows/web` + a `node20HelpersPremium` util that doesn't exist here, log in as hardcoded
`@qawolf.email` accounts, lean on `waitForTimeout` + brittle selectors, and **create/delete teams
inline** (forbidden by our gitops model). We harvest the *intent*, then re-author anything worth
keeping in our POM style. Nothing ports 1:1.

## 1. Disposition totals (indicative — a few free/premium files were mislabeled at source)

| Disposition | Count | Meaning / action |
|---|---:|---|
| **DUP** | ~20 | Already covered at equal-or-greater depth → **drop** the QA Wolf flow. |
| **AUGMENT** | ~33 | Existing spec + a specific missing assertion → **graft** onto it. |
| **NEW** | ~70 | Genuine gap → **author** (collapses to ~70–80 spec files after tier splits). |
| **CUT** | ~17 | Low value / obsolete / QA-Wolf-infra → **don't port**. |
| **MERGE** | ~127 | Fold into a NEW/existing spec (role-permutation sets + free/premium pairs). |

The headline: **~53 flows are already covered or not worth keeping** (DUP+CUT), **~33 sharpen
existing specs**, and the real work is **~70 new specs** — heavily concentrated in **hosts**
(zero existing e2e coverage) and **reports/queries** (thin coverage).

## 2. Coverage map by area

| Area | QAW flows | Existing e2e? | Net effect |
|---|---:|---|---|
| hosts list + details | 52 | **none** (POMs thin) | biggest net-new + biggest POM build |
| policies | 40 | solid CRUD | mostly augment/role-merge; ~9 new feature specs |
| queries → **reports** + schedule | 41 | thin (CRUD only) | ~9 new reports specs; "schedule" = reports-with-interval (no separate page) |
| software + no-teams | 28 | solid | mostly augment; ~7 new specs |
| settings | 28 | rich (users) | users=DUP; org-settings/enroll-secrets/MDM = ~10 new |
| controls/scripts/secrets/pkgs | 24 | partial | ~6 safe new + 4 host-gated batch specs |
| mdm/labels/android/misc | 17 | none (labels stub) | labels + disk-enc + mdm-settings + host-dep |
| reports-list/dashboard/general | 20 | thin | host Reports-tab + dashboard feed + dark-mode(persist only) |
| auth/role-access/api | 23 | solid | almost all DUP; 1 new API file-size spec |

## 3. Cross-cluster consolidations (clusters independently proposed the SAME spec — merge)

1. **Host Reports tab** — C2 (`hosts-queries-table`, sort, view-details) + C5 (`reports-*`, which are
   host-details Reports tab, NOT the /reports list) → ONE pair `{free,premium}/hosts/host-reports-tab.spec.ts`.
2. **Host Software tab** — C2 (search + drill → filtered hosts) + C5 (Inventory/Library sub-tab content)
   → `{free,premium}/hosts/host-software.spec.ts`.
3. **Hosts CTA-by-role** — C1 (list CTAs: add hosts / enroll secret / add label) + C7 (host-details
   observer CTAs, team-admin/maintainer/observer) → `{free,premium}/hosts/cta-visibility.spec.ts`.
4. **Labels** — C9 (dedicated Labels page CRUD/sort/role) + C5 #9 (labels CRUD+activity) + C1 (Hosts
   label-filter label CRUD) → the `premium/labels/` area (1–3 files); hosts label-filter is one case in it.
5. **Reports automations** — C4 (P2/P7) + C7 #22 (team-admin toggles report automations) → one spec.
6. **Software manage-automations** — C6 (role access) + C7 #18 (disabled-on-team-select) → one spec.
7. **Policy automation ACTIONS on failing policy** — C6 #25 (install_software/RPM) + C9 #7 (install_software/deb)
   + C9 #17 (run_script) → one host-dep spec family `premium/policies/policy-automation-actions.spec.ts`
   (distinct from C3's webhook/ticket config automations, which need no host).
8. **MDM/integrations** — C7 #28 (automatic-enrollment: EULA + SSO/IdP) + C9 #9 (MDM card + end-user
   migration) → `premium/settings/integrations/{mdm,automatic-enrollment}.spec.ts`.
9. **Team-scope nav** — C5 #10 (dropdown search + filters hosts) + C6 #28 (scope persistence across nav)
   → one `premium/hosts/team-scope.spec.ts` (or shared nav spec).
10. **API upload helpers** — C10 (script/profile/EULA upload) + C8 (script upload, custom-variable) →
    build once in `helpers/api/`.

## 4. Cross-cutting blockers (decide once, unblock many)

- **No `team-admin` static user.** Blocks role flows in C1/C3/C4/C7/C9/C10 (~10+ flows). Only
  `ws-maintainer`/`ws-observer` exist. → Provision a `ws-admin` static user, or drop team-admin variants.
- **Live-host dependency.** Gates ~25 flows across C2/C3/C4/C6/C8/C9 (live-run, policy automations,
  run-script, RPM install, batch-script lifecycle, host reports/software). The `liveMacosHost` fixture is
  prototyped only in the parked git stash. Aligns with the existing host-tests roadmap (MacOS 26 VMs).
  Batch-script per-status coverage additionally needs a **mixed-OS team** (Win + fedora + macOS) our
  gitops model doesn't provide.
- **Destructive ops** — delete host, lock, wipe, bulk-delete hosts. Need disposable/re-enrollable (and for
  lock/wipe, MDM) hosts. Currently CUT/infra-blocked.
- **Global appConfig mutation without cleanup** — org settings, policy/report/vuln automations, AI setting,
  stored-results. Need a shared **appConfig save/restore** fixture (no cleanup project resets app config).
- **Team create/delete + ad-hoc teams** (Ducks/Swans/Pigeons/Turkeys/Geese/Virtual Machines) — universal;
  rework to Workstations/Unassigned/All fleets + API preconditions.
- **`toHaveScreenshot`** everywhere → drop (no visual-baseline infra).
- **CA integration** (certificates spec) and **Managed Google Play** (android specs) — external provisioning.

## 5. Notable CUTs (don't port)

- Cosmetic: `general-new-hover-states-and-gray-underlines` (pure CSS/rgb/screenshot); dark-mode visual
  screenshots (keep only theme-persistence); `view-software-page` ×2 (column presence + viewport-resize).
- Redundant: `default-policy` CRUD (= custom CRUD); `visit-nvd-page` (already in cveDetail); `delete-scripts-on-software`
  (= Windows .msi title delete already covered); `schedule-*-maintainer` free+premium (role-dups, no interval set).
- Trivial presence: team-section-in-create-user-modal; team-dropdown-enabled-on-host-page.
- Infra-negative: `mdm-cert-renewal-banned-email-domain` (needs bespoke banned-domain admin; cheaper as API test).
- Reframe (not e2e): `settings-create-edit-and-delete-team` → gitops-verify API drift check or drop.

## 6. Proposed batch plan (dependency-ordered)

### Batch 0 — Enablers (prereqs, unblock the rest)
- Decision + provisioning: `ws-admin` (team-admin) static user; commit `liveMacosHost`/`liveLinuxHost`
  worker fixtures (from stash); confirm cosmetic CUTs.
- Shared helpers/fixtures: API upload (script/profile/EULA), custom-variable CRUD, label precondition,
  enroll-secret, **appConfig save/restore**. Test-data fixtures (signed .mobileconfig, bad DEP json,
  shebang-variant .sh, .py scripts; runtime large-payload generators — no committed multi-MB files).

### Batch 1 — Dedupe & Augment (cheapest, no new POM, immediate coverage capture)
Drop the ~20 DUPs; graft the ~33 AUGMENTs: auth (signed-out redirect, forgot-pw submit), users
(admin-edits-password, session→token rotation, API-user edit), software vulnerabilities (exploited filter,
search-narrows, column sort, 3× view-all-hosts), software library (custom-pkg advanced options, org-level
unhappy path, non-fma no-patch), scripts library (download-matches-source, non-`#!/bin/sh` shebang, >500k
rejection, maintainer upload), policies (CTA visibility, cross-team isolation), reports (invalid-SQL-saves,
default-state), config-profiles (signed rejection), setup-assistant (bad DEP), setup-experience users (lock
end-user info), dark-mode (theme persistence only).

### Batch 2 — Net-new reusing existing POMs (no host dependency)
API file-size spec; software (os, manage-automations-access, vulnerability-automations, no-teams-views);
policies (sql-validation, role-permissions, automation-type-filter, policy-automations config);
reports (save-as-new, list-filters, automations, stored-results-setting); settings (org-info, advanced,
fleet-web-address [risky], fleet-desktop); controls (batch-progress nav/empty, run-script-modal,
custom-variables, script-secret-dependency, bootstrap-fleetd-manual); labels (CRUD, sort, role); mdm
(disk-encryption, mdm settings; certificates if CA; android-config if MGP); enroll-secrets;
automatic-enrollment. Each needs POM expansion but not a live host.

### Batch 3 — Hosts area (big POM investment; read-mostly host use, non-destructive)
HostsListPage + HostDetailsPage buildout, then: add-hosts-download, export-csv, edit-columns,
cta-visibility, bulk-transfer, team-scope; host-software, host-reports-tab, host-details-smoke,
host-live-query; host-status-webhook (global); dashboard automations-activity. Depends on the liveHost
fixture from Batch 0.

### Batch 4 — Host-dependent / execution / destructive (gated on host + infra decisions)
Reports live-run/results-lifecycle/osquery-schema/host-details-link; policies links-to-hosts/os-specific/
run-live/policy-automation-actions; software policy-install + no-team host library; controls batch-progress
lifecycle/cancel/host-status[mixed-OS team]/schedule; hosts run-script; AI-autofill (LLM); activity-feed
filters (seeded data); team-lifecycle (gitops-verify). Destructive delete/lock/wipe/bulk-delete: CUT unless
a disposable-host strategy is approved.

## 7. Decisions needed from the human
1. **team-admin static user** — provision `ws-admin`, or drop team-admin-specific flows?
2. **Host-dependent strategy** — author Batch 4 now against the MacOS-26 VM fleet, or park behind the
   host-tests roadmap and ship Batches 1–3 first?
3. **Destructive host ops** (delete/lock/wipe/bulk-delete) — CUT, API-only, or stand up disposable hosts?
4. **Tier-agnostic specs** (add-hosts-download, export-csv, edit-columns, labels, host-status-webhook) —
   `shared/` single spec, or explicit free+premium duplication (team's stated preference)?
5. **Where to start** — Batch 1 (dedupe/augment) recommended first.
