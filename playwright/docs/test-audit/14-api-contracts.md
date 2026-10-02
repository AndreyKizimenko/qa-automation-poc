# API contract specs — test audit

**Specs covered:** 6 files · **Test declarations:** 32 entries (39 `test()` calls — the 8 table-driven cases in `free/endpoints.spec.ts` are one entry) · **Projects:** premium / free

This area holds the suite's non-browser contract checks: the shape of `GET /config`, the free-tier
license value, the 402 premium paywall on the API (plus two premium-only writes free must refuse and
not store — a host's IdP username and Fleet MFA), Fleet's request/file-size limits, one query
parameter's payload contract (`exclude_software`), and a pure-unit snapshot of the activity-feed
copy helper. Folder routing decides the tier — `tests/api/*.spec.ts`
runs in **both** premium and free, `tests/api/free/` only in free, `tests/api/premium/` only in
premium ([`playwright.config.ts:151-179`](../../playwright.config.ts)).

**Reading this file.** There is no UI here, so **Flow** lists the request(s) issued and the
assertions made, and every entry carries a **Manual repro** line — the curl/`fleetctl` equivalent
Andrey can paste. All commands assume `$FLEET_URL` and `$FLEET_API_TOKEN` are exported from
`.env.premium` (or `.env.free`); `-k` covers the QA cert. Every `npx playwright test` command needs
`--project=premium` (or `--project=free`) or `SUITE=` — `resolveSuite()` throws at config load
otherwise ([`playwright.config.ts:77`](../../playwright.config.ts)).

`Mode` legend: **API** (real Fleet request, asserted on the response) · **UNIT** (no Fleet call at
all — pure in-process assertion; a fifth mode this area needs, all 17 activity-copy tests are this — API-01…14 and API-28…30).

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| API-01 | `api/activity-copy.spec.ts` | activityCopy › policy.created — All fleets, Unassigned, Workstations | UNIT | ☐ |
| API-02 | `api/activity-copy.spec.ts` | activityCopy › policy.edited / policy.deleted use "the policy" article | UNIT | ☐ |
| API-03 | `api/activity-copy.spec.ts` | activityCopy › report.* — globally + workstations; no Unassigned suffix | UNIT | ☐ |
| API-04 | `api/activity-copy.spec.ts` | activityCopy › label.* — "a label" on create, "the label" on edit/delete | UNIT | ☐ |
| API-05 | `api/activity-copy.spec.ts` | activityCopy › pack.* — global, no scope variants | UNIT | ☐ |
| API-06 | `api/activity-copy.spec.ts` | activityCopy › script.* — to / for / from prepositions; unassigned + team | UNIT | ☐ |
| API-07 | `api/activity-copy.spec.ts` | activityCopy › software.* — add/delete "to"/"from", edit "on"; package filename verbatim | UNIT | ☐ |
| API-08 | `api/activity-copy.spec.ts` | activityCopy › appStoreApp.* — (Platform) suffix + asymmetric Unassigned scope | UNIT | ☐ |
| API-09 | `api/activity-copy.spec.ts` | activityCopy › configurationProfile.* — tier-aware via process.env.SUITE | UNIT | ☐ |
| API-10 | `api/activity-copy.spec.ts` | activityCopy › user.created tolerates doubled whitespace before the email | UNIT | ☐ |
| API-11 | `api/activity-copy.spec.ts` | activityCopy › user.deleted | UNIT | ☐ |
| API-12 | `api/activity-copy.spec.ts` | activityCopy › user.changedGlobalRole — tier-aware "for all fleets" suffix | UNIT | ☐ |
| API-13 | `api/activity-copy.spec.ts` | activityCopy › name with regex-meta chars is escaped | UNIT | ☐ |
| API-14 | `api/activity-copy.spec.ts` | activityCopy › activityAutomations — enabled / edited / disabled | UNIT | ☐ |
| API-15 | `api/config.spec.ts` | Config shape › org info is populated | API | ☐ |
| API-16 | `api/config.spec.ts` | Config shape › server settings include a server URL | API | ☐ |
| API-17 | `api/config.spec.ts` | Config shape › mdm key exists in config | API | ☐ |
| API-18 | `api/free/endpoints.spec.ts` | Free • premium-gated endpoints › `<METHOD> /<path>` → 402 + license-required message (8 cases) | API | ☐ |
| API-19 | `api/free/license.spec.ts` | Free • license › license tier is free | API | ☐ |
| API-20 | `api/premium/max-request-file-sizes.spec.ts` | Premium • API • max request/file sizes › a script over 500,000 characters is rejected | API | ☐ |
| API-21 | `api/premium/max-request-file-sizes.spec.ts` | … › a configuration profile over the 1.573MB request limit is rejected | API | ☐ |
| API-22 | `api/premium/max-request-file-sizes.spec.ts` | … › an EULA PDF over the 26.21MB request limit is rejected | API | ☐ |
| API-23 | `api/premium/max-request-file-sizes.spec.ts` | … › an MDM command over the 2.097MB request limit is rejected | API | ☐ |
| API-24 | `api/premium/max-request-file-sizes.spec.ts` | … › an MDM command under the limit gets past the size gate | API | ☐ |
| API-25 | `api/premium/max-request-file-sizes.spec.ts` | … › a batch of configuration profiles over the 26.21MB request limit is rejected | API | ☐ |
| API-26 | `api/premium/max-request-file-sizes.spec.ts` | … › a batch of scripts over the 26.21MB request limit is rejected | API | ☐ |
| API-27 | `api/host-software-payload.spec.ts` | API • host by identifier › `exclude_software` drops the software list and nothing else | API | ☐ |
| API-28 | `api/activity-copy.spec.ts` | activityCopy › script runs — one host, this host, a batch | UNIT | ☐ |
| API-29 | `api/activity-copy.spec.ts` | activityCopy › mdmCommand.* — feed, this host, and the command item | UNIT | ☐ |
| API-30 | `api/activity-copy.spec.ts` | activityCopy › hostSoftware.* — installed / uninstalled, failed and upcoming | UNIT | ☐ |
| API-31 | `api/free/license.spec.ts` | Free • license › setting or removing a host IdP username is refused with 402 | API | ☐ |
| API-32 | `api/free/license.spec.ts` | Free • license › turning on Fleet MFA for a user is refused with 402 | API | ☐ |

---

## Every size-limit payload is generated at run time (read before API-20…API-26)

**Nothing multi-MB is committed to this repo.** All seven cases in
[`max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) build
their body in memory with `Buffer.alloc(n, 'a')` (or `'a'.repeat(n)`) and, where the endpoint takes
JSON, `.toString('base64')`. There is no fixture under `test-data/` for any of them, and there
should never be — a 27 MB padding file in git to prove a 26.21 MB limit would cost every clone
forever for a byte pattern the spec can produce in a line. `MIB = 1024 * 1024` at the top of the
file is the only shared constant.

Consequences worth knowing before judging these entries:

- **Nothing here is valid content.** Only the EULA case bothers with a magic prefix (`%PDF-1.7`),
  and only because it reads better; the request-body-size middleware rejects before any handler
  parses the payload, so a wall of `a` is as good as a real `.mobileconfig` or `.pdf`.
- **The cost is bandwidth, not disk.** Each run pushes ~27 MB (EULA) + 35 MB (batch profiles) +
  ~30 MB (batch scripts) + 4 MB (MDM command) + 2 MB (profile) + 0.5 MB (script) at the shared QA
  instance, ×2 on a CI retry. That is the single biggest byte cost in the non-browser suite.

**Why six of the seven are rejection paths only.** A rejected upload persists nothing, so the spec
needs no cleanup and can run against a shared instance with no coordination — that is stated in the
file header and it is the reason the positive controls flagged as gaps in API-20…API-22 were never
written. API-24 is the one exception and shows the shape a safe positive control has to take: it
sends an **under-limit** MDM command to a syntactically valid UUID that belongs to no host, so the
request must get past the size gate and then fail on its *target* (404 `No hosts targeted`) rather
than queueing anything. Queuing a real command would need an MDM-enrolled host and would leave an
un-withdrawable entry in that host's command history — which belongs with the host-execution specs,
not here.

---

## What `activity-copy.spec.ts` actually protects (read before API-01…API-14 and API-28…API-30)

[`helpers/activity-copy.ts`](../../helpers/activity-copy.ts) builds the `RegExp`s that **26 e2e
specs** feed to `dashboard.expectActivities()` (and, for the host-scoped builders, to `hostDetails.activityItem()`)
([`pages/DashboardPage.ts:177`](../../pages/DashboardPage.ts)) as the final sub-test of every CRUD
lifecycle. Those regexes encode Fleet's rendered feed sentence: verb + article + name + a
resource-specific scope suffix, tier-aware for profiles and role changes.

Consumer map (who breaks if a builder is wrong):

| Builder family | Consumers | Scopes consumers actually pass |
|---|---|---|
| `policy.*` | [premium/policies](../../tests/e2e/premium/policies/policies.spec.ts), [free/policies](../../tests/e2e/free/policies/policies.spec.ts) | All fleets, Workstations |
| `report.*` | [premium/reports](../../tests/e2e/premium/reports/reports.spec.ts), [free/reports](../../tests/e2e/free/reports/reports.spec.ts) | All fleets, Workstations |
| `pack.*` | [shared/packs](../../tests/e2e/shared/packs/packs.spec.ts) | n/a (global) |
| `script.*` | [premium/controls/scripts/library](../../tests/e2e/premium/controls/scripts/library.spec.ts), [free/…/library](../../tests/e2e/free/controls/scripts/library.spec.ts) | Unassigned, Workstations |
| `script.ran` / `ranOnThisHost` / `ranBatch` | [shared/hosts/host-run-script](../../tests/e2e/shared/hosts/host-run-script.spec.ts), [premium/controls/scripts/batch-run](../../tests/e2e/premium/controls/scripts/batch-run.spec.ts) | n/a (host / host count) |
| `mdmCommand.*` | [shared/hosts/mdm-commands](../../tests/e2e/shared/hosts/mdm-commands.spec.ts) | n/a |
| `hostSoftware.*` | [premium/software/software-lifecycle-on-host](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts), [premium/software/install-on-host](../../tests/e2e/premium/software/install-on-host.spec.ts), [premium/software/uninstall-from-host](../../tests/e2e/premium/software/uninstall-from-host.spec.ts) | n/a — `failedToInstall`, `toldToInstall`, `toldToUninstall` have no consumer |
| `software.*` | [premium/software/library](../../tests/e2e/premium/software/library.spec.ts), [premium/software/edit-package](../../tests/e2e/premium/software/edit-package.spec.ts) | Unassigned, Workstations |
| `appStoreApp.*` | [premium/software/library](../../tests/e2e/premium/software/library.spec.ts) | Unassigned, Workstations |
| `configurationProfile.*` | [premium](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts) + [free os-settings](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts) | Unassigned, Workstations (free: none) |
| `label.*` | [shared/labels](../../tests/e2e/shared/labels/labels.spec.ts) | n/a (global) |
| `user.*` | premium+free `settings/users/{api-user-create,regular-user-create,edit,delete}.spec.ts` (8 specs) | n/a |
| `activityAutomations.*` | [premium/dashboard/automations-activity](../../tests/e2e/premium/dashboard/automations-activity.spec.ts) | n/a |

**Is it the right layer? Partly — but its stated purpose is not what it does.** The file header
claims "when Fleet changes copy upstream this file fails before the CRUD specs do". That is **false**:
the spec makes no Fleet call and reads no Fleet source. Both sides of every assertion live in this
repo — a regex from `helpers/activity-copy.ts` and a hand-transcribed literal in the spec. If Fleet
renames "created a policy" to "added a policy", *both* stay stale and this file keeps passing while
26 e2e specs go red. What it genuinely protects is **helper-refactor regression**: change a
preposition, a scope suffix, or the `esc()` behaviour and you learn in milliseconds, locally, without
a Fleet instance, instead of via a red CRUD run 20 minutes later. It is also executable documentation
of the copy contract (one place to read the whole matrix). That is real value, cheap — keep it, but
fix the header comment and stop claiming upstream-drift detection.

**Does it duplicate the per-resource activity assertions? No — it is orthogonal, with one caveat.**
The CRUD specs assert twice per lifecycle step: `assertActivity()` on `GET /activities`
(activity `type` + `details` + actor, [`helpers/api/activities.ts:10`](../../helpers/api/activities.ts))
and `dashboard.expectActivities()` on the rendered feed (this helper's regex). The API assertion
protects the *record*, the UI assertion the *rendering*, and API-01…API-14 protect the *matcher*. The
caveat: it is a self-consistency test, so it can only ever tell you the helper changed — it can never
tell you the helper is *right*.

**Cost:** `tests/api/activity-copy.spec.ts` is not in any `testIgnore` list, so all 17 tests run in
**both** the premium and free projects. Because the two SUITE-sensitive tests (API-09, API-12) stub
`process.env.SUITE` themselves, the free run is byte-identical to the premium run — 17 duplicate
executions per nightly pair.

**Manual repro (applies to all of API-01…API-14 and API-28…API-30).** Two levels:
1. *Helper self-check* — `npx playwright test tests/api/activity-copy.spec.ts --project=premium`
   (no instance needed; the spec imports `@playwright/test` directly, so no browser and no auth).
2. *Contract check against real Fleet* — do the action in the UI, then read the dashboard **Activity**
   feed, or `curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/activities?order_key=created_at&order_direction=desc&per_page=20" | jq '.activities[] | {type, details}'`
   and confirm the rendered sentence still matches the literal in the entry below. This is the step
   the automation does **not** do.

---

### API-01 · activityCopy › policy.created — All fleets, Unassigned, Workstations

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "policy.created"`
- **Project:** premium **and** free (identical) · **Mode:** UNIT · **Isolation:** none needed — no state, no Fleet
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `activityCopy.policy.created({ name: 'demo', scope })` for all three scopes and test each against its literal.
   - ✅ *(UNIT)* `All fleets` → matches `created a policy demo globally.`
   - ✅ *(UNIT)* `Unassigned` → matches `created a policy demo for Unassigned.`
   - ✅ *(UNIT)* `Workstations` → matches `created a policy demo on the Workstations fleet.`

**Assessment**
- *Value:* pins `fleetSuffix()` ([`helpers/activity-copy.ts:33`](../../helpers/activity-copy.ts)) — the three-way scope suffix shared by policies and reports.
- *Coverage gaps:* positive-only — no assertion that the All-fleets regex *fails* on the Workstations string, so a suffix that loosened to `.*` would still pass. The `Unassigned` variant is dead in practice: premium/policies runs `['All fleets','Workstations']` ([`policies.spec.ts:12`](../../tests/e2e/premium/policies/policies.spec.ts)).
- *Redundancy:* the regex itself is exercised for real by premium/free policies specs; overlaps API-02 (same builder family).
- *Efficiency / smells:* runs twice (premium + free) for an identical result.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-02 · activityCopy › policy.edited / policy.deleted use "the policy" article

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "the policy"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `policy.edited({ scope: 'All fleets' })` and `policy.deleted({ scope: 'Workstations' })`.
   - ✅ *(UNIT)* matches `edited the policy demo globally.`
   - ✅ *(UNIT)* matches `deleted the policy demo on the Workstations fleet.`

**Assessment**
- *Value:* catches the create-vs-edit article flip (`a policy` → `the policy`), Fleet's easiest copy trip-hazard.
- *Coverage gaps:* one scope per verb; no negative assertion (`policy.created` regex must not match the `edited` sentence).
- *Redundancy:* same family as API-01 — the two could be one matrix test.
- *Efficiency / smells:* none beyond the double-project run.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-03 · activityCopy › report.* — globally + workstations; no Unassigned suffix

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "no Unassigned suffix"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `report.created/edited/deleted` across scopes.
   - ✅ *(UNIT)* `created a report demo globally.` (All fleets)
   - ✅ *(UNIT)* `edited the report demo on the Workstations fleet.`
   - ✅ *(UNIT)* `deleted the report demo.` — the `unassignedFallsThrough` branch: reports emit **no** suffix on Unassigned.

**Assessment**
- *Value:* the only guard on `fleetSuffix(..., { unassignedFallsThrough: true })`, an asymmetry that is invisible in the helper's call sites.
- *Coverage gaps:* the Unassigned branch it uniquely covers is unused by consumers (premium/reports runs `['All fleets','Workstations']`, [`reports.spec.ts:13`](../../tests/e2e/premium/reports/reports.spec.ts)) — so the one interesting case here protects dead code.
- *Redundancy:* structurally identical to API-01/API-02.
- *Efficiency / smells:* the `report.created` doc-comment cites `GlobalActivityItem.tsx:1674`, the same line `activityAutomations.edited` cites — the citations in [`helpers/activity-copy.ts`](../../helpers/activity-copy.ts) have drifted and nothing verifies them.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-04 · activityCopy › label.* — "a label" on create, "the label" on edit/delete

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "on edit/delete"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `label.created/edited/deleted({ name: 'demo' })`.
   - ✅ *(UNIT)* `created a label demo.` / `edited the label demo.` / `deleted the label demo.`

**Assessment**
- *Value:* article check for the global (no-scope) label copy used by [shared/labels](../../tests/e2e/shared/labels/labels.spec.ts).
- *Coverage gaps:* the helper comment says Fleet appends ` on the <fleet> fleet` for team-scoped labels; there is no builder and no test for that variant — team-scoped label activities are unassertable today.
- *Redundancy:* none.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-05 · activityCopy › pack.* — global, no scope variants

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "no scope variants"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `pack.created/edited/deleted({ name: 'demo' })`.
   - ✅ *(UNIT)* `created pack demo.` / `edited pack demo.` / `deleted pack demo.` — no article, because packs fall through to Fleet's `defaultActivityTemplate`.

**Assessment**
- *Value:* documents that packs have **no** dedicated renderer (hence no "a/the" article) — the single most surprising row in the matrix.
- *Coverage gaps:* no negative assertion; consumer is [shared/packs](../../tests/e2e/shared/packs/packs.spec.ts) only.
- *Redundancy:* none.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-06 · activityCopy › script.* — to / for / from prepositions; unassigned + team

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "prepositions"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `script.added({ scope: 'Unassigned' })`, `script.edited({ scope: 'Workstations' })`, `script.deleted({ scope: 'Workstations' })`.
   - ✅ *(UNIT)* `added script demo to unassigned.`
   - ✅ *(UNIT)* `edited script demo for the Workstations fleet.`
   - ✅ *(UNIT)* `deleted script demo from the Workstations fleet.`

**Assessment**
- *Value:* the three verbs use three different prepositions (`to` / `for` / `from`) — a genuinely error-prone contract; this is the highest-value test in the file.
- *Coverage gaps:* only one scope per verb, and the matrix is the *inverse* of what consumers need: free scripts uses Unassigned for all three verbs and premium loops both ([`library.spec.ts:52`](../../tests/e2e/premium/controls/scripts/library.spec.ts)), so `added/Workstations`, `edited/Unassigned`, `deleted/Unassigned` are used in anger but untested here.
- *Redundancy:* `scriptScope()` is shared with `software.*` (API-07), so the scope halves overlap.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-07 · activityCopy › software.* — add/delete "to"/"from", edit "on"; package filename verbatim

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "package filename verbatim"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `software.added/deleted/edited({ packageName: 'gh_2.92.0_macOS_universal.pkg', scope })` for Unassigned and Workstations (6 assertions).
   - ✅ *(UNIT)* add → `added <pkg> to unassigned.` / `… to the Workstations fleet.`
   - ✅ *(UNIT)* delete → `deleted <pkg> from unassigned.` / `… from the Workstations fleet.`
   - ✅ *(UNIT)* edit → `edited <pkg> on unassigned.` / `… on the Workstations fleet.` (`on`, not `to`/`from`)
   - ✅ *(UNIT)* the `.pkg` filename (dots, underscores) survives `esc()` intact.

**Assessment**
- *Value:* the only full 3-verb × 2-scope matrix in the file, and it pins that the feed shows the **installer filename**, not the software title — the mistake most likely to be made when authoring a software spec.
- *Coverage gaps:* no negative assertion; no `All fleets` case (`scriptScope('All fleets')` silently returns `unassigned` — untested and arguably wrong).
- *Redundancy:* shares `scriptScope()` with API-06.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-08 · activityCopy › appStoreApp.* — (Platform) suffix + asymmetric Unassigned scope

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "asymmetric Unassigned scope"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `appStoreApp.added/deleted` for Unassigned (`Bear`, iOS) and Workstations (`ChatGPT`, Android).
   - ✅ *(UNIT)* `added Bear (iOS) to the No team fleet.` — add on Unassigned renders **"the No team fleet"** (Fleet sets `team_name="No team"`).
   - ✅ *(UNIT)* `deleted Bear (iOS) from unassigned.` — delete on Unassigned renders **"unassigned"** (`team_name=null`).
   - ✅ *(UNIT)* named teams stay symmetric: `… to/from the Workstations fleet.`
   - ✅ *(UNIT)* the `(Platform)` parens are escaped, not treated as a regex group.

**Assessment**
- *Value:* highest documentation value in the file — the add/delete asymmetry on Unassigned is a Fleet API quirk nobody would guess, and it is the exact shape a future agent would "fix" into a bug.
- *Coverage gaps:* no `edited` builder exists for app-store apps (does Fleet emit one?) — `⚠️ unclear:` from the source. No negative assertion.
- *Redundancy:* none — `appStoreAppScope()` is used nowhere else.
- *Efficiency / smells:* if Fleet ever normalises `team_name` on delete, this test is the one that must be *relaxed*, not the specs — worth a comment saying so.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-09 · activityCopy › configurationProfile.* — tier-aware via process.env.SUITE

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "tier-aware via process.env.SUITE"`
- **Project:** premium + free (result identical — the test stubs SUITE itself) · **Mode:** UNIT
- **Isolation:** mutates `process.env.SUITE` and restores it in `finally` — worker-global state, safe only because Playwright runs tests serially inside a worker
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Set `SUITE=free`, build `configurationProfile.added/deleted`.
   - ✅ *(UNIT)* `added configuration profile Fleet Playwright Inert to all macOS, iOS, and iPadOS hosts.`
   - ✅ *(UNIT)* `deleted configuration profile fleet-pw-inert from all Windows hosts.` (free ignores scope → `all <hostsPhrase>`)
2. ☐ Set `SUITE=premium`, rebuild with scopes.
   - ✅ *(UNIT)* Unassigned → `… to unassigned macOS, iOS, and iPadOS hosts.`
   - ✅ *(UNIT)* Workstations → `… to Windows hosts assigned to the Workstations fleet.`
   - ✅ *(UNIT)* Workstations delete → `… from Windows hosts assigned to the Workstations fleet.`
3. ☐ Restore the original `SUITE`.

**Assessment**
- *Value:* the only place the free-vs-premium copy fork (`profileSuffix`, [`helpers/activity-copy.ts:92`](../../helpers/activity-copy.ts)) is exercised in both directions — a real e2e run only ever sees one branch, so without this test half the helper is untested per project.
- *Coverage gaps:* premium `deleted` on Unassigned is not covered even though the premium spec loops `['Unassigned','Workstations']`; no Android `hostsPhrase` case; no negative assertion.
- *Redundancy:* none — this is the one activity-copy test that could not be replaced by a single e2e run.
- *Efficiency / smells:* `process.env` mutation is shared-state; a fixture-injected tier param on the helper would remove the need. Also proof the whole file is tier-independent, which undermines running it in both projects.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-10 · activityCopy › user.created tolerates doubled whitespace before the email

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "doubled whitespace"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `user.created({ email: 'qa-test-123@fleetdm.com' })` and test both spacings.
   - ✅ *(UNIT)* matches `created a user <email>.` (single space)
   - ✅ *(UNIT)* matches `created a user  <email>.` (doubled — Fleet emits `<b> EMAIL</b>`)

**Assessment**
- *Value:* pins the `\s+` tolerance; without it the four user-create specs (premium+free × api/regular) fail on a whitespace nobody can see in a diff.
- *Coverage gaps:* only whitespace; nothing asserts the email is regex-escaped (the `.` in `fleetdm.com` would match any char — harmless, but the escape test API-13 covers names only).
- *Redundancy:* the same regex is asserted for real by 4 user-create specs.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-11 · activityCopy › user.deleted

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "user.deleted"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `user.deleted({ email })`.
   - ✅ *(UNIT)* matches `deleted a user <email>.`

**Assessment**
- *Value:* thin — one literal, one match. Consumer: premium+free `settings/users/delete.spec.ts`.
- *Coverage gaps:* no doubled-whitespace case (the builder uses the same `\s+`, so the variant is untested here even though it is free to add).
- *Redundancy:* trivially mergeable with API-10 into one `user.*` test.
- *Efficiency / smells:* a 3-line test that costs a full Playwright test slot in two projects.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-12 · activityCopy › user.changedGlobalRole — tier-aware "for all fleets" suffix

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "for all fleets"`
- **Project:** premium + free (identical) · **Mode:** UNIT
- **Isolation:** mutates `process.env.SUITE`, restored in `finally`
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ `SUITE=free` → build `user.changedGlobalRole({ email, role: 'maintainer' })`.
   - ✅ *(UNIT)* matches `changed <email> to maintainer.` (no suffix)
2. ☐ `SUITE=premium` → rebuild.
   - ✅ *(UNIT)* matches `changed <email> to maintainer for all fleets.`
3. ☐ Restore `SUITE`.

**Assessment**
- *Value:* same argument as API-09 — covers the branch the current project can't see. Consumers: premium+free `settings/users/edit.spec.ts`.
- *Coverage gaps:* only the `maintainer` role; no negative assertion (the free regex is a prefix of the premium string, so the *free* regex happily matches the *premium* sentence — an unanchored-regex hazard worth an explicit `toBe(false)` in the other direction).
- *Redundancy:* none.
- *Efficiency / smells:* `process.env` mutation as in API-09.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-13 · activityCopy › name with regex-meta chars is escaped

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "regex-meta chars"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build `policy.created({ name: 'name.with(parens).and+plus', scope: 'All fleets' })`.
   - ✅ *(UNIT)* matches the literal sentence containing that name — i.e. `esc()` neutralised `.`, `(`, `)`, `+`.

**Assessment**
- *Value:* guards `esc()` ([`helpers/activity-copy.ts:18`](../../helpers/activity-copy.ts)); without it a resource named `Wi-Fi (corp)` would produce a regex that silently matches the wrong row.
- *Coverage gaps:* positive-only — it never proves an *unescaped* build would fail, so deleting `esc()` from `policy.created` would still pass (`.` matches `.`). A `[` or `\` case, or a mismatch assertion, would close that. Only `name` is checked; `hostsPhrase` is interpolated unescaped in `profileSuffix` (commas only today, so benign), while `scope` is a closed 3-value union so escaping is moot.
- *Redundancy:* API-07 incidentally covers dots/underscores in a `.pkg` filename.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-14 · activityCopy › activityAutomations — enabled / edited / disabled

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "activityAutomations"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build the three subject-less builders and test each against its literal.
   - ✅ *(UNIT)* `enabled activity automations.` / `edited activity automations.` / `disabled activity automations.`
   - ✅ *(UNIT)* **negative:** `enabled()` does **not** match `disabled activity automations.`

**Assessment**
- *Value:* one of only two tests in the file with a negative assertion (API-30 is the other) — and it matters here, because "enabled"/"disabled" are substrings of one another's context. This is the pattern the other 13 entries should copy.
- *Coverage gaps:* none for this family. Consumer: [premium/dashboard/automations-activity](../../tests/e2e/premium/dashboard/automations-activity.spec.ts) (premium-only, yet this test also runs on free).
- *Redundancy:* none.
- *Efficiency / smells:* the builders' `@see` line citations (1671/1674/1677) collide with the `report.*` citations — see API-03.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-15 · Config shape › org info is populated

- **File:** [`playwright/tests/api/config.spec.ts`](../../tests/api/config.spec.ts)
- **Grep:** `npx playwright test tests/api/config.spec.ts --project=premium -g "org info is populated"`
- **Project:** premium **and** free · **Mode:** API · **Isolation:** read-only, parallel-safe
- **Preconditions:** valid `FLEET_API_TOKEN`; instance reachable · **Data created:** none

**Flow**

1. ☐ `GET /api/v1/fleet/config` with `authHeaders()`.
   - ✅ *(API)* response is 2xx (`toBeOK`).
   - ✅ *(API)* `org_info.org_name` is truthy.

**Assessment**
- *Value:* a smoke test — "the instance answers and is configured". In practice it is the suite's canary for a dead/misconfigured QA instance.
- *Coverage gaps:* truthiness only — doesn't assert the expected org name, so a wrong-instance target passes. Nothing asserts `org_logo_url`, `contact_url`, or that `PATCH /config` round-trips (that lives in the premium org-settings e2e spec).
- *Redundancy:* same request as API-16, API-17, API-19 — four separate `GET /config` calls asserting four fields.
- *Efficiency / smells:* imports from `@fixtures`, so the auto `pageHealth` fixture ([`fixtures.ts:270`](../../fixtures.ts)) pulls in `page` and launches a Chromium context for a spec that never opens a browser. `@playwright/test` is the sanctioned import for pure-API specs (`playwright/CLAUDE.md`).

**Manual repro**
```bash
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/config" | jq '.org_info'
# expect: { "org_name": "<non-empty>", ... }   (fleetctl get config also shows this)
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-16 · Config shape › server settings include a server URL

- **File:** [`playwright/tests/api/config.spec.ts`](../../tests/api/config.spec.ts)
- **Grep:** `npx playwright test tests/api/config.spec.ts --project=premium -g "server URL"`
- **Project:** premium + free · **Mode:** API · **Isolation:** read-only
- **Preconditions:** as API-15 · **Data created:** none

**Flow**

1. ☐ `GET /config`.
   - ✅ *(API)* 2xx.
   - ✅ *(API)* `server_settings.server_url` matches `/^https?:\/\//`.

**Assessment**
- *Value:* catches a blank/relative `server_url`, which breaks enrollment and MDM flows — cheap and real.
- *Coverage gaps:* doesn't compare against `FLEET_URL`, which is the assertion that would actually catch "the suite is pointed at the wrong instance" or a URL that drifted after a restore.
- *Redundancy:* duplicate `GET /config` with API-15/17/19.
- *Efficiency / smells:* browser launched via `@fixtures` (see API-15).

**Manual repro**
```bash
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/config" | jq -r '.server_settings.server_url'
# expect: https://<the QA host>  — and it should equal $FLEET_URL
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-17 · Config shape › mdm key exists in config

- **File:** [`playwright/tests/api/config.spec.ts`](../../tests/api/config.spec.ts)
- **Grep:** `npx playwright test tests/api/config.spec.ts --project=premium -g "mdm key exists"`
- **Project:** premium + free · **Mode:** API · **Isolation:** read-only
- **Preconditions:** as API-15 · **Data created:** none

**Flow**

1. ☐ `GET /config`.
   - ✅ *(API)* 2xx.
   - ✅ *(API)* `config.mdm` is defined.

**Assessment**
- *Value:* very low — `toBeDefined()` on a container key. It would only fail if Fleet renamed/removed the whole `mdm` subtree.
- *Coverage gaps:* nothing about `mdm.enabled_and_configured`, `apple_bm_enabled_and_configured`, or `windows_enabled_and_configured` — the flags that actually gate the MDM e2e specs and that a QA lead cares about before a run.
- *Redundancy:* duplicate `GET /config`; weakest of the three sibling tests.
- *Efficiency / smells:* browser launched via `@fixtures`; presence-only assertion is the "weak visibility-only assert" pattern in API form.

**Manual repro**
```bash
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/config" \
  | jq '{mdm_present: (.mdm != null), enabled: .mdm.enabled_and_configured, abm: .mdm.apple_bm_enabled_and_configured}'
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-18 · Free • premium-gated endpoints › `<METHOD> /<path>` → 402 + license-required message (8 generated tests)

- **File:** [`playwright/tests/api/free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts)
- **Grep:** `npx playwright test tests/api/free/endpoints.spec.ts --project=free` (single case: `-g "GET /vpp_tokens"`)
- **Project:** free only · **Mode:** API · **Isolation:** independent, parallel-safe
- **Preconditions:** free instance + admin token. Reads: `fleets`, `setup_experience/script?team_id=0`, `vpp_tokens`, `abm_tokens`. Mutations: `POST fleets`, `POST teams`, `PATCH fleets/1`, `DELETE fleets/1`
- **Data created:** none — every request is rejected before the handler runs (this is what makes the mutation cases safe)

**Flow**

1. ☐ For each of the 8 cases, issue the request with `authHeaders()` (admin, so this isolates *license* gating from *role* gating).
   - ✅ *(API)* status is exactly **402**.
   - ✅ *(API)* `body.message === 'Requires Fleet Premium license'`.
   - ✅ *(API)* `body.errors` contains `{ name: 'base', reason: 'Requires Fleet Premium license' }`.

**Assessment**
- *Value:* **meaningful, not trivial.** Three real regressions are in scope: a premium endpoint becoming reachable on free (a licensing defect), the status drifting from 402 to 401/403/404 (breaks every client's paywall handling), and the license-specific error degrading to a generic one (the UI paywall copy is driven off it). Asserting the exact status *and* the error body — including the `errors[]` shape — is the right depth, and using an admin token is what makes it a license test rather than a permissions test.
- *Coverage gaps:* four read + four write endpoints out of a much larger premium surface — nothing for `/mdm/profiles`, `/scripts` (team-scoped), `/software/titles` premium filters, `/calendar`, `/conditional_access`, `/integrations/*`, `/vulnerabilities`, `/hosts/:id/lock|wipe`. No unauthenticated case (does an anonymous call 401 or 402? — ordering of middleware is unasserted). No positive control that the *same* endpoints answer 2xx on premium, so a global 402 would look like success here.
- *Redundancy:* partial with [`tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts) (18 UI paywall pages) — different layer, same feature gate; that spec would not catch a 402→403 status drift, and this one would not catch a missing banner. Keep both. No overlap with `tests/api/role-access/free/` (that asserts role, never license — `402` appears nowhere in it).
- *Efficiency / smells:* `@fixtures` import → 8 needless Chromium launches (see API-15). `PATCH/DELETE fleets/1` assume the license check precedes existence checks; that holds today but the test would silently start asserting a 402-shaped 404 story if middleware order changed — a comment would help.

**Manual repro**
```bash
for p in fleets vpp_tokens abm_tokens "setup_experience/script?team_id=0"; do
  curl -sk -o /dev/null -w "GET $p -> %{http_code}\n" -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/$p"; done
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" -d '{"name":"free-tier-attempt"}' "$FLEET_URL/api/v1/fleet/teams" | jq
# expect: 402 for every read, and body {"message":"Requires Fleet Premium license","errors":[{"name":"base","reason":"Requires Fleet Premium license"}]}
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-19 · Free • license › license tier is free

- **File:** [`playwright/tests/api/free/license.spec.ts`](../../tests/api/free/license.spec.ts)
- **Grep:** `npx playwright test tests/api/free/license.spec.ts --project=free -g "license tier is free"` (the file also holds API-31 and API-32)
- **Project:** free only · **Mode:** API · **Isolation:** read-only
- **Preconditions:** free instance + token · **Data created:** none

**Flow**

1. ☐ `GET /config`.
   - ✅ *(API)* 2xx.
   - ✅ *(API)* `license.tier === 'free'`.

**Assessment**
- *Value:* **trivial as a product test, load-bearing as an environment guard.** It cannot catch a Fleet defect; what it catches is "someone applied a premium license to the free QA instance", which would otherwise surface as a confusing cascade of free-tier failures (paywalls missing, API-18 red, free copy branches wrong). One line, instant, clear message — worth keeping, but it should be understood as a precondition assertion, not coverage.
- *Coverage gaps:* no premium mirror — nothing anywhere asserts `license.tier === 'premium'` or a non-expired `license.expiration`, so an expired premium license on the premium instance fails late and obscurely instead of once and loudly.
- *Redundancy:* fourth `GET /config` in this area (API-15/16/17); conceptually the precondition that API-18 already implies.
- *Efficiency / smells:* `@fixtures` import → browser launch (see API-15).

**Manual repro**
```bash
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/config" | jq '.license'
# expect on the free instance: { "tier": "free", ... }
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-20 · Premium • API • max request/file sizes › a script over 500,000 characters is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "500,000 characters"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent; creates nothing so no cleanup
- **Preconditions:** premium instance + admin token · **Data created:** none (rejected)

**Flow**

1. ☐ Generate a script body in memory: `#!/bin/sh\n# ` + 500,001 `a` characters (~500 KB — a **genuinely oversized** payload, not a token one).
2. ☐ `POST /api/v1/fleet/scripts` as multipart with field `script`, filename `pw-oversized.sh`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `Script is too large` — the size-specific message, so a generic 400 (bad multipart, auth failure) cannot pass.

**Assessment**
- *Value:* real. This is Fleet's per-script **business** limit (handler-level, distinct from the request-size middleware in API-21/22), and the payload really is over the line, so the test exercises the limit rather than mocking it. The message assertion is what gives it teeth.
- *Coverage gaps:* no positive control — nothing uploads a just-under-limit script and expects 2xx, so a misconfiguration that rejected *all* scripts would pass here (the scripts-library e2e spec does upload a small script, which partially covers it, but on a different instance state). Also no boundary case at exactly 500,000, and no team-scoped (`team_id`) variant. **API-24 now shows how a safe positive control is built** (under-limit body, unroutable target), and the same trick has no analogue here — a valid small script would persist, which is exactly what this spec avoids.
- *Redundancy:* none in this area.
- *Efficiency / smells:* `expect(res.status()).toBeGreaterThanOrEqual(400)` ([`max-request-file-sizes.spec.ts:31`](../../tests/api/premium/max-request-file-sizes.spec.ts)) tolerates 401/403/500 — pin the exact status Fleet returns. `@fixtures` import → needless browser launch (see API-15). Tier placement is questionable: script size limits are not premium-only, so this belongs in `tests/api/` root and currently never runs on free.

**Manual repro**
```bash
dd if=/dev/zero bs=1 count=500001 2>/dev/null | tr '\0' a \
  | curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
      -F "script=@-;filename=pw-oversized.sh" "$FLEET_URL/api/v1/fleet/scripts"
# expect: 4xx with a body containing "Script is too large"; no new script in Controls → Scripts
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-21 · … › a configuration profile over the 1.573MB request limit is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "1.573MB"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent; creates nothing
- **Preconditions:** premium instance + admin token · **Data created:** none (rejected)

**Flow**

1. ☐ Allocate a 2 MB buffer of `a` in memory (over the 1.573 MB request-body cap; content need not be valid `.mobileconfig` because the middleware rejects before parsing).
2. ☐ `POST /api/v1/fleet/mdm/profiles` as multipart with `team_id=0` and field `profile`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `max size limit of 1.573MB`.

**Assessment**
- *Value:* genuinely exercises the request-body-size middleware with a real 2 MB upload, and the exact-limit string in the message means a change in Fleet's cap (or its wording) is caught rather than absorbed.
- *Coverage gaps:* no positive control (a valid small profile uploading successfully is covered only by the os-settings e2e specs); no boundary case just under 1.573 MB; nothing asserts *nothing was persisted* — the "no cleanup needed" claim is inferred from the rejection, not verified by a follow-up `GET /mdm/profiles`.
- *Redundancy:* shares the middleware under test with API-22, **API-23, API-25 and API-26** — five entries now exercise the same request-body-size middleware at three caps across five routes. Any one of them catches a middleware-wide regression; the other four only catch a per-route cap change.
- *Efficiency / smells:* loose `>= 400` ([line 52](../../tests/api/premium/max-request-file-sizes.spec.ts)); `@fixtures` → browser launch; request-size middleware is tier-agnostic, so `tests/api/premium/` placement means free never checks it.

**Manual repro**
```bash
dd if=/dev/zero bs=1m count=2 2>/dev/null | tr '\0' a \
  | curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
      -F "team_id=0" -F "profile=@-;filename=pw-oversized.mobileconfig" \
      "$FLEET_URL/api/v1/fleet/mdm/profiles"
# expect: 4xx containing "max size limit of 1.573MB"; Controls → OS settings shows no new profile
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-22 · … › an EULA PDF over the 26.21MB request limit is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "26.21MB"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent; creates nothing
- **Preconditions:** premium instance + admin token · **Data created:** none (rejected)

**Flow**

1. ☐ Build a 27 MB buffer: `%PDF-1.7\n` + 27 MiB of `a` (over the 26.21 MB / 25 MiB cap).
2. ☐ `POST /api/v1/fleet/setup_experience/eula` as multipart with field `eula`, filename `pw-oversized.pdf`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `max size limit of 26.21MB`.

**Assessment**
- *Value:* same middleware as API-21 at a different cap, and it does push a real 27 MB body over the wire.
- *Coverage gaps:* no positive control; no boundary case; no verification that no EULA was persisted (`GET /setup_experience/eula/metadata` would settle it — relevant because a stray EULA changes the DEP setup-experience e2e specs).
- *Redundancy:* **API-25 and API-26 now assert the identical 26.21 MB cap and the identical message string** on two other routes, so this entry is one of three claims about one number. API-21 already covers the middleware itself; the marginal regression each of the three adds is "this route's cap changed".
- *Efficiency / smells:* uploads ~27 MB per run (×2 CI retries on failure) against the shared QA instance for one string assertion — and it is no longer alone: API-25 and API-26 each push a comparable body for the same assertion, so the 26.21 MB cap costs ~90 MB per run to verify three times. Loose `>= 400` ([line 76](../../tests/api/premium/max-request-file-sizes.spec.ts)); `@fixtures` → browser launch.

**Manual repro**
```bash
{ printf '%%PDF-1.7\n'; dd if=/dev/zero bs=1m count=27 2>/dev/null | tr '\0' a; } \
  | curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
      -F "eula=@-;filename=pw-oversized.pdf" "$FLEET_URL/api/v1/fleet/setup_experience/eula"
# expect: 4xx containing "max size limit of 26.21MB"
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/setup_experience/eula/metadata" | jq
# expect: 404 / no EULA — proving the rejected upload persisted nothing
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-23 · … › an MDM command over the 2.097MB request limit is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) (L104)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "an MDM command over the"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent; creates nothing so no cleanup
- **Preconditions:** premium instance + admin token · **Data created:** none (rejected on size, before any handler runs)

**Flow**

1. ☐ Allocate 3 MiB of `a` in memory and base64-encode it — the command travels base64 inside the JSON body, so the encoded string is what has to clear the 2.097 MB (2 MiB) cap. Generated at run time; nothing is committed.
2. ☐ `POST /api/v1/fleet/commands/run` with JSON `{ command: <base64>, host_uuids: ['00000000-0000-4000-8000-000000000000'] }`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `max size limit of 2.097MB` — the size-specific message, sourced from `MaxMDMCommandSize` in `server/fleet/request.go` and formatted by `units.HumanSize` in `server/platform/http/errors.go` (hence a MiB value rendered in MB).

**Assessment**
- *Value:* the only coverage of `POST /commands/run`'s body cap, and the cap that is easiest to break by accident — it is the one route here whose payload is base64, so a change in encoding shifts the effective limit by a third without anyone touching the constant. Paired with API-24 it is the area's only rejected/accepted **boundary pair**, which is worth more than either half alone.
- *Coverage gaps:* no case at exactly 2.097 MB; nothing asserts the command was not queued (inferred from the rejection and from the unroutable UUID, not verified); the `host_uuids` array is never exercised with more than one target, and a per-target multiplier on the body size would not be caught.
- *Redundancy:* same middleware as API-21/22/25/26, third distinct cap. The one genuinely new claim is the 2.097 MB number.
- *Efficiency / smells:* loose `expect(res.status()).toBeGreaterThanOrEqual(400)` ([line 114](../../tests/api/premium/max-request-file-sizes.spec.ts)) — API-24, ten lines below, pins `toBe(404)` for its own case, so the file is inconsistent with itself about how precise a status assertion should be. `@fixtures` import → a Chromium launch this test never uses. Tier placement is wrong in the same way as API-20…API-22: the request-size middleware is not premium-gated, but `POST /commands/run` reaches MDM, which on free is a different question — worth a verdict rather than an assumption.

**Manual repro**
```bash
python3 -c "import base64,sys; sys.stdout.write(base64.b64encode(b'a'*3*1024*1024).decode())" > /tmp/cmd.b64
jq -n --rawfile c /tmp/cmd.b64 '{command:$c, host_uuids:["00000000-0000-4000-8000-000000000000"]}' \
  | curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" -H 'Content-Type: application/json' \
      -d @- "$FLEET_URL/api/v1/fleet/commands/run"
# expect: 4xx containing "max size limit of 2.097MB"
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-24 · … › an MDM command under the limit gets past the size gate

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) (L118)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "under the limit gets past the size gate"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent
- **Preconditions:** premium instance + admin token · **Data created:** **none, by construction** — the target UUID `00000000-0000-4000-8000-000000000000` is syntactically valid and belongs to no host, so Fleet has nothing to queue the command against

**Flow**

1. ☐ Allocate 1 MiB of `a` and base64-encode it (~1.4 MB encoded — comfortably inside the 2.097 MB cap). Generated at run time.
2. ☐ `POST /api/v1/fleet/commands/run` with that body and the unknown host UUID.
   - ✅ *(API)* The response text does **not** contain `max size limit` — the actual point of the test: the request cleared the size gate.
   - ✅ *(API)* status is exactly **404** (not `>= 400` — this is the file's one precise status assertion).
   - ✅ *(API)* response text contains `No hosts targeted` — Fleet's *own handler* answering about the target, which is the proof the body was read in full, because the size middleware never reaches the handler.

**Assessment**
- *Value:* the highest-value entry in this spec, and the only **positive control** in the whole size-limit group. Without it, a regression that set every cap to zero would pass API-20…API-23, API-25 and API-26 — six green tests proving only that Fleet rejects things. The `No hosts targeted` assertion is what makes it airtight: it is a message only the handler can emit, so "got past the gate" is proven rather than inferred from the absence of an error string.
- *Coverage gaps:* it proves the gate is not set *too low*, not that it is set *exactly* right — a cap raised to 200 MB passes this and API-23 both (3 MiB would still exceed a 2.097 MB cap, but a cap of e.g. 4 MiB would fail API-23, so the pair does bracket the value to within one order of magnitude, no more). No equivalent positive control exists for profiles, EULA, batch profiles or batch scripts; the spec header explains why (each would persist something), but `POST /mdm/profiles` with an invalid-but-small `.mobileconfig` would fail on parsing rather than size, which is the same trick and is not used.
- *Redundancy:* none — it is the inverse of API-23 and the two belong together.
- *Efficiency / smells:* `@fixtures` → unused browser launch. The three assertions are ordered body-then-status, so a 500 with an unexpected body reports the *body* mismatch first, which reads oddly in a failure trace but is otherwise harmless. Naming `UNKNOWN_HOST_UUID` as a module constant is right; it deserves the same treatment in any future positive control.

**Manual repro**
```bash
python3 -c "import base64,sys; sys.stdout.write(base64.b64encode(b'a'*1024*1024).decode())" > /tmp/cmd-ok.b64
jq -n --rawfile c /tmp/cmd-ok.b64 '{command:$c, host_uuids:["00000000-0000-4000-8000-000000000000"]}' \
  | curl -sk -i -H "Authorization: Bearer $FLEET_API_TOKEN" -H 'Content-Type: application/json' \
      -d @- "$FLEET_URL/api/v1/fleet/commands/run"
# expect: HTTP 404, body containing "No hosts targeted" and NOT "max size limit"
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-25 · … › a batch of configuration profiles over the 26.21MB request limit is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) (L139)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "a batch of configuration profiles over"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent
- **Preconditions:** premium instance + admin token · **Data created:** none — the middleware rejects before any profile is parsed, so nothing is written to `fleet_id=0`

**Flow**

1. ☐ Build 7 MiB of `a`, base64-encode it, and repeat it across **5** array entries — 35 MiB of body, over the 26.21 MB (25 MiB) cap. Generated at run time.
2. ☐ `POST /api/v1/fleet/configuration_profiles/batch?team_id=0` with JSON `{ profiles: [{profile}, … ×5] }`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `max size limit of 26.21MB` (cap from `MaxBatchProfileSize`).

**Assessment**
- *Value:* moderate, with one property the single-file cases lack — it is the only entry where the limit applies to an **aggregate** rather than one file, which is the shape a real gitops apply takes. `configuration_profiles/batch` is also **destructive by design** (it replaces a fleet's whole profile set), so the size gate is genuinely load-bearing for safety here, not just a resource guard.
- *Coverage gaps:* no positive control — and unlike API-24's, a safe one is hard, because any request that clears the gate replaces the fleet's profiles. Nothing asserts the fleet's existing profiles survived (a follow-up `GET /mdm/profiles?team_id=0` would settle it, and the destructive nature of the route makes that check more valuable here than anywhere else in the file). No case where the individual entries are each small but the array is long, which is the aggregate-limit bug a batch route actually has.
- *Redundancy:* the **same cap and the same asserted string** as API-22 and API-26. Three routes, one number.
- *Efficiency / smells:* ~35 MiB pushed per run for one string. Loose `>= 400`. `@fixtures` → unused browser launch. `team_id: '0'` is passed as a query param here while API-21 passes it as a multipart field for the single-profile route — correct per Fleet's API, but worth noting when reproducing by hand.

**Manual repro**
```bash
python3 - <<'PY' > /tmp/batch-profiles.json
import base64, json
p = base64.b64encode(b'a' * 7 * 1024 * 1024).decode()
print(json.dumps({"profiles": [{"profile": p} for _ in range(5)]}))
PY
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" -H 'Content-Type: application/json' \
  -d @/tmp/batch-profiles.json "$FLEET_URL/api/v1/fleet/configuration_profiles/batch?team_id=0"
# expect: 4xx containing "max size limit of 26.21MB"
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/mdm/profiles?team_id=0" | jq '.profiles | length'
# expect: unchanged — proving the rejected batch replaced nothing
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-26 · … › a batch of scripts over the 26.21MB request limit is rejected

- **File:** [`playwright/tests/api/premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) (L156)
- **Grep:** `npx playwright test tests/api/premium/max-request-file-sizes.spec.ts --project=premium -g "a batch of scripts over"`
- **Project:** premium only · **Mode:** API · **Isolation:** independent
- **Preconditions:** premium instance + admin token · **Data created:** none — rejected on size

**Flow**

1. ☐ Build `#!/bin/sh\n# ` + 6 MiB of `a`, base64-encode it, and repeat it across **5** named entries (`pw-oversized-0.sh` … `-4.sh`) — ~30 MiB of body, over the 26.21 MB cap. Generated at run time.
2. ☐ `POST /api/v1/fleet/scripts/batch?team_id=0` with JSON `{ scripts: [{name, script_contents}, … ×5] }`.
   - ✅ *(API)* status ≥ 400.
   - ✅ *(API)* response text contains `max size limit of 26.21MB` (cap from `MaxBatchScriptSize`).

**Assessment**
- *Value:* the **safety argument is the value here**, and the spec says so outright: batch-setting scripts *replaces* a fleet's entire script set, so a request that got through would wipe `fleet_id=0`'s scripts on a shared QA instance. The assertion that it is refused on size is what makes the case safe to run at all. As a *contract* test it adds one number to a cap already asserted twice.
- *Coverage gaps:* nothing verifies the fleet's scripts survived — the same follow-up `GET /scripts?team_id=0` that API-25 wants, and for the same reason. No per-script business-limit interaction: API-20 proves a single script over 500,000 characters is refused by the handler, but nothing checks what a *batch* of individually-oversized-but-collectively-small scripts does, which is the interesting boundary between the two limits.
- *Redundancy:* **highest in the area.** Same cap, same message, same middleware as API-22 and API-25. If one of the three is cut, this is the one whose contract value is most covered elsewhere — though it is also the one whose *safety* framing argues hardest for keeping it.
- *Efficiency / smells:* ~30 MiB per run. Loose `>= 400`. `@fixtures` → unused browser launch. Note the padding is built with `'a'.repeat(6 * MIB)` inside a template literal and *then* base64-encoded, so the wire payload is ~4/3 of the nominal figure — the comment's "25MiB ceiling" arithmetic is about the cap, not the body, which is easy to misread.

**Manual repro**
```bash
python3 - <<'PY' > /tmp/batch-scripts.json
import base64, json
s = base64.b64encode(b'#!/bin/sh\n# ' + b'a' * 6 * 1024 * 1024).decode()
print(json.dumps({"scripts": [{"name": f"pw-oversized-{i}.sh", "script_contents": s} for i in range(5)]}))
PY
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" -H 'Content-Type: application/json' \
  -d @/tmp/batch-scripts.json "$FLEET_URL/api/v1/fleet/scripts/batch?team_id=0"
# expect: 4xx containing "max size limit of 26.21MB"
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/scripts?team_id=0" | jq '.scripts | length'
# expect: unchanged — a batch that got through would have replaced the whole set
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-27 · API • host by identifier › `exclude_software` drops the software list and nothing else

- **File:** [`playwright/tests/api/host-software-payload.spec.ts`](../../tests/api/host-software-payload.spec.ts)
- **Grep:** `npx playwright test tests/api/host-software-payload.spec.ts --project=premium -g "exclude_software drops the software list"` (swap `--project=free` for the other tier)
- **Project:** **both** — the spec sits at the root of `tests/api/`, so premium *and* free pick it up
- **Mode:** API · **Isolation:** independent, read-only (three GETs, no mutation)
- **Preconditions:** at least one of the first 50 hosts (by display name, ascending) reports software — otherwise `test.skip('no host on this instance reports software')`. The resolved host must also have a non-empty `hostname`, asserted explicitly because it is the lookup key for the next two calls.
- **Data created:** none

**Why it is tier-agnostic:** `exclude_software` is not premium-gated. The parameter, the endpoint and
the payload are identical on free, so filing it under `tests/api/premium/` would have left free with
no coverage of either — the mistake API-20…API-26 all make. The spec's header states this
explicitly, and it is the one placement decision in this area that is unambiguously right.

**Flow**

1. ☐ `GET /api/v1/fleet/hosts?per_page=50&order_key=display_name&order_direction=asc`, then `GET /hosts/:id/software?per_page=1` per candidate until one reports software — `findHostWithSoftware` ([`helpers/api/hosts.ts:77`](../../helpers/api/hosts.ts)). **Skips** if none of the 50 does.
2. ☐ `GET /api/v1/fleet/hosts/:id` to read that host's `hostname`.
   - ✅ *(API)* Response is OK.
   - ✅ *(API)* `hostname` is truthy — *"the resolved host must have a hostname to look up by"*.
3. ☐ `GET /api/v1/fleet/hosts/identifier/<url-encoded hostname>` — the full payload.
   - ✅ *(API)* Response is OK.
   - ✅ *(API)* `host.hostname` equals the hostname looked up — i.e. the identifier resolved to the same host.
   - ✅ *(API)* `host.software.length > 0` — the **precondition guard**: without it the next assertion would be vacuous on a host that reports nothing.
4. ☐ `GET /api/v1/fleet/hosts/identifier/<same>?exclude_software=true` — the trimmed payload.
   - ✅ *(API)* Response is OK.
   - ✅ *(API)* `host.software.length === 0` (treating a missing key as 0).
   - ✅ *(API)* Six identity fields are **unchanged**: `id`, `uuid`, `hostname`, `hardware_serial`, `platform`, `team_id` — each with its own failure message naming the field.
   - ✅ *(API)* `Object.keys(trimmed).sort()` equals `Object.keys(full).sort()` — every key the full payload carries is still present. The parameter **empties** `software`; it does not thin the response out.

**Assessment**
- *Value:* high for its size. This is a narrow contract that is easy to break in exactly one direction — an optimisation that skips loading software also skipping something *else* it happened to be joined to — and the key-set comparison is precisely the assertion that catches that, which no hand-written field list would. Grounded in `server/service/hosts.go` (`hostByIdentifierRequest.ExcludeSoftware` → `fleet.HostDetailOptions{ExcludeSoftware}`), so the reviewer can check the test against the code path rather than against a guess. It is also the only entry in this area that covers a **query parameter's** behaviour rather than a payload shape or a status code.
- *Coverage gaps:* one host, chosen by whatever sorts first with software — a platform-specific difference in what `exclude_software` drops would be invisible. Only `/hosts/identifier/:identifier` is covered; `GET /hosts/:id` takes the same parameter and is not tested with it. No `exclude_software=false` case (the explicit-negative should behave as the default). No assertion that the trimmed response is actually *smaller* — the stated motivation is payload size and nothing measures it, which one `Content-Length` comparison would fix. Nothing checks `software_updated_at` or the `software` key's *type* (an empty array vs `null` are both accepted by `?.length ?? 0`).
- *Redundancy:* none anywhere in the suite — no e2e or gitops-verify spec touches this parameter.
- *Efficiency / smells:*
  - **The structural-not-deep comparison is the right call and is documented as such.** The two payloads are fetched seconds apart from a live host, so `detail_updated_at`, `seen_time` and `percent_disk_space_available` legitimately differ; the source QA Wolf flow used deep equality and would fail on any host that checked in mid-test. Worth preserving that reasoning if anyone tries to "strengthen" this back to `toEqual`.
  - `findHostWithSoftware` scans up to 50 hosts with one extra request each — up to 51 requests before the test starts, and it returns `null` (→ skip) on **any** non-OK response rather than failing. Same silent-skip shape flagged for `findHostByPlatform` in area 07.
  - `@fixtures` import → an unused Chromium launch, the fifth spec in this area to pay for one.
  - The host is drawn from the **ascending** display-name ordering, which is where the read-only pickers all draw from — so it can collide with a host another spec is mutating from the same end only if that spec ignores the documented offset convention.

**Manual repro**
```bash
H=$(curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/v1/fleet/hosts?per_page=50&order_key=display_name&order_direction=asc" \
  | jq -r '.hosts[0].hostname')
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/v1/fleet/hosts/identifier/$H" | jq '{n: (.host.software | length), keys: (.host | keys | length)}'
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/v1/fleet/hosts/identifier/$H?exclude_software=true" | jq '{n: (.host.software | length), keys: (.host | keys | length)}'
# expect: software length > 0 then 0; the key count identical in both
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-28 · activityCopy › script runs — one host, this host, a batch

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) (L45)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "script runs"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build the three run builders and test each against its literal.
   - ✅ *(UNIT)* `script.ran({ name: 'x.sh', host: 'mac (1)' })` → `ran the x.sh script on mac (1).` — the dashboard feed's wording, host named; the `(1)` checks `esc()` on a host name with parentheses.
   - ✅ *(UNIT)* `script.ranOnThisHost({ name: 'x.sh' })` → `ran the x.sh script on this host.` — the host's own Activity card, host implied.
   - ✅ *(UNIT)* `script.ranBatch({ hostCount: 3 })` → `ran the x.sh script on 3 hosts.`
   - ✅ *(UNIT)* `script.ranBatch({ hostCount: 1 })` → `ran the x.sh script on 1 host.` — the `hosts?` singular branch.

**Assessment**
- *Value:* moderate. The three sentences differ only in their tail, and the e2e consumers pick among them by entry point — [HOST-19/20](02-hosts-shared-and-free.md) use `ran` (feed) and `ranOnThisHost` (Activity card), [CTL-24](11-controls-profiles-scripts-variables.md) uses `ranBatch`. The singular/plural case is the one a hand edit would most plausibly break.
- *Coverage gaps:* **no negative assertion** — nothing proves `ranOnThisHost` rejects the feed sentence, or that `ranBatch({ hostCount: 3 })` rejects `on 1 host.`, so a builder loosened to `.*` in its tail would still pass. None of the builders is anchored with `^`, so any sentence *containing* the phrase matches — relevant because the feed prefixes the actor. The `ranBatch` singular branch is never used by a consumer (CTL-24 always passes 3).
- *Redundancy:* none — new builders. Shares `esc()` with every other family (API-13).
- *Efficiency / smells:* the builders' JSDoc says failed and timed-out runs read the same as successful ones in the feed; that is a real product fact the e2e specs rely on (HOST-20 clicks a failed run through `ranOnThisHost`), and nothing here pins it — it would take a Fleet call to.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-29 · activityCopy › mdmCommand.* — feed, this host, and the command item

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) (L56)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "mdmCommand"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build the three custom-MDM-command builders for `requestType: 'UserList'`.
   - ✅ *(UNIT)* `mdmCommand.ran({ host: 'mac (1)' })` → `ran UserList as a custom MDM command on mac (1).` — dashboard feed.
   - ✅ *(UNIT)* `mdmCommand.ranOnThisHost()` → `ran UserList as a custom MDM command on this host.` — host Activity card, "Show MDM commands" **off**.
   - ✅ *(UNIT)* `mdmCommand.acknowledged()` → matches `The UserList command was acknowledged. less than a minute ago` — the command item with "Show MDM commands" **on**. The literal carries the **relative-time suffix** on purpose: an Activity-card item's accessible name is its sentence *plus* the time, and this builder is anchored with `^` at the start only, so it must tolerate the tail.

**Assessment**
- *Value:* moderate. The only consumer is [HOST-23](02-hosts-shared-and-free.md), which uses all three; `acknowledged` is the one builder in the file whose literal models the accessible name as rendered (sentence + time), which is the right shape for `getByRole('button', { name })` matching.
- *Coverage gaps:* no negative case, and the interesting one is obvious — `acknowledged` must **not** match the pending sentence (`The UserList command is pending.`); HOST-23 asserts that absence with an inline regex instead of a builder, so a `pending` builder plus a mutual-exclusion test would move that copy under this file's protection. No request type with a Fleet-friendly name (the builders assume a type "Fleet has no friendly name for renders as itself" — a type that *has* one would render differently, untested). No failed/Error command sentence.
- *Redundancy:* none.
- *Efficiency / smells:* the `^` anchor on `acknowledged` alone is inconsistent with its two siblings (unanchored) — deliberate (the command item has no actor prefix), but undocumented in the spec.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-30 · activityCopy › hostSoftware.* — installed / uninstalled, failed and upcoming

- **File:** [`playwright/tests/api/activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) (L65)
- **Grep:** `npx playwright test tests/api/activity-copy.spec.ts --project=premium -g "hostSoftware"`
- **Project:** premium + free · **Mode:** UNIT · **Isolation:** none needed
- **Preconditions:** none · **Data created:** none

**Flow**

1. ☐ Build four of the six host-software builders for `title: 'fleet-pw (x64)'` and test each against an **actor-prefixed** literal (`admin …`) — the builders deliberately leave the actor out, since an admin's run names the admin and an automatic one names Fleet.
   - ✅ *(UNIT)* `installed` → `admin installed fleet-pw (x64) on this host.`
   - ✅ *(UNIT)* `uninstalled` → `admin uninstalled fleet-pw (x64) on this host.`
   - ✅ *(UNIT)* `failedToUninstall` → `admin failed to uninstall fleet-pw (x64) on this host.`
   - ✅ *(UNIT)* `toldToInstall` → `admin told Fleet to install fleet-pw (x64) on this host.` — the **Upcoming**-tab wording.
   - ✅ *(UNIT)* **negative:** `installed` does **not** match `admin uninstalled fleet-pw (x64) on this host.` — an uninstall's sentence *contains* "installed", and the builder's leading `\b` is what keeps the install matcher from taking it.

**Assessment**
- *Value:* good — the negative case is the one that matters for this family (substring collision between install/uninstall), and it copies API-14's pattern. The `(x64)` title exercises `esc()` on a real-looking package title.
- *Coverage gaps:* **`failedToInstall` and `toldToUninstall` are never tested** — two of six builders; `failedToInstall` is also unused by any e2e spec. `toldToInstall` is tested here but **consumed nowhere**: the Upcoming item is never asserted in the UI (a queued install is picked up within seconds), so this test protects a builder no spec uses. No negative between `failedToUninstall` and `uninstalled` (the latter's `uninstalled … on this host.` does not occur inside "failed to uninstall …", so it holds — but untested), nor between `toldToInstall` and `installed`.
- *Redundancy:* none. Consumers: [`premium/software/software-lifecycle-on-host`](../../tests/e2e/premium/software/software-lifecycle-on-host.spec.ts) (`installed`, `uninstalled`), [`premium/software/install-on-host`](../../tests/e2e/premium/software/install-on-host.spec.ts) (`installed`) and [`premium/software/uninstall-from-host`](../../tests/e2e/premium/software/uninstall-from-host.spec.ts) (`failedToUninstall`) — all premium-only, yet this test also runs on free.
- *Efficiency / smells:* the JSDoc cites `INSTALL_STATUS_PREDICATES` in `frontend/interfaces/software.ts` rather than a component line — a better citation than the `GlobalActivityItem.tsx:<line>` ones elsewhere in the helper, which drift (see API-03).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-31 · Free • license › setting or removing a host IdP username is refused with 402

- **File:** [`playwright/tests/api/free/license.spec.ts`](../../tests/api/free/license.spec.ts)
- **Grep:** `npx playwright test tests/api/free/license.spec.ts --project=free -g "host IdP username"`
- **Project:** free only · **Mode:** API · **Isolation:** independent; both writes are expected to be refused
- **Preconditions:** free instance + admin token; an online **non-MDM simulated** Windows host (`findSimulations(request, 'windows', 1, 0)`) — a simulation, so that if the license check ever regressed, no real VM's end user would be written
- **Data created:** none while the gate holds. If it regressed, the `PUT` would leave a `pw-idp-free-<ts>@example.com` IdP username on the host — nothing removes it, and [HOST-24](02-hosts-shared-and-free.md), on the same host, would then fail its `---` check as well.

**Flow**

1. ☐ Resolve the host.
   - ✅ *(API)* a host was resolved (`toBeDefined`).
2. ☐ `PUT /hosts/:id/device_mapping` with `{ "email": "pw-idp-free-<ts>@example.com", "source": "idp" }`.
   - ✅ *(API)* status is exactly **402**, and the body's `message` is `Requires Fleet Premium license`.
   - ✅ *(API)* `GET /hosts/:id` reports no IdP username — the write didn't land.
3. ☐ `DELETE /hosts/:id/device_mapping/idp`.
   - ✅ *(API)* status is exactly **402** with the same license `message` — the license check runs before the "nothing to remove" check (premium answers 422 to the same call on a host with none, [HOSTP-14](03-hosts-premium.md)).

**Assessment**
- *Value:* the API half of HOST-24's paywall — hiding the field in the modal means nothing if the endpoint takes the write. The read-back makes it more than a status check, and the DELETE's 402-not-422 pins that the license check comes first.
- *Coverage gaps:* the body's `message` is checked, `errors[]` isn't (API-18 checks both); only `source: "idp"`; no premium positive control in this file (HOSTP-13/14 are the premium side, in the e2e tree).
- *Redundancy:* these are two more rows of API-18's table in all but form — `PUT /hosts/:id/device_mapping` and `DELETE /hosts/:id/device_mapping/idp` — kept separate because they need a host id and a read-back.
- *Efficiency / smells:* no `finally`, so a regressed gate leaves state behind (see Data created) — though on free the cleanup `DELETE` would be gated too, so there'd be little to do. Draws Windows slice 0 on free, the same host as HOST-24 (recorded in `findSimulations`' slice list, `helpers/api/hosts.ts`, as a read by both — true only while the gate holds). `@fixtures` import → an unused Chromium launch (see API-15).

**Manual repro**
```bash
# a simulated Windows host — not the free Windows VM (hardware model QEMU)
H=$(curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/v1/fleet/hosts?status=online&platform=windows&per_page=100" \
  | jq -r '[.hosts[] | select(.platform == "windows" and (.hardware_model | test("virtual|qemu"; "i") | not))][0].id')
curl -sk -o /dev/null -w "PUT -> %{http_code}\n" -X PUT -H "Authorization: Bearer $FLEET_API_TOKEN" \
  -H 'Content-Type: application/json' -d '{"email":"pw-idp-free@example.com","source":"idp"}' \
  "$FLEET_URL/api/v1/fleet/hosts/$H/device_mapping"
curl -sk -o /dev/null -w "DELETE -> %{http_code}\n" -X DELETE -H "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/v1/fleet/hosts/$H/device_mapping/idp"
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/hosts/$H" | jq '.host.end_users'
# expect: PUT -> 402, DELETE -> 402, and no idp_username
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### API-32 · Free • license › turning on Fleet MFA for a user is refused with 402

- **File:** [`playwright/tests/api/free/license.spec.ts`](../../tests/api/free/license.spec.ts)
- **Grep:** `npx playwright test tests/api/free/license.spec.ts --project=free -g "Fleet MFA"`
- **Project:** free only · **Mode:** API · **Isolation:** independent; creates and deletes its own user
- **Preconditions:** free instance + admin token; `FLEET_TEST_USER_PASSWORD` set (`createUser` gives the user the QA password)
- **Data created:** a global observer `qa-test-<ts>-mfa@fleetdm.com` ("QA free MFA refusal"), deleted in `finally`; the `cleanup-setup` qa-test sweep reaps it after a dead run

**Flow**

1. ☐ `POST /users/admin` — a global observer, no forced password reset (the helper asserts 2xx).
2. ☐ `PATCH /users/:id` with `{ "mfa_enabled": true }`.
   - ✅ *(API)* status is exactly **402**, and the body's `message` is `Requires Fleet Premium license`.
   - ✅ *(API)* `GET /users/:id` → `mfa_enabled` is `false` — nothing was saved.
3. ☐ *(`finally`)* `DELETE /users/:id` (a 404 is fine).

**Assessment**
- *Value:* the server-side gate behind the free user forms' missing checkbox ([USRF-05 / USRF-09](09-users-free-and-shared.md)) — hiding the checkbox is cosmetic unless the endpoint refuses too — and the read-back proves the refusal stored nothing. A throwaway user is the right target: patching a static user would change a shared account if the gate ever regressed.
- *Coverage gaps:* `message` checked, `errors[]` not (as API-31); only `PATCH` — `mfa_enabled: true` on **create** (`POST /users/admin`) is the other way in and isn't probed; no premium positive control anywhere — no spec saves `mfa_enabled: true` on premium ([USRP-34](08-users-premium.md) never ticks the box), so a 402 that spread to premium would go unnoticed at the API layer.
- *Redundancy:* pairs with USRP-34 (premium form rules) and USRF-05/09 (free form absence) — three layers of one gate, none redundant.
- *Efficiency / smells:* a user create + delete to probe one refusal — cheap, and safer than the alternative. `@fixtures` import → an unused Chromium launch (see API-15).

**Manual repro**
```bash
U=$(curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"QA free MFA refusal","email":"qa-test-1-mfa@fleetdm.com","password":"'"$FLEET_TEST_USER_PASSWORD"'","global_role":"observer","admin_forced_password_reset":false}' \
  "$FLEET_URL/api/v1/fleet/users/admin" | jq -r '.user.id')
curl -sk -o /dev/null -w "PATCH -> %{http_code}\n" -X PATCH -H "Authorization: Bearer $FLEET_API_TOKEN" \
  -H 'Content-Type: application/json' -d '{"mfa_enabled":true}' "$FLEET_URL/api/v1/fleet/users/$U"
curl -sk -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/users/$U" | jq '.user.mfa_enabled'
curl -sk -o /dev/null -X DELETE -H "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/v1/fleet/users/$U"
# expect: PATCH -> 402, then false
```

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| App config shape (`GET /config`) | API-15, API-16, API-17 | truthiness/presence only; no comparison to `FLEET_URL`; no `mdm.*_enabled_and_configured` flags; no `PATCH /config` round-trip at this layer |
| License tier | API-19 (free) | **no premium mirror** — nothing asserts `tier === 'premium'` or a future `license.expiration` |
| Premium API gating (402) | API-18 (8 endpoints), API-31 (host IdP username, set + remove), API-32 (Fleet MFA on a user) | MDM profiles, team scripts, calendars, conditional access, integrations, vulnerabilities, host lock/wipe; no unauthenticated variant; no premium positive control; API-31/32 check the status and the read-back but not the error body API-18 checks |
| Request/file-size limits | API-20…API-26 (4 caps across 6 routes) | **one** positive control (API-24, `commands/run` only) — the other five are rejection-only; no boundary case at any exact cap; no "nothing persisted" check on the two destructive batch routes; software-installer and bootstrap-package caps untested; not run on free although the middleware is tier-agnostic |
| Host payload query parameters | API-27 (`exclude_software` on `/hosts/identifier/:id`) | not tested on `GET /hosts/:id`, which takes the same parameter; no `exclude_software=false`; nothing measures that the payload is actually smaller, which is the parameter's whole purpose; one host per run |
| Activity-feed copy contract | API-01…API-14, API-28…API-30 | self-consistency only — cannot detect upstream Fleet copy change (the file's stated purpose); scope matrix incomplete where consumers rely on it (`script` add/Workstations, edit/Unassigned, delete/Unassigned; profile delete premium-Unassigned) |
| Role/permission gating | `tests/api/role-access/**` (out of scope here) | no overlap with license gating — verified, `402` appears nowhere in role-access |
| General API contract hygiene | — | nothing on `/version`, `/me`, unauthenticated 401 shape, 404/422 validation-error shape, `/activities` pagination + `order_key` (which `findActivity` depends on), or `v1` vs `latest` parity |

**Duplication**

1. **Four `GET /config` requests for four field assertions** — API-15, API-16, API-17, API-19. One request in a `beforeAll` (or one test with four `expect`s) would do.
2. **`activity-copy.spec.ts` runs twice** (premium + free) with a byte-identical result, because the only tier-sensitive tests stub `process.env.SUITE` themselves. 17 duplicate executions per nightly pair.
3. **Five entries share one middleware, and three share one number.** API-21, API-22, API-23, API-25 and API-26 all exercise the request-body-size middleware; of those, API-22, API-25 and API-26 assert the *same* `max size limit of 26.21MB` string on three different routes, at a combined ~90 MB of upload per run. Any one of the five catches a middleware regression; the other four only catch a per-route cap change.
4. **API-01 / API-02 / API-03** are three tests over one shared `fleetSuffix()`; a single table would read better and make the missing scopes obvious.
5. **API-10 / API-11** are two 3-line tests over the same `user.*` builders.
6. **API-18 vs [`free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)** — same feature gate, different layer. Genuine complement (status/body vs banner), keep both.
7. Activity copy is asserted at three layers per CRUD lifecycle: `assertActivity` (record), `expectActivities` (rendering), API-01…14 (matcher). Orthogonal, not redundant — but it does mean a copy change produces failures in up to three places.

**UI-vs-API balance**

Everything here is API by design, and that is right for tier gating, config shape, size limits and payload-shape parameters — none has a UI surface worth clicking. Two caveats. (a) The activity-copy tests are not even API: they are unit tests wearing a Playwright costume, sitting in the browser projects, consuming worker slots on a shared QA instance for pure in-process work. (b) Five of the six specs import from `@fixtures`, which activates the auto `pageHealth` fixture ([`fixtures.ts:270`](../../fixtures.ts)); it depends on `page`, so **22 API tests launch a Chromium context they never use** — `playwright/CLAUDE.md` explicitly permits `@playwright/test` here. The genuine API-instead-of-UI shortcut risk in this area is low; the genuine problem is the reverse — browser cost on browser-free tests.

**On rejection-only coverage.** Six of the seven size-limit entries assert only that Fleet refuses something, which is a deliberate design constraint rather than laziness: a rejected upload persists nothing, so the spec needs no cleanup and can run unsynchronised against a shared instance. The cost is that the set is only falsifiable in one direction — API-24 alone stands between this group and a build where every cap is zero. That single positive control is load-bearing, and the pattern it uses (an under-limit body aimed at a target that cannot exist) is the template for extending the idea to the other routes.

**Quick wins**

1. Swap `@fixtures` → `@playwright/test` in [`config.spec.ts`](../../tests/api/config.spec.ts), [`free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts), [`free/license.spec.ts`](../../tests/api/free/license.spec.ts), [`premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts), [`host-software-payload.spec.ts`](../../tests/api/host-software-payload.spec.ts) — drops 22 needless Chromium launches per run.
2. Fix the false claim in the [`activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) header ("fails before the CRUD specs do" when Fleet changes copy) — it detects *helper* edits only, and the wrong comment will mislead the next agent into trusting it.
3. Add negative assertions to the policy / script / software / profile / role families, copying API-14's pattern — today a suffix that loosened to `.*` passes every one of the 15 other tests.
4. Add a premium mirror of API-19 asserting `license.tier === 'premium'` and `license.expiration` in the future, so an expired QA license fails once and clearly instead of cascading.
5. Tighten `toBeGreaterThanOrEqual(400)` to the exact status at [`max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) lines 55, 76, 100, 114, 152 and 173 — API-24 already pins `toBe(404)` ten lines away, so the file disagrees with itself about how precise a status assertion should be.
6. Add the two "nothing was replaced" follow-ups that cost one GET each and guard the area's two **destructive** routes: `GET /mdm/profiles?team_id=0` after API-25 and `GET /scripts?team_id=0` after API-26. Today "the rejected batch wiped nothing" is inferred from the 4xx, on routes whose success path replaces an entire fleet's set.
7. Move [`host-software-payload.spec.ts`](../../tests/api/host-software-payload.spec.ts)'s pattern to `max-request-file-sizes.spec.ts` — the former is correctly tier-agnostic at the root of `tests/api/`, the latter is tier-agnostic middleware filed under `premium/` and so never runs on free.
8. Check the error body in API-31 and API-32 (`message` + `errors[]`, as API-18 does) — or move their three refusals into API-18's table with the host and user resolved in a `beforeAll`, so every 402 in the area meets one standard ([`free/license.spec.ts`](../../tests/api/free/license.spec.ts)).

**Bigger bets**

1. **Make the copy contract actually detect upstream drift.** Either vendor the relevant `GlobalActivityItem.tsx` strings from `fleetdm/fleet` as a checked-in snapshot the spec diffs against, or add a nightly job that performs one action per family and matches the *rendered* feed text — the current file cannot fail when Fleet renames copy, which is the risk it was written for.
2. **Move the 17 unit tests out of Playwright** into `npm run check` (vitest/tsx). They would gate every PR in milliseconds, stop consuming shared-instance worker slots, run once instead of twice, and no longer need `process.env.SUITE` mutation if the tier were a helper parameter.
3. **Promote the tier-agnostic contracts out of `tests/api/premium/` and build one error-contract layer** — size limits, 402/401/403/404/413/422 shapes, and `/version` `/me` liveness in one table-driven spec shared with the role-access probes, with positive controls alongside every rejection path.
