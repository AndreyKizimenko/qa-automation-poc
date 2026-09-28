# GitOps drift verification — test audit

**Specs covered:** 6 files · **Test declarations:** 22 · **Projects:** gitops-verify

This area answers one question: **does the live Fleet instance match the YAML in `gitops/`?**
Every spec loads a GitOps target off disk (via [`helpers/gitops-yaml.ts`](../../helpers/gitops-yaml.ts)),
issues one read-only `GET` per test, and diffs names/counts. There is no browser and no
mutation — the specs run in the `gitops-verify` project (`retries: 0`, bearer-token auth,
no `storageState`, no page objects, no `pageHealth`), and are invoked by the two nightly
orchestrators *between* `fleetctl gitops` apply steps.

## How the target is resolved

[`tests/api/gitops-verify/_config.ts`](../../tests/api/gitops-verify/_config.ts) does all of it, once per worker process:

- `GITOPS_TARGET` is resolved against **`process.cwd()`**, defaulting to `../gitops/free-fleetqa`
  (`_config.ts:14-16`). A **directory** → `loadGitOpsConfig()` (reads `default.yml`, `scope: 'no-team'`,
  `teamName: 'No team'`); a **file** → `loadFleetConfig()` (reads `fleets/<name>.yml`, `scope: 'team'`,
  `teamName: doc.name`, `labels: []`).
- `gitopsLabel` = `basename(target)` and appears in every describe title, so the same test title
  is reused across targets — grep on the test title, not the describe.
- `resolveTeamId(request)`: `no-team` → `0`; `team` → `GET /teams?per_page=200`, match `t.name === teamName`,
  **throw** if absent. Cached per process.
- `loadGitOpsConfig` flattens `path:`-referenced files (`expandList`), takes script names from the
  file **basename with extension**, macOS profile names from the top-level `<PayloadDisplayName>`
  in the `.mobileconfig` (smallest-indentation heuristic, `gitops-yaml.ts:197-224`, silently falling
  back to the basename on any read error), and Windows/Android profile names from the basename
  without extension.

## Targets in use (counts derived from the YAML)

| `GITOPS_TARGET` | Scope | Labels | Policies | Reports | Scripts | Profiles (mac/win/android) |
|---|---|---:|---:|---:|---:|---:|
| [`../gitops/free-fleetqa`](../../../gitops/free-fleetqa/default.yml) | no-team | 25 | 27 | 30 | 11 | 23 (11/10/2) |
| [`../gitops/free-fleetqa-min`](../../../gitops/free-fleetqa-min/default.yml) | no-team | 23 | 22 | 26 | 9 | 21 (11/8/2) |
| [`../gitops/premium-fleetqa`](../../../gitops/premium-fleetqa/default.yml) | no-team | 25 | 27 | 30 | 11 | 23 (11/10/2) |
| [`../gitops/premium-fleetqa/fleets/workstations.yml`](../../../gitops/premium-fleetqa/fleets/workstations.yml) | team `Workstations` | — (skipped) | 23 | 5 | 6 | 23 (11/10/2) |
| [`../gitops/premium-fleetqa-min`](../../../gitops/premium-fleetqa-min/default.yml) | no-team | 23 | 22 | 26 | 9 | 21 (11/8/2) |
| [`../gitops/premium-fleetqa-min/fleets/workstations.yml`](../../../gitops/premium-fleetqa-min/fleets/workstations.yml) | team `Workstations` | — (skipped) | 21 | 3 | 5 | 21 (11/8/2) |

Label/report counts exceed the file count because three referenced files hold multiple entries:
`lib/platforms/all/reports/dex-queries.yml` (10 reports),
`lib/labels/macs-with-fleet-maintained-apps-installed.yml` (9 labels),
`lib/labels/windows-with-fleet-maintained-apps-installed.yml` (6 labels).

Nightly chain (`.github/workflows/nightly-qa-gitops-{premium,free}.yml`, 05:00 UTC):
apply baseline → verify baseline → apply **min** → verify min. Because baseline and min differ in
every count, the pair proves gitops both **creates and deletes**; it also means the instance is
left in the *min* shape overnight.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| GV-01 | `gitops-verify/org-settings.spec.ts` | org name matches gitops | API | ☐ |
| GV-02 | `gitops-verify/org-settings.spec.ts` | SSO settings match gitops | API | ☐ |
| GV-03 | `gitops-verify/org-settings.spec.ts` | Windows MDM is enabled per gitops | API | ☐ |
| GV-04 | `gitops-verify/org-settings.spec.ts` | feature flags match gitops | API | ☐ |
| GV-05 | `gitops-verify/labels.spec.ts` | user label count matches gitops | API | ☐ |
| GV-06 | `gitops-verify/labels.spec.ts` | every gitops label exists by name | API | ☐ |
| GV-07 | `gitops-verify/labels.spec.ts` | no extra user labels on live (no superset drift) | API | ☐ |
| GV-08 | `gitops-verify/policies.spec.ts` | policy count matches gitops | API | ☐ |
| GV-09 | `gitops-verify/policies.spec.ts` | every gitops policy exists by name | API | ☐ |
| GV-10 | `gitops-verify/policies.spec.ts` | no extra policies on live (no superset drift) | API | ☐ |
| GV-11 | `gitops-verify/policies.spec.ts` | platform field matches gitops for each policy | API | ☐ |
| GV-12 | `gitops-verify/profiles.spec.ts` | total profile count matches gitops | API | ☐ |
| GV-13 | `gitops-verify/profiles.spec.ts` | per-platform profile counts match gitops | API | ☐ |
| GV-14 | `gitops-verify/profiles.spec.ts` | every gitops profile exists by name | API | ☐ |
| GV-15 | `gitops-verify/profiles.spec.ts` | no extra profiles on live (no superset drift) | API | ☐ |
| GV-16 | `gitops-verify/scripts.spec.ts` | script count matches gitops | API | ☐ |
| GV-17 | `gitops-verify/scripts.spec.ts` | every gitops script exists by basename | API | ☐ |
| GV-18 | `gitops-verify/scripts.spec.ts` | no extra scripts on live (no superset drift) | API | ☐ |
| GV-19 | `gitops-verify/reports.spec.ts` | report count matches gitops | API | ☐ |
| GV-20 | `gitops-verify/reports.spec.ts` | every gitops report exists by name | API | ☐ |
| GV-21 | `gitops-verify/reports.spec.ts` | platform field matches gitops for each report | API | ☐ |
| GV-22 | `gitops-verify/reports.spec.ts` | no extra reports on live (no superset drift) | API | ☐ |

