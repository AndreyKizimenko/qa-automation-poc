# API contract specs — test audit

**Specs covered:** 5 files · **Test declarations:** 22 entries (29 `test()` calls — the 8 table-driven cases in `free/endpoints.spec.ts` are one entry) · **Projects:** premium / free

This area holds the suite's non-browser contract checks: the shape of `GET /config`, the free-tier
license value, the 402 premium paywall on the API, Fleet's request/file-size limits, and a pure-unit
snapshot of the activity-feed copy helper. Folder routing decides the tier — `tests/api/*.spec.ts`
runs in **both** premium and free, `tests/api/free/` only in free, `tests/api/premium/` only in
premium ([`playwright.config.ts:151-179`](../../playwright.config.ts)).

**Reading this file.** There is no UI here, so **Flow** lists the request(s) issued and the
assertions made, and every entry carries a **Manual repro** line — the curl/`fleetctl` equivalent
Andrey can paste. All commands assume `$FLEET_URL` and `$FLEET_API_TOKEN` are exported from
`.env.premium` (or `.env.free`); `-k` covers the QA cert. Every `npx playwright test` command needs
`--project=premium` (or `--project=free`) or `SUITE=` — `resolveSuite()` throws at config load
otherwise ([`playwright.config.ts:77`](../../playwright.config.ts)).

`Mode` legend: **API** (real Fleet request, asserted on the response) · **UNIT** (no Fleet call at
all — pure in-process assertion; a fifth mode this area needs, all 14 activity-copy tests are this).

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

---

## What `activity-copy.spec.ts` actually protects (read before API-01…API-14)

[`helpers/activity-copy.ts`](../../helpers/activity-copy.ts) builds the `RegExp`s that **21 e2e
specs** feed to `dashboard.expectActivities()`
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
| `software.*` | [premium/software/library](../../tests/e2e/premium/software/library.spec.ts), [premium/software/edit-package](../../tests/e2e/premium/software/edit-package.spec.ts) | Unassigned, Workstations |
| `appStoreApp.*` | [premium/software/library](../../tests/e2e/premium/software/library.spec.ts) | Unassigned, Workstations |
| `configurationProfile.*` | [premium](../../tests/e2e/premium/controls/os-settings/configuration-profiles.spec.ts) + [free os-settings](../../tests/e2e/free/controls/os-settings/configuration-profiles.spec.ts) | Unassigned, Workstations (free: none) |
| `label.*` | [premium/labels](../../tests/e2e/premium/labels/labels.spec.ts) | n/a (global) |
| `user.*` | premium+free `settings/users/{api-user-create,regular-user-create,edit,delete}.spec.ts` (8 specs) | n/a |
| `activityAutomations.*` | [premium/dashboard/automations-activity](../../tests/e2e/premium/dashboard/automations-activity.spec.ts) | n/a |

**Is it the right layer? Partly — but its stated purpose is not what it does.** The file header
claims "when Fleet changes copy upstream this file fails before the CRUD specs do". That is **false**:
the spec makes no Fleet call and reads no Fleet source. Both sides of every assertion live in this
repo — a regex from `helpers/activity-copy.ts` and a hand-transcribed literal in the spec. If Fleet
renames "created a policy" to "added a policy", *both* stay stale and this file keeps passing while
21 e2e specs go red. What it genuinely protects is **helper-refactor regression**: change a
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

**Cost:** `tests/api/activity-copy.spec.ts` is not in any `testIgnore` list, so all 14 tests run in
**both** the premium and free projects. Because the two SUITE-sensitive tests (API-09, API-12) stub
`process.env.SUITE` themselves, the free run is byte-identical to the premium run — 14 duplicate
executions per nightly pair.

**Manual repro (applies to all of API-01…API-14).** Two levels:
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
- *Value:* article check for the global (no-scope) label copy used by [premium/labels](../../tests/e2e/premium/labels/labels.spec.ts).
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
   - ✅ *(UNIT)* `added configuration profile Fleet Test Passcode to all macOS, iOS, and iPadOS hosts.`
   - ✅ *(UNIT)* `deleted configuration profile fleet-test-screenlock from all Windows hosts.` (free ignores scope → `all <hostsPhrase>`)
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
- *Value:* the only test in the file with a negative assertion — and it matters here, because "enabled"/"disabled" are substrings of one another's context. This is the pattern the other 13 entries should copy.
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
- *Redundancy:* partial with [`tests/e2e/free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts) (17 UI paywall pages) — different layer, same feature gate; that spec would not catch a 402→403 status drift, and this one would not catch a missing banner. Keep both. No overlap with `tests/api/role-access/free/` (that asserts role, never license — `402` appears nowhere in it).
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
- **Grep:** `npx playwright test tests/api/free/license.spec.ts --project=free`
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
- *Coverage gaps:* no positive control — nothing uploads a just-under-limit script and expects 2xx, so a misconfiguration that rejected *all* scripts would pass here (the scripts-library e2e spec does upload a small script, which partially covers it, but on a different instance state). Also no boundary case at exactly 500,000, and no team-scoped (`team_id`) variant.
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
- *Redundancy:* shares the middleware under test with API-22 — one of the two would catch a middleware-wide regression; they differ only in cap and endpoint.
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
- *Redundancy:* highest in this area — API-21 already covers the middleware; the marginal regression this adds is "the EULA route's cap changed".
- *Efficiency / smells:* uploads ~27 MB per run (×2 CI retries on failure) against the shared QA instance for one string assertion — the worst cost/benefit ratio in the area. Loose `>= 400` ([line 76](../../tests/api/premium/max-request-file-sizes.spec.ts)); `@fixtures` → browser launch.

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

## Area observations

**Coverage map**

| Feature / user flow | Covered by | Gap |
|---|---|---|
| App config shape (`GET /config`) | API-15, API-16, API-17 | truthiness/presence only; no comparison to `FLEET_URL`; no `mdm.*_enabled_and_configured` flags; no `PATCH /config` round-trip at this layer |
| License tier | API-19 (free) | **no premium mirror** — nothing asserts `tier === 'premium'` or a future `license.expiration` |
| Premium API gating (402) | API-18 (8 endpoints) | MDM profiles, team scripts, calendars, conditional access, integrations, vulnerabilities, host lock/wipe; no unauthenticated variant; no premium positive control |
| Request/file-size limits | API-20, API-21, API-22 | rejection paths only — no under-limit positive control, no boundary case, no "nothing persisted" check; software-installer and bootstrap-package caps untested; not run on free although the middleware is tier-agnostic |
| Activity-feed copy contract | API-01…API-14 | self-consistency only — cannot detect upstream Fleet copy change (the file's stated purpose); scope matrix incomplete where consumers rely on it (`script` add/Workstations, edit/Unassigned, delete/Unassigned; profile delete premium-Unassigned) |
| Role/permission gating | `tests/api/role-access/**` (out of scope here) | no overlap with license gating — verified, `402` appears nowhere in role-access |
| General API contract hygiene | — | nothing on `/version`, `/me`, unauthenticated 401 shape, 404/422 validation-error shape, `/activities` pagination + `order_key` (which `findActivity` depends on), or `v1` vs `latest` parity |

**Duplication**

1. **Four `GET /config` requests for four field assertions** — API-15, API-16, API-17, API-19. One request in a `beforeAll` (or one test with four `expect`s) would do.
2. **`activity-copy.spec.ts` runs twice** (premium + free) with a byte-identical result, because the only tier-sensitive tests stub `process.env.SUITE` themselves. 14 duplicate executions per nightly pair.
3. **API-21 / API-22** exercise the same request-body-size middleware; only the cap and route differ.
4. **API-01 / API-02 / API-03** are three tests over one shared `fleetSuffix()`; a single table would read better and make the missing scopes obvious.
5. **API-10 / API-11** are two 3-line tests over the same `user.*` builders.
6. **API-18 vs [`free/paywalls.spec.ts`](../../tests/e2e/free/paywalls.spec.ts)** — same feature gate, different layer. Genuine complement (status/body vs banner), keep both.
7. Activity copy is asserted at three layers per CRUD lifecycle: `assertActivity` (record), `expectActivities` (rendering), API-01…14 (matcher). Orthogonal, not redundant — but it does mean a copy change produces failures in up to three places.

**UI-vs-API balance**

Everything here is API by design, and that is right for tier gating, config shape, and size limits — none has a UI surface worth clicking. Two caveats. (a) The activity-copy tests are not even API: they are unit tests wearing a Playwright costume, sitting in the browser projects, consuming worker slots on a shared QA instance for pure in-process work. (b) Four of the five specs import from `@fixtures`, which activates the auto `pageHealth` fixture ([`fixtures.ts:270`](../../fixtures.ts)); it depends on `page`, so **all 15 API tests launch a Chromium context they never use** — `playwright/CLAUDE.md` explicitly permits `@playwright/test` here. The genuine API-instead-of-UI shortcut risk in this area is low; the genuine problem is the reverse — browser cost on browser-free tests.

**Quick wins**

1. Swap `@fixtures` → `@playwright/test` in [`config.spec.ts`](../../tests/api/config.spec.ts), [`free/endpoints.spec.ts`](../../tests/api/free/endpoints.spec.ts), [`free/license.spec.ts`](../../tests/api/free/license.spec.ts), [`premium/max-request-file-sizes.spec.ts`](../../tests/api/premium/max-request-file-sizes.spec.ts) — drops 15 needless Chromium launches per run.
2. Fix the false claim in the [`activity-copy.spec.ts`](../../tests/api/activity-copy.spec.ts) header ("fails before the CRUD specs do" when Fleet changes copy) — it detects *helper* edits only, and the wrong comment will mislead the next agent into trusting it.
3. Add negative assertions to the policy / script / software / profile / role families, copying API-14's pattern — today a suffix that loosened to `.*` passes every one of the 13 other tests.
4. Add a premium mirror of API-19 asserting `license.tier === 'premium'` and `license.expiration` in the future, so an expired QA license fails once and clearly instead of cascading.
5. Tighten `toBeGreaterThanOrEqual(400)` to the exact status at [`max-request-file-sizes.spec.ts:31,52,76`](../../tests/api/premium/max-request-file-sizes.spec.ts) and add one under-limit positive control per endpoint.

**Bigger bets**

1. **Make the copy contract actually detect upstream drift.** Either vendor the relevant `GlobalActivityItem.tsx` strings from `fleetdm/fleet` as a checked-in snapshot the spec diffs against, or add a nightly job that performs one action per family and matches the *rendered* feed text — the current file cannot fail when Fleet renames copy, which is the risk it was written for.
2. **Move the 14 unit tests out of Playwright** into `npm run check` (vitest/tsx). They would gate every PR in milliseconds, stop consuming shared-instance worker slots, run once instead of twice, and no longer need `process.env.SUITE` mutation if the tier were a helper parameter.
3. **Promote the tier-agnostic contracts out of `tests/api/premium/` and build one error-contract layer** — size limits, 402/401/403/404/413/422 shapes, and `/version` `/me` liveness in one table-driven spec shared with the role-access probes, with positive controls alongside every rejection path.