Every entry shares these **preconditions** and **data created**, so they are not repeated below:

- **Preconditions:** `fleetctl gitops` applied for *exactly* this target immediately before, and the
  Playwright e2e suite has not run since — `setup/cleanup.steps.ts` deletes all queries (= reports),
  global + Workstations policies, profiles, and scripts, i.e. most of what these specs check.
  `FLEET_API_TOKEN` + `FLEET_URL` for the matching instance; `SUITE` must be set explicitly
  (`gitops-verify` is in `SUITE_AMBIGUOUS_PROJECTS`, `playwright.config.ts:21-25`).
- **Data created:** none. Read-only `GET`s.
- **Isolation:** independent tests, `fullyParallel: true`, `retries: 0`.

---

### GV-01 · GitOps verify · org-settings › org name matches gitops

- **File:** [`playwright/tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts)
- **Grep:** `SUITE=free GITOPS_TARGET=../gitops/free-fleetqa npx playwright test --project=gitops-verify -g "org name matches gitops"`
- **Project:** gitops-verify · **Targets:** no-team only — `test.skip(gitopsConfig.scope !== 'no-team')` at `org-settings.spec.ts:6`
- **Mode:** API

**Flow**

1. ☐ Load `default.yml` → `org_settings.org_info.org_name` (`Free QA Automation` / `Premium QA Automation` / `… (min)`).
2. ☐ `GET /api/latest/fleet/config`.
   - ✅ *(API)* Response is OK (`expect(res).toBeOK()`).
   - ✅ *(API)* `org_info.org_name` **exactly equals** the YAML value.

**Manual repro** — open `gitops/<target>/default.yml`, read `org_settings.org_info.org_name`; in the UI go to
**Settings → Organization settings → Organization info** and compare the **Organization name** field.
API equivalent: `curl -sH "Authorization: Bearer $FLEET_API_TOKEN" "$FLEET_URL/api/latest/fleet/config" | jq .org_info.org_name`.

**Assessment**
- *Value:* the single cheapest "did the right config get applied to the right instance" canary — org name differs across all four dirs, so a swapped `GITOPS_TARGET`/`SUITE` pairing fails here first.
- *Coverage gaps:* `org_info.contact_url`, `org_logo_url`, `org_logo_url_light_background` are declared in YAML and never checked.
- *Redundancy:* [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts) `org info is populated` asserts only `toBeTruthy()` — strictly weaker, no conflict.
- *Efficiency / smells:* all four tests in this file re-issue the identical `GET /config` (4 requests where 1 `beforeAll` fetch would do).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-02 · GitOps verify · org-settings › SSO settings match gitops

- **File:** [`playwright/tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts)
- **Grep:** `-g "SSO settings match gitops"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ Load `default.yml` → `org_settings.sso_settings`: `enable_sso: true`, `entity_id: fleet`, `idp_name: Okta` (all four dirs). Absent keys default to `''` / `false` in `gitops-yaml.ts:110-112`.
2. ☐ `GET /api/latest/fleet/config`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `sso_settings.enable_sso` === YAML `enable_sso === true`.
   - ✅ *(API)* `sso_settings.entity_id` === YAML `entity_id`.
   - ✅ *(API)* `sso_settings.idp_name` === YAML `idp_name`.

**Manual repro** — diff `org_settings.sso_settings` in the YAML against **Settings → Organization settings → Single sign-on options**
(Enable SSO checkbox, **Entity ID**, **Identity provider name**), or `jq .sso_settings` on `/api/latest/fleet/config`.

**Assessment**
- *Value:* catches gitops silently dropping SSO config — which would lock admins out of SSO login (a real outage on these instances, since admin SSO is assumed pre-configured).
- *Coverage gaps:* `metadata_url` (env-substituted), `enable_sso_idp_login: false`, `idp_image_url` all unchecked. `metadata_url` is the field most likely to break login.
- *Redundancy:* none.
- *Efficiency / smells:* the `?? ''` defaults mean a YAML that omits `sso_settings` asserts live `entity_id === ''` — an *inference* about gitops reset semantics, not a declaration (`gitops-yaml.ts:110-111`).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-03 · GitOps verify · org-settings › Windows MDM is enabled per gitops

- **File:** [`playwright/tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts)
- **Grep:** `-g "Windows MDM is enabled per gitops"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ Load `default.yml` → `controls.windows_enabled_and_configured` (`true` in all four dirs).
2. ☐ `GET /api/latest/fleet/config`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `mdm.windows_enabled_and_configured` === YAML value.

**Manual repro** — check `controls.windows_enabled_and_configured` in the YAML, then
**Settings → Integrations → Mobile device management → Windows MDM** ("turned on"), or
`jq .mdm.windows_enabled_and_configured`.

**Assessment**
- *Value:* Windows MDM off ⇒ every Windows profile in the same YAML silently fails to deliver, so this guards GV-12..15's premise.
- *Coverage gaps:* **`controls.android_enabled_and_configured: true`** is declared in both premium dirs and has **no check at all** — same failure mode for the two Android profiles. `mdm.enabled_and_configured` (Apple APNs) also unchecked (not gitops-declared, but it gates the 11 macOS profiles).
- *Redundancy:* `tests/api/config.spec.ts` `mdm key exists in config` only asserts the key is defined.
- *Efficiency / smells:* helper coerces with `=== true` (`gitops-yaml.ts:115`), so a YAML typo like `windows_enabled_and_configured: "true"` becomes `false` and the test asserts the *wrong* expectation without complaining.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-04 · GitOps verify · org-settings › feature flags match gitops

- **File:** [`playwright/tests/api/gitops-verify/org-settings.spec.ts`](../../tests/api/gitops-verify/org-settings.spec.ts)
- **Grep:** `-g "feature flags match gitops"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ Load `default.yml` → `org_settings.features.enable_software_inventory`, `enable_host_users` (both `true` everywhere).
2. ☐ `GET /api/latest/fleet/config`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `features.enable_software_inventory` === YAML value.
   - ✅ *(API)* `features.enable_host_users` === YAML value.

**Manual repro** — compare `org_settings.features` against the toggles under
**Settings → Organization settings → Advanced options** (host users / software inventory), or `jq .features`.

**Assessment**
- *Value:* software inventory off would gut most of the Software area's e2e specs; this is the guard that explains *why* they'd all fail.
- *Coverage gaps:* the same two flags on the **team** scope (`fleets/workstations.yml → settings.features`) are never verified — the whole file skips for team targets. `host_expiry_settings` (org and team) unchecked.
- *Redundancy:* none.
- *Efficiency / smells:* 4th duplicate `GET /config` in one file.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-05 · GitOps verify · labels › user label count matches gitops

- **File:** [`playwright/tests/api/gitops-verify/labels.spec.ts`](../../tests/api/gitops-verify/labels.spec.ts)
- **Grep:** `-g "user label count matches gitops"`
- **Project:** gitops-verify · **Targets:** no-team only — `test.skip(gitopsConfig.scope !== 'no-team', 'labels are not team-scoped')` (`labels.spec.ts:13`)
- **Mode:** API

**Flow**

1. ☐ Load `default.yml → labels[]`, flattening each `lib/labels/*.yml` (25 entries baseline, 23 min).
2. ☐ `GET /api/latest/fleet/labels`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Labels with `label_type !== 'builtin'` number **exactly** the YAML count.

**Manual repro** — count the `- name:` entries across the files listed under `labels:` in the target's
`default.yml` (remember the two FMA label files hold 9 and 6), then open **`/labels/manage`** — that page
lists *only* custom labels ([`pages/labels/LabelsPage.ts:8-11`](../../pages/labels/LabelsPage.ts)) — and compare the row count.

**Assessment**
- *Value:* the only exact-cardinality check on labels; catches both a dropped label and manual/leftover labels.
- *Coverage gaps:* label **content** — `query`, `description`, `label_membership_type: dynamic`, platform — is never compared, so a label whose query was rewritten passes.
- *Redundancy:* strictly implied by GV-06 + GV-07 together (set equality ⇒ equal cardinality). Kept as the fast-failing signal.
- *Efficiency / smells:* fragile against the rest of the suite — `setup/cleanup.steps.ts` does **not** delete labels, so an aborted `tests/e2e/premium/labels/labels.spec.ts` leaves a `playwright-*` label behind and this test fails as "drift". Also re-fetches `/labels` in all three tests.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-06 · GitOps verify · labels › every gitops label exists by name

- **File:** [`playwright/tests/api/gitops-verify/labels.spec.ts`](../../tests/api/gitops-verify/labels.spec.ts)
- **Grep:** `-g "every gitops label exists by name"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ Load the YAML label names.
2. ☐ `GET /api/latest/fleet/labels`, build a name Set from **all** labels (builtins included).
   - ✅ *(API)* Response OK.
   - ✅ *(API)* For each YAML label: name is present in the live set (message: `label "<name>" missing from API`).

**Manual repro** — subset direction only: for each `name:` in the `lib/labels/*.yml` files the target
references, search it on `/labels/manage`. Faster: `jq -r '.labels[].name' <(curl …/labels) | sort > /tmp/live`
and diff against the YAML names.

**Assessment**
- *Value:* names the specific missing label, which GV-05 cannot.
- *Coverage gaps:* subset-only — extra live labels invisible here (that is GV-07's job). No content comparison.
- *Redundancy:* overlaps GV-05 and GV-07; the three together = set equality.
- *Efficiency / smells:* the Set is built **without** filtering `builtin` (`labels.spec.ts:27`), unlike GV-05/GV-07 — a gitops label name colliding with a Fleet built-in would pass this test while the label is actually absent. Loop body is empty-safe: if `gitopsConfig.labels` were `[]` the test passes having asserted only `toBeOK()`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-07 · GitOps verify · labels › no extra user labels on live (no superset drift)

- **File:** [`playwright/tests/api/gitops-verify/labels.spec.ts`](../../tests/api/gitops-verify/labels.spec.ts)
- **Grep:** `-g "no extra user labels on live"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ Load the YAML label names into an expected Set.
2. ☐ `GET /api/latest/fleet/labels`, filter to `label_type !== 'builtin'`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* For each live custom label: name is in the expected Set (message: `live has unexpected label "<name>" not in gitops`).

**Manual repro** — the reverse diff of GV-06: read every row on `/labels/manage` and confirm each one
appears in the target's `labels:` file list. This is the direction that catches labels created by hand
in the UI or left behind by a crashed test run.

**Assessment**
- *Value:* the only superset check for labels — and the one most likely to fire, since gitops does not delete labels it never created.
- *Coverage gaps:* no content comparison; nothing distinguishes "extra label" from "label renamed" (a rename trips GV-06 *and* GV-07 with two unrelated-looking failures).
- *Redundancy:* pairs with GV-06; GV-05 is implied.
- *Efficiency / smells:* third duplicate `GET /labels` in the file. Vacuous if live has zero custom labels.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-08 · GitOps verify · policies › policy count matches gitops

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `-g "policy count matches gitops"`
- **Project:** gitops-verify · **Targets:** all six (no-team **and** team)
- **Mode:** API

**Flow**

1. ☐ `beforeAll`: `resolveTeamId()` → `0` for a directory target, or `GET /teams?per_page=200` → id of `doc.name` for a fleet file (**throws** with the list of known team names if missing).
2. ☐ Load the target's `policies[]` (27 / 22 no-team; 23 / 21 Workstations).
3. ☐ `GET /policies?per_page=200` when `teamId === 0`, else `GET /fleets/{id}/policies?per_page=200` (`policiesEndpoint`, `policies.spec.ts:23-27` — the comment records that `?team_id=` is ignored on `/policies`).
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `body.policies` has exactly the YAML length.

**Manual repro** — count `- path:` lines under `policies:` in the target file (each `lib/**/policies/*.yml`
holds exactly one policy, verified across all 27), then open **Policies** with the matching scope selected
(Unassigned for `default.yml`, Workstations for the fleet file) and compare the list total.

**Assessment**
- *Value:* the headline drift number; the baseline→min transition (27→22, 23→21) makes it a genuine test that gitops *deletes* as well as creates.
- *Coverage gaps:* `inherited_policies` in the team response is ignored, so global→team inheritance is unverified. Policy content (`query`, `description`, `resolution`, `critical`, `calendar_events_enabled`, `labels_include_any`, install-software/run-script automations) is entirely unchecked.
- *Redundancy:* implied by GV-09 + GV-10.
- *Efficiency / smells:* four tests, four identical `GET`s. `per_page=200` is a hard ceiling with no guard — at >200 policies the count silently caps and the test starts failing for the wrong reason.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-09 · GitOps verify · policies › every gitops policy exists by name

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `-g "every gitops policy exists by name"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load YAML policy names (from the `name:` field inside each referenced file, e.g. `macOS - Battery healthy`).
2. ☐ `GET` the scope's policies endpoint; build a name Set.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Each YAML policy name is present (message includes `(team_id=<n>)`).

**Manual repro** — `grep -h '^- name:' $(…the policy files the target lists…) | sort` vs the Policies list
for that scope (search each name in the list's search box). The `team_id` in the failure message tells you
which scope was queried.

**Assessment**
- *Value:* pinpoints *which* policy vanished; the failure message carries the scope, which is the first thing you need.
- *Coverage gaps:* subset-only; no query/description/resolution comparison, so a policy whose SQL was silently reverted passes.
- *Redundancy:* overlaps GV-08/GV-10 (three tests = set equality on names).
- *Efficiency / smells:* loop is vacuous if the YAML declares no policies.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-10 · GitOps verify · policies › no extra policies on live (no superset drift)

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `-g "no extra policies on live"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Build the expected name Set from the YAML.
2. ☐ `GET` the scope's policies endpoint.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Every live policy name is in the expected Set (message: `live has unexpected policy "<name>" not in gitops (team_id=<n>)`).

**Manual repro** — reverse diff: read the Policies list for the scope and confirm each row exists in the
target's `policies:` list. This is the direction that catches a policy added by hand in the UI, or a
`playwright-policy-*` left by an aborted CRUD spec.

**Assessment**
- *Value:* the superset half — the only thing that notices state gitops didn't put there.
- *Coverage gaps:* none beyond content.
- *Redundancy:* GV-08 is arithmetic-implied by GV-09 + GV-10.
- *Efficiency / smells:* vacuous when live has zero policies (would then be caught only by GV-08).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-11 · GitOps verify · policies › platform field matches gitops for each policy

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `-g "platform field matches gitops for each policy"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load YAML `{name, platform}` pairs (e.g. `darwin`, `windows`, `linux`).
2. ☐ `GET` the scope's policies endpoint; build `name → platform` Map.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* For each YAML policy **that declares a platform**, live `platform` string matches exactly (`policies.spec.ts:64-67`).

**Manual repro** — for a handful of policies, compare `platform:` in the `lib/**/policies/*.yml` file against
the **Platform** column / policy details page for that policy. All 27 policy files currently declare `platform`.

**Assessment**
- *Value:* the only *field-level* drift check on policies — a wrong platform silently changes which hosts a policy targets, and nothing else in the suite would notice.
- *Coverage gaps:* platform is the only field compared. Multi-platform values are comma-joined strings compared with `toBe`, so a reordering by Fleet (`darwin,windows` vs `windows,darwin`) reads as drift.
- *Redundancy:* none — the only non-name policy assertion.
- *Efficiency / smells:* `if (!p.platform) continue` (`policies.spec.ts:65`) is a silent skip — today no policy file omits `platform`, but adding one removes it from this check with no signal. `apiByName.get()` returns `undefined` for a missing policy, so a deletion fails here *and* in GV-08/09 with three confusing failures.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-12 · GitOps verify · configuration profiles › total profile count matches gitops

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `-g "total profile count matches gitops"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ `beforeAll`: resolve `teamId`.
2. ☐ Load `controls.apple_settings/windows_settings/android_settings.configuration_profiles[]` → 23 (11/10/2) baseline, 21 (11/8/2) min. macOS names come from `<PayloadDisplayName>` inside the `.mobileconfig`; Windows/Android from the filename minus extension.
3. ☐ `GET /configuration_profiles?per_page=200&team_id={id}`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `body.profiles` has exactly the YAML length.

**Manual repro** — count the `- path:` entries across the three `*_settings.configuration_profiles`
blocks in the target file, then **Controls → OS settings → Custom settings** with the scope selected
and compare the row count.

**Assessment**
- *Value:* 23→21 between baseline and min proves gitops removes profiles; a stuck profile is a real MDM-delivery hazard.
- *Coverage gaps:* profile **payload** never compared (a rewritten `.mobileconfig` with the same display name passes); profile→label scoping (`labels_include_all` etc.) not exercised by these configs at all; delivery status (Verified/Pending/Failed host counts) unchecked.
- *Redundancy:* implied by GV-13 (per-platform sums) and by GV-14 + GV-15.
- *Efficiency / smells:* four identical `GET`s in the file; `per_page=200` unguarded.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-13 · GitOps verify · configuration profiles › per-platform profile counts match gitops

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `-g "per-platform profile counts match gitops"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load the YAML profile list with its derived `platform` tag.
2. ☐ `GET /configuration_profiles?per_page=200&team_id={id}`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* For each of `darwin`, `windows`, `android`: live count for that platform === YAML count (labelled `${platform} profile count`).

**Manual repro** — the three YAML blocks give the expected split (11 mac / 10 or 8 win / 2 android);
in **Controls → OS settings → Custom settings** the platform is shown per row — tally by platform.

**Assessment**
- *Value:* localises a total-count mismatch to a platform, which usually identifies the cause immediately (e.g. Windows MDM off ⇒ windows count 0).
- *Coverage gaps:* `ios` / `ipados` are in the `ApiProfile` union (`profiles.spec.ts:8`) but **not** in the loop (`:32`) — an unexpected iOS profile is caught only indirectly by GV-12/GV-15. Declaration (DDM) profiles likewise unclassified.
- *Redundancy:* GV-12 is the sum of this test.
- *Efficiency / smells:* both empty ⇒ `0 === 0` passes, so this test can "pass" three times having verified nothing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-14 · GitOps verify · configuration profiles › every gitops profile exists by name

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `-g "every gitops profile exists by name"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load YAML profile names — macOS via the `<PayloadDisplayName>` heuristic, Windows/Android via basename.
2. ☐ `GET /configuration_profiles?per_page=200&team_id={id}`; build a name Set.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Each YAML profile name is present (message includes the platform and `team_id`).

**Manual repro** — for a macOS profile, open the `.mobileconfig` and read the **top-level**
`PayloadDisplayName` (not the ones nested in sub-payloads); that string must appear as the profile name
in **Controls → OS settings → Custom settings**. For Windows/Android the profile name is the bare filename
(`disable-onedrive`, `disable-camera`).

**Assessment**
- *Value:* the only test that ties Fleet's parsed profile name back to the file contents — catches a `.mobileconfig` edited without re-checking its display name.
- *Coverage gaps:* subset-only; no payload comparison.
- *Redundancy:* overlaps GV-12/GV-15.
- *Efficiency / smells:* `extractMacosProfileName` swallows read errors and falls back to the basename (`gitops-yaml.ts:220-223`) — a moved/unreadable file becomes a confusing "profile `firewall` missing" instead of a file-not-found. The smallest-indentation heuristic is a genuine reimplementation of Fleet's parser and can diverge.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-15 · GitOps verify · configuration profiles › no extra profiles on live (no superset drift)

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `-g "no extra profiles on live"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Build the expected name Set from the YAML (all three platforms).
2. ☐ `GET /configuration_profiles?per_page=200&team_id={id}`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Every live profile name is in the expected Set (message: `live has unexpected profile "<name>" (<platform>) not in gitops (team_id=<n>)`).

**Manual repro** — reverse diff of GV-14: every row in **Controls → OS settings → Custom settings** for the
scope must trace back to a `- path:` in the target YAML. This is the check that catches a profile uploaded
manually or left by an aborted profiles CRUD spec.

**Assessment**
- *Value:* an extra MDM profile is the highest-consequence drift in this area (it actually changes device configuration), and this is the only test that sees it.
- *Coverage gaps:* platform is reported in the message but not asserted, so a profile that flipped platform is invisible here (GV-13 catches it).
- *Redundancy:* pairs with GV-14; GV-12/13 are arithmetic consequences.
- *Efficiency / smells:* fourth duplicate `GET` in the file.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-16 · GitOps verify · scripts › script count matches gitops

- **File:** [`playwright/tests/api/gitops-verify/scripts.spec.ts`](../../tests/api/gitops-verify/scripts.spec.ts)
- **Grep:** `-g "script count matches gitops"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ `beforeAll`: resolve `teamId`.
2. ☐ Load `controls.scripts[]` → names are **file basenames with extension** (11 / 9 no-team, 6 / 5 Workstations).
3. ☐ `GET /scripts?per_page=200&team_id={id}`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `body.scripts` has exactly the YAML length.

**Manual repro** — count `- path:` under `controls.scripts` in the target, then **Controls → Scripts**
with the scope selected and compare the row count (11 for `default.yml`, 6 for baseline Workstations).

**Assessment**
- *Value:* proves gitops uploaded and (in the min pass) removed the script set for the scope.
- *Coverage gaps:* **script contents are never compared** — this is the widest content gap in the area, because a script is nothing *but* content: swap `uninstall-fleetd-macos.sh`'s body for `rm -rf /` and all three script tests still pass. Fleet exposes the body via `GET /scripts/{id}` and a `script_contents_id`/hash on the list response.
- *Redundancy:* implied by GV-17 + GV-18.
- *Efficiency / smells:* three identical `GET`s; `per_page=200` unguarded.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-17 · GitOps verify · scripts › every gitops script exists by basename

- **File:** [`playwright/tests/api/gitops-verify/scripts.spec.ts`](../../tests/api/gitops-verify/scripts.spec.ts)
- **Grep:** `-g "every gitops script exists by basename"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load `controls.scripts[]` basenames (`toggle-fleetd-debug.sh`, `create-admin-user.ps1`, …).
2. ☐ `GET /scripts?per_page=200&team_id={id}`; build a name Set.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Each YAML basename is present (message includes `team_id`).

**Manual repro** — `basename` each `- path:` under `controls.scripts` and search that exact filename
(extension included) in **Controls → Scripts** for the scope.

**Assessment**
- *Value:* names the missing script; also implicitly asserts Fleet's "script name = uploaded filename" contract.
- *Coverage gaps:* no contents; the `platform` the helper derives from the path (`gitops-yaml.ts:191-195`) is parsed and then **never asserted by any test**.
- *Redundancy:* overlaps GV-16/GV-18.
- *Efficiency / smells:* vacuous loop if `controls.scripts` is absent.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-18 · GitOps verify · scripts › no extra scripts on live (no superset drift)

- **File:** [`playwright/tests/api/gitops-verify/scripts.spec.ts`](../../tests/api/gitops-verify/scripts.spec.ts)
- **Grep:** `-g "no extra scripts on live"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Build the expected basename Set from the YAML.
2. ☐ `GET /scripts?per_page=200&team_id={id}`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Every live script name is in the expected Set (message: `live has unexpected script "<name>" not in gitops (team_id=<n>)`).

**Manual repro** — reverse diff: every row in **Controls → Scripts** for the scope must appear as a
`- path:` basename in the target YAML. Catches manually uploaded scripts and leftovers from the scripts CRUD spec.

**Assessment**
- *Value:* an extra runnable script on a fleet is a standing footgun; only this test sees it.
- *Coverage gaps:* no contents.
- *Redundancy:* pairs with GV-17.
- *Efficiency / smells:* third duplicate `GET`; vacuous when live has zero scripts.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-19 · GitOps verify · reports › report count matches gitops

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `-g "report count matches gitops"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ `beforeAll`: resolve `teamId`.
2. ☐ Load `reports[]`, flattening referenced files — note `dex-queries.yml` contributes **10** reports, so 21 file refs = 30 reports (baseline) and 17 refs = 26 (min); Workstations declares 5 / 3.
3. ☐ `GET /queries?per_page=200&team_id={id}&merge_inherited=false` (`reportsEndpoint`, `reports.spec.ts:24` — `merge_inherited=false` so a team's own reports are counted without global inheritance).
   - ✅ *(API)* Response OK.
   - ✅ *(API)* `body.queries` has exactly the YAML length.

**Manual repro** — `grep -c '^- name:'` across the files listed under `reports:` (don't count paths — count
entries), then open **Reports** ("Queries" on the API) with the scope selected. For Workstations you must be
in the team scope, not **All fleets**, or you'll see the inherited globals too.

**Assessment**
- *Value:* the report set is the largest gitops-managed collection (30) and the one the e2e suite most often disturbs; a count mismatch here is the sharpest apply/wipe signal in the area.
- *Coverage gaps:* report content — `query`, `interval`, `automations_enabled`, `logging`, `observer_can_run`, `discard_data` — is never verified. `interval` + `automations_enabled` change *behaviour* (scheduled collection), so silent drift there is invisible today. Global→team inheritance is deliberately excluded and never separately asserted.
- *Redundancy:* implied by GV-20 + GV-22.
- *Efficiency / smells:* four identical `GET`s. ⚠️ unclear from the code whether `team_id=0` is interpreted as "global/no team" by `/queries` or ignored — the assertion only holds if it scopes; worth confirming once against a live instance.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-20 · GitOps verify · reports › every gitops report exists by name

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `-g "every gitops report exists by name"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load YAML report names (`Collect listening TCP/UDP ports`, `DEX - Hardware inventory - system information`, …).
2. ☐ `GET /queries?per_page=200&team_id={id}&merge_inherited=false`; build a name Set.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Each YAML report name is present (message includes `team_id`).

**Manual repro** — collect names with `grep -h '^- name:'` over the referenced report files and search each
in the **Reports** list for the scope. The 10 `DEX - …` entries all come from the single `dex-queries.yml`,
so if they're all missing, suspect that one file reference.

**Assessment**
- *Value:* isolates which report failed to apply — valuable because one bad multi-entry file drops 10 at once.
- *Coverage gaps:* subset-only; no SQL/interval comparison.
- *Redundancy:* overlaps GV-19/GV-22.
- *Efficiency / smells:* vacuous loop if `reports:` is absent from the target.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-21 · GitOps verify · reports › platform field matches gitops for each report

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `-g "platform field matches gitops for each report"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Load YAML `{name, platform}` pairs — commonly the comma-joined `darwin,linux,windows`.
2. ☐ `GET /queries?…`; build `name → platform` Map.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* For each YAML report **that declares a platform**, live `platform` matches exactly (`reports.spec.ts:52-55`).

**Manual repro** — compare `platform:` in the report's `lib/platforms/**/reports/*.yml` against the report's
details page (**Platform** / compatibility). All 21 report files currently declare `platform`.

**Assessment**
- *Value:* only field-level check on reports; a narrowed platform silently stops collection on the excluded OSes.
- *Coverage gaps:* platform only. Exact string compare on a comma-joined list is order-sensitive — if Fleet ever normalises the order this fails as false drift.
- *Redundancy:* mirrors GV-11 exactly (same shape, different entity) — the two are candidates for one shared helper.
- *Efficiency / smells:* `if (!r.platform) continue` (`reports.spec.ts:53`) silently excludes any platform-less report.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-22 · GitOps verify · reports › no extra reports on live (no superset drift)

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `-g "no extra reports on live"`
- **Project:** gitops-verify · **Targets:** all six
- **Mode:** API

**Flow**

1. ☐ Build the expected name Set from the YAML.
2. ☐ `GET /queries?per_page=200&team_id={id}&merge_inherited=false`.
   - ✅ *(API)* Response OK.
   - ✅ *(API)* Every live report name is in the expected Set (message: `live has unexpected report "<name>" not in gitops (team_id=<n>)`).

**Manual repro** — reverse diff: every row in **Reports** for the scope must trace to a `name:` in the
target's referenced report files. Highest-yield check in the area for suite residue, since
`deleteAllQueries` in `cleanup.steps.ts` treats queries as global and an aborted reports CRUD spec
leaves `playwright-*` reports behind.

**Assessment**
- *Value:* the only superset check on reports; also the canary for "the e2e suite ran after the gitops apply".
- *Coverage gaps:* no content comparison; nothing asserts that a team *inherits* the global reports.
- *Redundancy:* pairs with GV-20; GV-19 is implied.
- *Efficiency / smells:* fourth duplicate `GET` in the file; vacuous when live has zero reports.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area observations

### Coverage map

GitOps YAML surface actually present in `gitops/**` vs. what the six specs verify:

| GitOps surface (declared in YAML) | Covered by | Gap |
|---|---|---|
| `org_settings.org_info.org_name` | GV-01 | `contact_url`, both logo URLs unchecked |
| `org_settings.sso_settings` | GV-02 (3 of 6 fields) | `metadata_url`, `enable_sso_idp_login`, `idp_image_url` |
| `org_settings.features` (org) | GV-04 | — |
| `controls.windows_enabled_and_configured` | GV-03 | — |
| `controls.android_enabled_and_configured` (premium) | **nothing** | no check at all; gates the 2 Android profiles |
| `org_settings.server_settings.*` (8 keys incl. `scripts_disabled`, `report_cap`, `server_url`) | **nothing** | `scripts_disabled: true` would break every script flow silently |
| `org_settings.host_expiry_settings` (org + team) | **nothing** | — |
| `org_settings.fleet_desktop.transparency_url` | **nothing** | — |
| `org_settings.secrets` (enroll secrets, free only) | **nothing** | `GET /spec/enroll_secret` |
| `org_settings.mdm.end_user_authentication` (premium) | **nothing** | EUA entity_id / idp_name |
| `org_settings.mdm.apple_business_manager` (ABM → Workstations for macos/ios/ipados) | **nothing** | the ABM default-team mapping is invisible drift |
| `org_settings.mdm.volume_purchasing_program` | **nothing** | — |
| `agent_options` (`lib/agent-options.yml`, org + both teams) | **nothing** | `GET /config → agent_options`, `GET /fleets/{id}` |
| Team `settings.features` / `host_expiry_settings` (`fleets/workstations.yml`) | **nothing** | org-settings spec skips team scope wholesale |
| Team existence / team **set** (`--delete-other-fleets`) | `resolveTeamId` throws if `Workstations` is missing | no assertion that the live team list equals the gitops fleet files — an extra team is invisible |
| `labels[]` names | GV-05/06/07 (exact set) | label `query`, `description`, `label_membership_type`, platform |
| `policies[]` names + platform | GV-08/09/10/11 (exact set + platform) | `query`, `description`, `resolution`, `critical`, `calendar_events_enabled`, `labels_include_any`, install-software / run-script automations; `inherited_policies` |
| `reports[]` names + platform | GV-19/20/21/22 (exact set + platform) | `query`, `interval`, `automations_enabled`, `logging`, `observer_can_run`, `discard_data`; inheritance |
| `controls.scripts[]` basenames | GV-16/17/18 (exact set) | **script body** — the entire point of a script |
| `*_settings.configuration_profiles[]` names + platform counts | GV-12/13/14/15 (exact set + per-platform) | **profile payload**; `ios`/`ipados` not in the per-platform loop; profile→label scoping |
| Software / FMA / VPP apps | n/a | not declared in these gitops configs (deliberate — `cleanup-setup` wipes installable software) |

**Exact-match vs subset.** Every entity family *is* exact-match, but only because the count test +
"every gitops X exists" + "no extra X on live" are run together — the three are individually one-directional.
Drop or skip any one of them and the family silently degrades to a subset check. Policies, profiles and
reports have all three; **labels** have all three; **scripts** have all three. The exactness is at the
*name-set* level only — nothing anywhere compares entity **contents**.

### The "green with zero coverage" failure modes

1. **Team target silently skips 7 of 22 tests.** `org-settings.spec.ts:6` and `labels.spec.ts:13` skip on
   `gitopsConfig.scope !== 'no-team'`. A run against `fleets/workstations.yml` reports 15 passed / 7 skipped
   and exits 0. If the nightly ever lost its no-team job, all org settings and all label drift would go
   unverified with a green board. Nothing asserts "the union of targets covers every scope".
2. **`GITOPS_TARGET` defaults to `../gitops/free-fleetqa` regardless of `SUITE`** (`_config.ts:14-16`).
   `SUITE=premium playwright test --project=gitops-verify` with no target compares the premium instance to
   free YAML. GV-01 fails (different org name), so it isn't silent — but nothing *structurally* ties target
   to suite, and the free/premium `default.yml` files are otherwise near-identical, so ~19 of 22 tests would
   have passed against the wrong config.
3. **Vacuous loops.** 10 of the 22 tests are `for` loops with no minimum-length guard: an empty
   `gitopsConfig.<entity>` (a deleted YAML key, a mis-shaped `path:` list) makes them pass having asserted
   only `toBeOK()`. GV-13 is the worst — with both sides empty it asserts `0 === 0` three times.
   No spec asserts `expect(gitopsConfig.policies.length).toBeGreaterThan(0)`.
4. **Two silent `continue`s** — `policies.spec.ts:65` and `reports.spec.ts:53` drop any entity lacking a
   `platform` from the only field-level check. Currently a no-op (27/27 and 21/21 declare it) but unguarded.
5. **`per_page=200`** everywhere with no `body.count`/`meta.has_next_results` guard: past 200 entities the
   comparisons quietly compare a truncated page.
6. **Nothing asserts the apply was fresh.** Verification can't distinguish "gitops applied correctly" from
   "instance already happened to match". The baseline→min→baseline alternation is what actually gives this
   teeth, since the two shapes differ in every count — worth preserving deliberately rather than by accident.

### Duplication

- **Three-test cliché ×4.** count / every-declared-exists / no-extra is repeated verbatim for labels,
  policies, scripts, reports and (as four tests) profiles — ~18 of 22 tests are the same two set-diffs
  over a different endpoint. One parameterised `expectExactNameSet(entity, endpoint, expected)` helper
  would collapse the file set to ~6 tests without losing a single assertion.
- **GV-11 ≡ GV-21** (policy platform vs report platform) — identical logic, identical silent `continue`.
- **`GET` fan-out:** 22 tests issue 22 requests where 6 would do (4× `/config`, 3× `/labels`, 4× `/policies`,
  4× `/configuration_profiles`, 3× `/scripts`, 4× `/queries`). Harmless for runtime, but it triples the blast
  radius of a flaky instance and each request re-pays auth.
- Weak overlap with [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts) (`toBeTruthy`/`toBeDefined`
  shape checks on the same `/config` fields) — no conflict; the gitops versions strictly dominate.

### UI-vs-API balance

All 22 are pure API, and that is the right call: the question is "does server state match YAML", the
`gitops-verify` project has no browser or `storageState`, and it runs inside a CI apply→verify chain. No
test here should become a UI test. The correct *complement* is that the e2e areas already assert the UI
renders these entities. One thing genuinely missing from the API-only framing: nothing checks the
gitops-created entities' **activity feed** entries, so "gitops ran" versus "state coincidentally matches"
is indistinguishable.

### Quick wins

1. Add `android_enabled_and_configured` to `org-settings.spec.ts` alongside GV-03 — one line, closes the
   only fully-uncovered `controls` flag (both premium configs declare it).
2. Guard the vacuous loops: one `expect(gitopsConfig.<entity>.length).toBeGreaterThan(0)` per spec (or a
   shared assertion in `_config.ts`) so an emptied YAML fails instead of passing.
3. Fail fast on target/suite mismatch in `_config.ts` — assert `gitopsLabel` starts with `process.env.SUITE`
   and drop the `../gitops/free-fleetqa` default, replacing it with a thrown error when `GITOPS_TARGET` is unset.
4. Filter builtins in GV-06's name Set (`labels.spec.ts:27`) to match GV-05/GV-07, and turn the two silent
   `continue`s (`policies.spec.ts:65`, `reports.spec.ts:53`) into failures.
5. Hoist each spec's `GET` into a `beforeAll`-cached response — 22 requests → 6, and adds a `has_next_results`
   check in one place instead of six.

### Bigger bets

1. **One generic exact-set helper + content hashing.** Replace the four-times-repeated triad with
   `expectExactNameSet()`, then extend `gitops-yaml.ts` to carry each entity's *content* (policy/report SQL,
   script body, profile payload, label query) and compare it — for scripts and profiles the name is the least
   interesting thing about them, and today a body swap is undetectable drift.
2. **Cover the org/team settings surface the specs ignore.** A `settings.spec.ts` for `agent_options`,
   `server_settings`, `host_expiry_settings`, `fleet_desktop`, enroll secrets, and the premium `mdm` block
   (EUA / ABM team mapping / VPP), plus a team-scope variant of GV-04 reading `GET /fleets/{id}` so
   `fleets/workstations.yml`'s `settings:` block stops being unverified. Add a team-set assertion so
   `--delete-other-fleets` semantics are actually tested.
3. **Fix the nightly scheduling collision.** `nightly-qa-gitops-{premium,free}.yml` start at 05:00 and run
   apply→verify→apply-min→verify-min, while `playwright-{premium,free}.yml` start at **05:30** and
   `cleanup-setup` deletes all queries, global + team policies, profiles and scripts — i.e. exactly what
   GV-08..22 compare. Either gate the Playwright suites on the gitops chain completing (`workflow_run`) or
   fold verification into a single orchestrator, so a "drift" failure always means drift and never a race.
