# GitOps drift verification — test audit

**Specs covered:** 11 files · **Test declarations:** 34 · **Projects:** gitops-verify

This area answers one question: **does the live Fleet instance match the YAML in `gitops/`?**
Every spec loads a GitOps target off disk (via [`helpers/gitops-yaml.ts`](../../helpers/gitops-yaml.ts)),
reads the matching live state with a few `GET`s, and compares — the *set* of each entity kind
exactly (nothing declared missing, nothing live undeclared), then every declared field of every
entity, and the org or fleet settings key by key. There is no browser and no mutation — the specs run
in the `gitops-verify` project (`retries: 0`, bearer-token auth, no `storageState`, no page objects,
no `pageHealth`), and are invoked by the two nightly orchestrators *between* `fleetctl gitops` apply
steps. The plan this area grows along is [`docs/gitops-coverage/README.md`](../gitops-coverage/README.md).

## How the target is resolved

[`tests/api/gitops-verify/_config.ts`](../../tests/api/gitops-verify/_config.ts) does all of it, once per worker process:

- `SUITE` must be `free` or `premium`; the module throws otherwise. `GITOPS_TARGET` is resolved against
  **`process.cwd()`**, defaulting to the tier's baseline directory (`../gitops/<suite>-fleetqa`), and is
  **refused unless its path contains `<suite>-fleetqa` or `<suite>-fleetqa-min`**: the two tiers' configs
  are near-identical, so most of a run against the wrong one would pass.
- A **directory** → `loadGitOpsConfig()` (reads `default.yml`, `scope: 'no-team'`, `teamName: 'No team'`,
  plus the `name:` of every sibling `fleets/*.yml`); a **file** → `loadFleetConfig()` (`scope: 'team'`,
  `teamName: doc.name`, the file's `settings:`).
- `gitopsLabel` = `basename(target)` and appears in every describe title, so the same test title
  is reused across targets — grep on the test title, not the describe.
- `resolveTeamId(request)`: `no-team` → `0`; `team` → `GET /teams?per_page=200`, match `t.name === teamName`,
  **throw** if absent. Cached per process.
- The loader expands every list the same way whether its entries are `path:` references (one file, holding
  one entity or a list), **`paths:` globs** (relative to the referencing file, like `path:`; scripts keep only
  `.sh` / `.py` / `.ps1` matches, as Fleet does) or **inline entities**. It reads each entity's option fields,
  `org_settings` or the fleet's `settings`, `agent_options` (through its `path:`), the `controls` flags,
  `custom_host_vitals`, and `software` (packages through their package files — the hash, the scripts, the
  pre-install query — plus Fleet-maintained and App Store apps). Names come from where Fleet takes them: the
  `name:` field; a script's basename; a `.mobileconfig`'s top-level `PayloadDisplayName` (smallest-indentation
  heuristic, basename fallback) and a Windows / Android profile's basename without extension; a package's
  installer filename (the URL's last segment); a Fleet-maintained app's slug.
- **`$VAR` / `${VAR}` are expanded from the environment** the way fleetctl expands them (never inside
  `description:` / `resolution:`, never `$FLEET_VAR_*` / `$FLEET_SECRET_*`), and an unset variable **throws**
  naming it. The verify workflow passes the same set the apply does (the SSO metadata URL, free's enroll
  secret, premium's EUA / ABM / VPP values).
- Every list read is paginated (`getAll`: follows `meta.has_next_results`, else pages while a page is full),
  and every non-2xx **throws** with the body: a swallowed error would read as "nothing declared".

## Targets in use (counts derived from the YAML)

| `GITOPS_TARGET` | Scope | Labels | Policies | Reports | Scripts | Profiles (mac/win/android) | Vitals | Software |
|---|---|---:|---:|---:|---:|---:|---:|---|
| [`../gitops/free-fleetqa`](../../../gitops/free-fleetqa/default.yml) | no-team | 27 | 28 | 31 | 11 | 23 (11/10/2) | 3 | — |
| [`../gitops/free-fleetqa-min`](../../../gitops/free-fleetqa-min/default.yml) | no-team | 24 | 23 | 27 | 9 | 21 (11/8/2) | 2 | — |
| [`../gitops/premium-fleetqa`](../../../gitops/premium-fleetqa/default.yml) | no-team (+ 4 fleet files) | 28 | 29 | 32 | 11 | 23 (11/10/2) | 3 | — |
| [`../gitops/premium-fleetqa/fleets/workstations.yml`](../../../gitops/premium-fleetqa/fleets/workstations.yml) | fleet `Workstations` | 0 | 23 | 5 | 6 | 23 (11/10/2) | — | — |
| [`../gitops/premium-fleetqa/fleets/qa.yml`](../../../gitops/premium-fleetqa/fleets/qa.yml) | fleet `QA` | 0 | 0 | 0 | 0 | 0 | — | 20 Fleet-maintained apps |
| [`../gitops/premium-fleetqa/fleets/vms.yml`](../../../gitops/premium-fleetqa/fleets/vms.yml) | fleet `VMs` | 0 | 2 | 1 | 0 | 0 | — | 4 packages, 4 Fleet-maintained apps |
| [`../gitops/premium-fleetqa/fleets/compliance.yml`](../../../gitops/premium-fleetqa/fleets/compliance.yml) | fleet `Compliance` | 1 | 7 | 2 | 12 | 6 (3/2/1) | — | 5 packages (2 script-only), 2 Fleet-maintained apps |
| [`../gitops/premium-fleetqa-min`](../../../gitops/premium-fleetqa-min/default.yml) | no-team (+ 2 fleet files) | 25 | 24 | 28 | 9 | 21 (11/8/2) | 2 | — |
| [`../gitops/premium-fleetqa-min/fleets/workstations.yml`](../../../gitops/premium-fleetqa-min/fleets/workstations.yml) | fleet `Workstations` | 0 | 21 | 3 | 5 | 21 (11/8/2) | — | — |
| [`../gitops/premium-fleetqa-min/fleets/compliance.yml`](../../../gitops/premium-fleetqa-min/fleets/compliance.yml) | fleet `Compliance` | 1 | 6 | 1 | 6 | 4 (2/1/1) | — | 3 packages (1 script-only), 2 Fleet-maintained apps |

Label/report counts exceed the file count because three referenced files hold multiple entries
(`lib/platforms/all/reports/dex-queries.yml` 10 reports, `lib/labels/macs-with-fleet-maintained-apps-installed.yml`
9 labels, `lib/labels/windows-with-fleet-maintained-apps-installed.yml` 6 labels), and because the no-team
configs carry entities **inline** (a policy and, on premium, a label-scoped one; a report with every option and,
on premium, a label-scoped one). The two Linux scripts come from one `paths:` glob. Compliance's label is
fleet-scoped, its twelve scripts come from three globs (one per platform folder, which is how the Linux folder's
Python script gets in), and it is the one target whose fleet-level `controls` (GV-31 … GV-34) and software
options are declared.

Nightly chain (`.github/workflows/nightly-qa-gitops-{premium,free}.yml`, run by `QA — Nightly` after the Render
redeploy and by `QA — Branch run`): apply baseline → verify baseline → apply **min** → verify min → fleetctl
checks. On premium each verify pass covers the no-team config, Workstations, Compliance, QA and VMs (QA and VMs
against the same files both times, since both applies carry them). Baseline and min differ in every count **and
in a value in every settings section**, so the pair proves gitops creates, deletes and updates; the min variant
is what the chain ends on, and the suite's `cleanup-setup` then wipes the global reports, policies, scripts and
profiles and Workstations' policies, profiles, scripts and software, so between runs the instance holds min's
org settings, labels, vitals and Workstations' reports, everything on QA and VMs, and min's Compliance fleet in
full (the cleanup never touches it).

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| GV-01 | `gitops-verify/_sanity.spec.ts` | the no-team config declares every entity kind | API | ☐ |
| GV-02 | `gitops-verify/_sanity.spec.ts` | a fleet file declares at least one entity | API | ☐ |
| GV-03 | `gitops-verify/_sanity.spec.ts` | every declared name is unique within its kind | API | ☐ |
| GV-04 | `gitops-verify/fleets.spec.ts` | the fleet set matches the gitops fleet files plus the hand-kept fleets | API | ☐ |
| GV-05 | `gitops-verify/host-vitals.spec.ts` | the custom host vital set matches gitops exactly | API | ☐ |
| GV-06 | `gitops-verify/labels.spec.ts` | the label set matches gitops exactly | API | ☐ |
| GV-07 | `gitops-verify/labels.spec.ts` | each label's definition matches gitops | API | ☐ |
| GV-08 | `gitops-verify/policies.spec.ts` | the policy set matches gitops exactly | API | ☐ |
| GV-09 | `gitops-verify/policies.spec.ts` | each policy's definition matches gitops | API | ☐ |
| GV-10 | `gitops-verify/profiles.spec.ts` | the profile set matches gitops exactly, per platform | API | ☐ |
| GV-11 | `gitops-verify/profiles.spec.ts` | each profile's targeting matches gitops | API | ☐ |
| GV-12 | `gitops-verify/profiles.spec.ts` | each profile's payload matches the repo | API | ☐ |
| GV-13 | `gitops-verify/reports.spec.ts` | the report set matches gitops exactly | API | ☐ |
| GV-14 | `gitops-verify/reports.spec.ts` | each report's definition matches gitops | API | ☐ |
| GV-15 | `gitops-verify/scripts.spec.ts` | the script set matches gitops exactly | API | ☐ |
| GV-16 | `gitops-verify/scripts.spec.ts` | each script's body matches the repo | API | ☐ |
| GV-17 | `gitops-verify/settings.spec.ts` | org_info, server_settings, features and fleet_desktop match gitops | API | ☐ |
| GV-18 | `gitops-verify/settings.spec.ts` | expiry, webhook, activity and gitops settings match gitops | API | ☐ |
| GV-19 | `gitops-verify/settings.spec.ts` | SSO settings match gitops | API | ☐ |
| GV-20 | `gitops-verify/settings.spec.ts` | MDM integrations match gitops | API | ☐ |
| GV-21 | `gitops-verify/settings.spec.ts` | the global MDM flags under controls match gitops | API | ☐ |
| GV-22 | `gitops-verify/settings.spec.ts` | agent options match gitops | API | ☐ |
| GV-23 | `gitops-verify/settings.spec.ts` | the global enroll secrets match gitops | API | ☐ |
| GV-24 | `gitops-verify/settings.spec.ts` | the fleet's settings match gitops | API | ☐ |
| GV-25 | `gitops-verify/settings.spec.ts` | the fleet's agent options match gitops | API | ☐ |
| GV-26 | `gitops-verify/software.spec.ts` | the custom package set matches gitops exactly | API | ☐ |
| GV-27 | `gitops-verify/software.spec.ts` | each custom package's options match gitops | API | ☐ |
| GV-28 | `gitops-verify/software.spec.ts` | the Fleet-maintained app set matches gitops exactly | API | ☐ |
| GV-29 | `gitops-verify/software.spec.ts` | each Fleet-maintained app's options match gitops | API | ☐ |
| GV-30 | `gitops-verify/software.spec.ts` | the App Store app set matches gitops exactly | API | ☐ |
| GV-31 | `gitops-verify/controls.spec.ts` | disk encryption, key escrow, the BitLocker PIN and the managed local account match gitops | API | ☐ |
| GV-32 | `gitops-verify/controls.spec.ts` | Recovery Lock and the host name template match gitops | API | ☐ |
| GV-33 | `gitops-verify/controls.spec.ts` | OS update settings match gitops | API | ☐ |
| GV-34 | `gitops-verify/controls.spec.ts` | setup experience matches gitops | API | ☐ |

- **Isolation:** independent tests, `fullyParallel: true`, `retries: 0`. Each spec reads its live list once in
  a `beforeAll`; the software specs (and the policies spec, for its automation targets) share one cached read of
  the fleet's titles, their details, the setup-experience listing per platform and the Fleet-maintained-app
  catalog (`resolveFleetSoftware`).
- **Two comparisons do most of the work.** `expectExactNames(what, live, declared)` reports the names declared
  but missing *and* the names live but undeclared (both soft, so one run lists every difference), then fails on
  the count. `expectSubset(what, live, declared)` compares every key the YAML declares and ignores the rest —
  Fleet fills defaults and adds read-only fields, and a key the config doesn't manage can't drift from it. A
  declared `undefined` is "not declared", not "must be undefined".
- **Which tests run for which target:** the `_sanity`, labels, policies, profiles, reports and scripts specs run
  for every target. `fleets`, `host-vitals` and the org half of `settings` run for a no-team target only
  (`fleets` on premium only); the fleet half of `settings` and the `software` spec run for a fleet file only, and
  each `controls` test for a fleet file that declares the keys it reads (today Compliance alone). The skips are
  data-availability guards, inline reasons only.

---

### GV-01 · GitOps verify · target › the no-team config declares every entity kind

- **File:** [`playwright/tests/api/gitops-verify/_sanity.spec.ts`](../../tests/api/gitops-verify/_sanity.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa npx playwright test --project=gitops-verify -g "declares every entity kind"`
- **Project:** gitops-verify · **Targets:** no-team only (skips for a fleet file: a fleet may legitimately leave a kind empty)
- **Mode:** API (no request — the parsed config only)

**Flow**

1. ☐ Load the target.
   - ✅ `org_settings.org_info.org_name` is truthy; `agent_options` resolved.
   - ✅ labels, policies, reports, `controls.scripts` and configuration profiles each parsed to **more than zero** entries.

**Manual repro** — open the target's `default.yml` and confirm each of those keys is present and non-empty.

**Assessment**
- *Value:* every other spec here is a set or field comparison, and two empty sets compare equal. A key that
  went missing, a `path:` list that stopped resolving or a glob that matches nothing would otherwise turn the
  project green with nothing asserted. This names that failure.
- *Coverage gaps:* doesn't pin the *counts* (a half-parsed list still passes); the Targets table above is the
  reference for those.
- *Redundancy:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### GV-02 · GitOps verify · target › a fleet file declares at least one entity

- **File:** [`playwright/tests/api/gitops-verify/_sanity.spec.ts`](../../tests/api/gitops-verify/_sanity.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa/fleets/qa.yml npx playwright test --project=gitops-verify -g "at least one entity"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API (parsed config only)

**Flow**

1. ☐ Load the fleet file.
   - ✅ The sum of its labels, policies, reports, scripts, profiles, packages, Fleet-maintained apps and App Store apps is **more than zero**.

**Manual repro** — open the fleet file; it declares something the specs can verify.

**Assessment**
- *Value:* the fleet-file counterpart of GV-01, loose on purpose — QA declares only software, VMs no profiles.
- *Coverage gaps:* a fleet file whose one section stopped parsing still passes on the others.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-03 · GitOps verify · target › every declared name is unique within its kind

- **File:** [`playwright/tests/api/gitops-verify/_sanity.spec.ts`](../../tests/api/gitops-verify/_sanity.spec.ts)
- **Grep:** `… -g "unique within its kind"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API (parsed config only)

**Flow**

1. ☐ For labels, policies, reports, scripts and profiles (keyed `platform:name`), collect duplicated names.
   - ✅ *(soft, per kind)* the duplicate list is empty.

**Assessment**
- *Value:* a duplicate name would make Fleet reject the apply, or make an exact-set comparison pass on a
  shorter live list; catching it in the YAML names the file.
- *Coverage gaps:* software (filenames, slugs) and vitals aren't checked for duplicates.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-04 · GitOps verify · fleets › the fleet set matches the gitops fleet files plus the hand-kept fleets

- **File:** [`playwright/tests/api/gitops-verify/fleets.spec.ts`](../../tests/api/gitops-verify/fleets.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa npx playwright test --project=gitops-verify -g "fleet set matches"`
- **Project:** gitops-verify · **Targets:** premium, no-team only (free has no fleets)
- **Mode:** API

**Flow**

1. ☐ Collect the `name:` of every `fleets/*.yml` in the target directory **and** in its sibling (`premium-fleetqa` ↔
   `premium-fleetqa-min`): the nightly applies the baseline's QA and VMs files in both passes, so the fleet set is
   the union. Add `HAND_KEPT_FLEETS` (`Mobile`, per `gitops/premium-fleetqa/README.md`).
2. ☐ `GET /teams?per_page=200`; drop names starting `pw-` (a throwaway a dead run left — logged, since the chain
   runs before the sweep that removes them).
   - ✅ *(API)* the remaining names, sorted, **equal** the expected set.

**Manual repro** — **Settings → Fleets** lists exactly Workstations, QA, VMs, Compliance and Mobile.

**Assessment**
- *Value:* the only place the *set* of fleets is asserted. An extra fleet (a renamed one orphaned by an apply, a
  hand-made one) was invisible before.
- *Coverage gaps:* `--delete-other-fleets` is never passed, so this verifies the union, not gitops' own view.
- *Redundancy:* `resolveTeamId` throws on a missing fleet, which covers absence but not presence of extras.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-05 · GitOps verify · custom host vitals › the custom host vital set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/host-vitals.spec.ts`](../../tests/api/gitops-verify/host-vitals.spec.ts)
- **Grep:** `… -g "custom host vital set"`
- **Project:** gitops-verify · **Targets:** no-team only (vitals are global)
- **Mode:** API

**Flow**

1. ☐ `GET /custom_host_vitals` (paginated).
   - ✅ *(API)* `expectExactNames` against `custom_host_vitals[].name` — an **absent** key means "none", because
     fleetctl deletes every vital when the key is omitted.

**Manual repro** — **Settings → Organization → Custom host vitals** lists exactly the declared names (3 on the
baseline, 2 on min).

**Assessment**
- *Value:* the first verification of this key, which both configs now carry; the min variant drops one.
- *Coverage gaps:* a vital's `$FLEET_HOST_VITAL_<id>` reference from a script or profile isn't exercised.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-06 · GitOps verify · labels › the label set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/labels.spec.ts`](../../tests/api/gitops-verify/labels.spec.ts)
- **Grep:** `… -g "label set matches"`
- **Project:** gitops-verify · **Targets:** all — the no-team config owns the global labels (`fleet_id` null), a fleet file the labels scoped to that fleet (Compliance declares one; the other fleet files none)
- **Mode:** API

**Flow**

1. ☐ `GET /labels`; keep `label_type: regular` with the scope's `fleet_id`.
   - ✅ *(API)* `expectExactNames` against the declared label names.

**Manual repro** — **Hosts → Filter by label** lists the declared labels and no other custom one.

**Assessment**
- *Value:* exact in both directions, scoped — a fleet-scoped label no longer fails the global count.
- *Coverage gaps:* membership (which hosts) is not compared; built-in labels are Fleet's and skipped.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-07 · GitOps verify · labels › each label's definition matches gitops

- **File:** [`playwright/tests/api/gitops-verify/labels.spec.ts`](../../tests/api/gitops-verify/labels.spec.ts)
- **Grep:** `… -g "each label's definition"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared label found live (missing ones are GV-06's):
   - ✅ *(API, soft)* `label_membership_type` equals the declared type (default `dynamic`).
   - ✅ *(API, soft)* `description` equals, when declared.
   - ✅ *(API, soft)* for a dynamic label, `query` (whitespace-normalized) and `platform` (`''` ↔ undeclared) equal.
   - ✅ *(API, soft)* for a host-vitals label, `criteria` contains the declared criteria.

**Assessment**
- *Value:* a label is its query; a body swap under an unchanged name was undetectable before. The manual label
  (`Pilot hosts`) and the platform-restricted one (`Linux hosts running Docker`) exercise the type and platform
  paths; premium's host-vitals label (`Engineering department`, membership from the end-user IdP's department)
  exercises `criteria`; Compliance's `Compliance macOS hosts` is the one fleet-scoped label.
- *Coverage gaps:* a manual label's `hosts:` list isn't compared (it's empty by declaration).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-08 · GitOps verify · policies › the policy set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `… -g "policy set matches"`
- **Project:** gitops-verify · **Targets:** all — `GET /policies` for no-team, `GET /fleets/{id}/policies` for a fleet (`?team_id=` on the first is ignored)
- **Mode:** API

**Flow**

1. ☐ Read the scope's policies (paginated).
   - ✅ *(API)* `expectExactNames` against the declared policy names.

**Manual repro** — **Policies**, scope selected, lists exactly the declared names.

**Assessment**
- *Value:* exact in both directions; the inline policies are counted like the lib ones.
- *Redundancy:* none; `tests/cli/nightly/generate-gitops.spec.ts` compares the same set from `generate-gitops`'s side.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-09 · GitOps verify · policies › each policy's definition matches gitops

- **File:** [`playwright/tests/api/gitops-verify/policies.spec.ts`](../../tests/api/gitops-verify/policies.spec.ts)
- **Grep:** `… -g "each policy's definition"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared policy found live:
   - ✅ *(API, soft)* `platform` equals (`''` ↔ undeclared); `query` equals, whitespace-normalized (skipped for a patch policy, whose query Fleet writes).
   - ✅ *(API, soft)* `critical` equals the declared value or `false` on premium, and `false` on free: the field is premium-only (`PolicySpec.Critical`, `premium:"true"`), so a free license stores `false` for the three shared lib policies that declare `true`.
   - ✅ *(API, soft, declared keys only)* `calendar_events_enabled`, `conditional_access_enabled`, `continuous_automations_enabled`, `patch_when_closed`, `notify_before_patching`, `type`.
   - ✅ *(API, soft)* `labels_include_any` / `labels_exclude_any` as sorted name lists.
   - ✅ *(API, soft)* `run_script.name` equals the declared script's basename, and `resend_configuration_profile.name` the declared profile's name (both `undefined` ↔ absent).
   - ✅ *(API, soft)* `install_software.software_title_id` equals the title the declared slug / package path / package hash / App Store id resolved to on this fleet (through `resolveFleetSoftware`), or `install_software` is absent when none is declared.
   - ✅ *(API, soft)* for a `type: patch` policy, `patch_software.software_title_id` equals the title the declared `fleet_maintained_app_slug` resolved to.
   - ✅ *(API, soft)* when `webhooks_and_tickets_enabled` is declared, the policy's id is (or isn't) in the scope's `failing_policies_webhook.policy_ids` (`GET /config` for no-team, `GET /fleets/{id}` for a fleet).

**Manual repro** — open the policy; compare query, platform, critical, labels and the automation's target.

**Assessment**
- *Value:* the automation check is what makes `vms.yml`'s two "Claude is installed" policies verifiable: a
  declared slug is checked against the title Fleet actually linked, not against a name. Compliance's seven
  policies carry every automation and targeting key a fleet policy has — a resent profile, a script, installs by
  package path, by hash and by slug, the webhook flag against the fleet's own failing-policies webhook, and two
  patch policies (`notify_before_patching` and `patch_when_closed`, which can't share one) — and the min variant
  drops one policy and one automation.
- *Coverage gaps:* `calendar_events_enabled` and `conditional_access_enabled` are compared when declared, which
  no config does (no Google Calendar or Entra on the instances).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-10 · GitOps verify · configuration profiles › the profile set matches gitops exactly, per platform

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `… -g "profile set matches"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ `GET /configuration_profiles?team_id={id}` (paginated).
   - ✅ *(API)* `expectExactNames` on `platform:name` keys, so a Windows profile named like a macOS one is still distinct, and the per-platform counts are implied.

**Manual repro** — **Controls → OS settings → Custom settings**, scope selected, per platform.

**Assessment**
- *Value:* exact in both directions, per platform, in one test instead of four.
- *Coverage gaps:* iOS/iPadOS profiles would key as `ios:`/`ipados:` and show up as extras — none are declared.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-11 · GitOps verify · configuration profiles › each profile's targeting matches gitops

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `… -g "each profile's targeting"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared profile found live:
   - ✅ *(API, soft)* `labels_include_all`, `labels_include_any`, `labels_exclude_any` as sorted name lists equal the declared ones (undeclared ↔ absent).

**Assessment**
- *Value:* who a profile reaches is as much its definition as its payload. The no-team and Workstations
  profiles are unscoped, so there the check asserts "unscoped"; Compliance's six profiles use all three keys
  (`labels_include_all` with two labels, `labels_include_any`, and `labels_exclude_any` with its fleet-scoped
  label), and the min variant drops two of them.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-12 · GitOps verify · configuration profiles › each profile's payload matches the repo

- **File:** [`playwright/tests/api/gitops-verify/profiles.spec.ts`](../../tests/api/gitops-verify/profiles.spec.ts)
- **Grep:** `… -g "each profile's payload"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared profile found live: `GET /configuration_profiles/{uuid}?alt=media`.
   - ✅ *(API, soft)* the served body equals the repo file, after line-ending and trailing-whitespace normalization.

**Manual repro** — download the profile from the UI and `diff` it against `gitops/lib/platforms/<platform>/configuration-profiles/<file>`.

**Assessment**
- *Value:* the payload is what a host receives; a name check alone can't see an edited payload.
- *Coverage gaps / risk:* assumes Fleet serves a profile as uploaded. Written against the documented endpoint
  and not yet run against an applied instance (the suite's cleanup had wiped every profile when this landed);
  the first branch run is its proof. If Fleet normalizes a payload, this compares a checksum instead.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-13 · GitOps verify · reports › the report set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `… -g "report set matches"`
- **Project:** gitops-verify · **Targets:** all — `GET /queries?team_id={id}&merge_inherited=false`
- **Mode:** API

**Flow**

1. ☐ Read the scope's own reports (paginated).
   - ✅ *(API)* `expectExactNames` against the declared report names.

**Assessment**
- *Value:* exact in both directions; the inline reports count like the lib ones.
- *Redundancy:* `cli/nightly/generate-gitops.spec.ts` compares the same set from the generated side.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-14 · GitOps verify · reports › each report's definition matches gitops

- **File:** [`playwright/tests/api/gitops-verify/reports.spec.ts`](../../tests/api/gitops-verify/reports.spec.ts)
- **Grep:** `… -g "each report's definition"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared report found live:
   - ✅ *(API, soft)* `query` equals, whitespace-normalized.
   - ✅ *(API, soft, declared keys only)* `platform`, `description`, `interval`, `logging`, `discard_data`, `observer_can_run`, `automations_enabled`, `min_osquery_version`.
   - ✅ *(API, soft)* `labels_include_any` / `labels_include_all` as sorted name lists.

**Assessment**
- *Value:* the inline "Collect osquery schedule stats" sets every option away from its default and the min
  variant changes two, so the update path is exercised nightly. `vms.yml`'s `pw-host-report-results` is held to
  the interval and `discard_data` two specs depend on.
- *Coverage gaps:* none for the documented report keys.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-15 · GitOps verify · scripts › the script set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/scripts.spec.ts`](../../tests/api/gitops-verify/scripts.spec.ts)
- **Grep:** `… -g "script set matches"`
- **Project:** gitops-verify · **Targets:** all — `GET /scripts?team_id={id}`
- **Mode:** API

**Flow**

1. ☐ Read the scope's scripts (paginated).
   - ✅ *(API)* `expectExactNames` against the declared basenames — the two Linux ones coming from a `paths:` glob.

**Assessment**
- *Value:* exact in both directions, and the first exercise of a glob reference.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-16 · GitOps verify · scripts › each script's body matches the repo

- **File:** [`playwright/tests/api/gitops-verify/scripts.spec.ts`](../../tests/api/gitops-verify/scripts.spec.ts)
- **Grep:** `… -g "each script's body"`
- **Project:** gitops-verify · **Targets:** all
- **Mode:** API

**Flow**

1. ☐ For every declared script found live: `GET /scripts/{id}?alt=media`.
   - ✅ *(API, soft)* the served body equals the repo file, after line-ending and trailing-whitespace normalization.

**Manual repro** — **Controls → Scripts**, download, `diff` against `gitops/lib/platforms/<platform>/scripts/<file>`.

**Assessment**
- *Value:* the body is what a host runs; it was the audit's first "bigger bet".
- *Coverage gaps / risk:* like GV-12, not yet run against an applied instance; the first branch run is its proof.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-17 · GitOps verify · org settings › org_info, server_settings, features and fleet_desktop match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "org_info, server_settings"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API (one `GET /config` in a `beforeAll`, shared by GV-17 … GV-22)

**Flow**

1. ☐ `expectSubset` of `org_settings.org_info` (name, contact URL, both logo URLs), `server_settings` (every
   declared key; `server_url` compared with a trailing slash trimmed on both sides — free's configured URL
   carries one), `features` (`enable_*`, `additional_queries`, `historical_data` and, on premium,
   `vulnerability_exposure_historical_reporting`) and `fleet_desktop` (all three keys) against the live config.
   - ✅ *(API, soft per key)* every declared key equals.

**Manual repro** — **Settings → Organization settings**: Organization info, Advanced options, Fleet Desktop.

**Assessment**
- *Value:* closes the audit's largest gap in one test. `enable_analytics` is the known trap: Fleet forces it on
  for a premium license, so premium's YAML says `true` and this would fail the moment it said otherwise. The
  vulnerability-exposure filters are display-only (the dashboard chart's defaults), and the min variant moves
  `cvss_min`.
- *Coverage gaps:* `detail_query_overrides` isn't declared (it rewrites the detail queries every host runs).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-18 · GitOps verify · org settings › expiry, webhook, activity and gitops settings match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "expiry, webhook"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ `expectSubset` of `host_expiry_settings`, `activity_expiry_settings`, `webhook_settings` (interval and the
   four webhooks — enable flags, destinations, host percentage / days / batch sizes), `gitops`
   (`gitops_mode_enabled`, `repository_url`; the `exceptions` Fleet adds are ignored) and `vulnerability_settings`.
   - ✅ *(API, soft per key)* every declared key equals.

**Assessment**
- *Value:* the min variant changes the activity window and every webhook destination, so this proves updates
  land, not just that a value was once set. The specs that write a webhook snapshot and restore it, so the
  gitops value is what they put back.
- *Coverage gaps:* `failing_policies_webhook.policy_ids` is deliberately undeclared (Fleet keeps the live list).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-19 · GitOps verify · org settings › SSO settings match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "SSO settings match"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ The config declares `sso_settings` (hard assertion — omitting the section would turn admin SSO off).
2. ☐ `expectSubset` of all six declared keys, `metadata_url` expanded from `FLEET_SSO_METADATA_URL`.
   - ✅ *(API, soft per key)* every declared key equals.

**Assessment**
- *Value:* six keys where three were checked; `shared/auth/sso-login.spec.ts` depends on `enable_sso` and an
  Okta `idp_name`, both held here.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-20 · GitOps verify · org settings › MDM integrations match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "MDM integrations match"`
- **Project:** gitops-verify · **Targets:** no-team only (free declares no `mdm` block, so it asserts nothing there)
- **Mode:** API

**Flow**

1. ☐ `expectSubset` of `mdm.end_user_authentication` (entity id, IdP name, metadata URL), `apple_server_url` and
   `windows_automatic_enrollment` where declared.
2. ☐ For each declared ABM token, find the live one by `organization_name`; for each VPP token, by `location`.
   - ✅ *(API, soft)* the token exists; its declared keys (the three `*_fleet` mappings; the `fleets` list) equal.
   - ✅ *(API, soft)* the live token counts equal the declared ones.

**Manual repro** — **Settings → Integrations → Mobile device management**: Apple Business Manager and Volume
Purchasing Program tables, and **End user authentication**.

**Assessment**
- *Value:* the ABM default-fleet mapping was invisible drift before, and an omitted `apple_business` /
  `volume_purchasing_program` key *clears* the mappings — this is the check that would catch it. The ABM
  mappings and `windows_automatic_enrollment.default_fleet` both point at **Compliance**, the fleet with no hosts
  that nothing in the suite depends on: Fleet assigns that fleet only to a host whose record the enrollment
  itself created, so the fleetd-enrolled VMs keep theirs, and an automated enrollment can never land on
  Workstations, which half a dozen specs need hostless.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-21 · GitOps verify · org settings › the global MDM flags under controls match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "global MDM flags"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ `expectSubset` of `windows_enabled_and_configured`, `android_enabled_and_configured`,
   `windows_migration_enabled`, `enable_turn_on_windows_mdm_manually`, `apple_require_hardware_attestation`,
   `only_allow_apple_business_enrollment` and `macos_migration` — each where `controls` declares it — against
   `config.mdm`.
   - ✅ *(API, soft per key)* every declared key equals.

**Assessment**
- *Value:* the Android flag gates two profiles and was unchecked. Note `android_enabled_and_configured` is a
  server no-op on a config write: this holds the instance to the YAML's claim, not the apply to its effect.
  Premium declares the rest too: the three enrollment flags at the live `false`, with no min delta because
  flipping one changes how the real Windows VMs or Apple DEP enroll, and `macos_migration` off with a mode and a
  webhook URL the min variant changes (`premium/settings/integrations/mdm.spec.ts` restores the block after its
  own edit).
- *Coverage gaps:* `only_allow_apple_business_enrollment` isn't declared — the live `false` is Fleet's default,
  and `true` would block manual enrollment.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-22 · GitOps verify · org settings › agent options match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "agent options match"`
- **Project:** gitops-verify · **Targets:** no-team only
- **Mode:** API

**Flow**

1. ☐ The config declares `agent_options` (hard — omitting it clears the global agent options).
2. ☐ `expectSubset` of the resolved `lib/agent-options.yml` document against `config.agent_options`.
   - ✅ *(API, soft per key)* every declared key equals (`config.options.*`, `config.decorators.load`).

**Assessment**
- *Value:* the options every host runs with; never verified before.
- *Coverage gaps:* `command_line_flags` and `update_channels` aren't declared globally on purpose (they reach
  the real VMs); the hostless Compliance fleet declares them and GV-25 compares them there (min changes
  `events_max`).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-23 · GitOps verify · org settings › the global enroll secrets match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `SUITE=free GITOPS_TARGET=../gitops/free-fleetqa npx playwright test --project=gitops-verify -g "global enroll secrets"`
- **Project:** gitops-verify · **Targets:** no-team configs that declare `org_settings.secrets` — free; premium skips (its secrets are under the gitops-mode exception)
- **Mode:** API

**Flow**

1. ☐ `GET /spec/enroll_secret`.
   - ✅ *(API, soft)* the **count** of declared secrets missing live is 0.
   - ✅ *(API)* the live count equals the declared count.

Values are never printed: the messages carry counts only.

**Assessment**
- *Value:* free's apply rotates the global secret to `$FLEET_ENROLL_SECRET`; the simulations re-enroll with it.
- *Coverage gaps:* none for free; premium's fleet secrets aren't declared and can't be.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-24 · GitOps verify · fleet settings › the fleet's settings match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa/fleets/workstations.yml npx playwright test --project=gitops-verify -g "fleet's settings match"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API (one `GET /fleets/{id}` in a `beforeAll`, shared with GV-25)

**Flow**

1. ☐ `expectSubset` of the file's `settings.features`, `host_expiry_settings`, `webhook_settings` and
   `integrations` against the fleet object.
   - ✅ *(API, soft per key)* every declared key equals.

**Assessment**
- *Value:* the first verification of any fleet's `settings:` block (features, host expiry on Workstations, QA
  and VMs). Compliance declares two fleet webhooks — `failing_policies_webhook` on, whose `policy_ids` GV-09
  reads for `webhooks_and_tickets_enabled`, and `host_activities_webhook` off — and the min variant changes both
  destination paths and the host expiry window.
- *Coverage gaps:* `host_status_webhook` isn't declared on a fleet: fleetctl doesn't manage a fleet's, and Fleet
  reports it `null` after an apply that declares one (`premium/settings/team-host-status-webhook.spec.ts` owns
  that surface). `integrations` are credentials the instances don't have.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-25 · GitOps verify · fleet settings › the fleet's agent options match gitops

- **File:** [`playwright/tests/api/gitops-verify/settings.spec.ts`](../../tests/api/gitops-verify/settings.spec.ts)
- **Grep:** `… -g "fleet's agent options"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API

**Flow**

1. ☐ The fleet file declares `agent_options` (hard — omitting it clears the fleet's).
2. ☐ `expectSubset` of the resolved document against the fleet's `agent_options`.
   - ✅ *(API, soft per key)* every declared key equals.

**Assessment**
- *Value:* the VMs fleet's agent options are what the real VMs run with; `cleanup.steps.ts` strips a
  `script_execution_timeout` a spec leaves there, and this confirms the rest is as declared.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-26 · GitOps verify · software › the custom package set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/software.spec.ts`](../../tests/api/gitops-verify/software.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa/fleets/vms.yml npx playwright test --project=gitops-verify -g "custom package set"`
- **Project:** gitops-verify · **Targets:** fleet files only (a `default.yml` can't carry `software`)
- **Mode:** API (`resolveFleetSoftware`: `GET /software/titles?available_for_install=true` paginated, one `GET /software/titles/{id}` per title, `GET /setup_experience/software?team_id={id}&platform={macos,windows,linux}`, one `GET /software/fleet_maintained_apps?per_page=5000`)

**Flow**

1. ☐ Keep the titles whose package has no `fleet_maintained_app_id`; pair each declared package with one of
   them — by `hash_sha256` when the package file declares a hash, else by installer filename (the URL's last
   segment, or the script's name for a script-only package) — each live installer claimed at most once.
   - ✅ *(API, soft)* no declared package is left unpaired; no live installer is left unclaimed.
   - ✅ *(API)* the number of differences is 0.

**Manual repro** — **Software**, fleet selected, filter *Available for install*: the four inert fixtures on VMs.

**Assessment**
- *Value:* `vms.yml`'s packages were applied nightly and never verified. The hash is what makes an apply skip
  the download, so it identifies the file; matching on the filename rather than the title name for the rest is
  deliberate, since Fleet names a Windows title by what the host reports until its reconcile cron runs.
- *Coverage gaps:* two versions of one title with the same filename would pair by hash only if both declare one.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-27 · GitOps verify · software › each custom package's options match gitops

- **File:** [`playwright/tests/api/gitops-verify/software.spec.ts`](../../tests/api/gitops-verify/software.spec.ts)
- **Grep:** `… -g "each custom package's options"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API

**Flow**

1. ☐ For every declared package paired with a live title (GV-26's pairing), from the title detail:
   - ✅ *(API, soft, when declared)* `self_service`; `categories` as sorted lists with Fleet's emoji prefix stripped from both sides (`categoryName`: Fleet stores `🛠️ Utilities` for the YAML's `Utilities`); `display_name`; `icon_url` present when the YAML declares an `icon`.
   - ✅ *(API, soft, always)* the title is in the fleet's setup-experience listing iff `setup_experience: true` (the per-platform `GET /setup_experience/software` is the only place the flag is reported for a Fleet-maintained app). An undeclared key is **held to `false`**, unlike `self_service`: a title that installs during setup starts real work on any host enrolled into the fleet, and the QA shelf and VMs must never carry one. An apply doesn't reset the flag (fleetctl sends nothing for an undeclared key), so one toggled on by hand shows up as drift until cleared by hand.
   - ✅ *(API, soft)* `labels_include_all` / `labels_include_any` / `labels_exclude_any` as sorted name lists (undeclared ↔ absent).
   - ✅ *(API, soft, when the package file declares them)* `pre_install_query` (the SQL lifted out of the apply-format query file, whitespace-normalized), `install_script`, `uninstall_script`, `post_install_script` bodies against the referenced files.

**Manual repro** — **Software**, fleet selected, open the title: self-service, categories, display name, icon and
label targets on its detail; the scripts and pre-install query under *Advanced options* of its edit form.

**Assessment**
- *Value:* the hash is what lets an apply skip the download, so a mismatch means a different file is on the
  instance; 7-Zip's own install/uninstall scripts are compared body for body. On Compliance the same inert
  fixtures carry every option a package has (through their `*.compliance.package.yml` files), plus two script-only
  packages with a display name, an icon and a label target, and the min variant drops two packages.
- *Coverage gaps:* the icon is checked for presence, not pixels.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-28 · GitOps verify · software › the Fleet-maintained app set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/software.spec.ts`](../../tests/api/gitops-verify/software.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa/fleets/qa.yml npx playwright test --project=gitops-verify -g "Fleet-maintained app set"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API

**Flow**

1. ☐ Map each live title's `fleet_maintained_app_id` to its catalog slug.
   - ✅ *(API)* `expectExactNames` of those slugs against the declared `fleet_maintained_apps[].slug`.
   - ✅ *(API, soft)* every such slug's title has an installer on the fleet.

The catalog's own `software_title_id` is **not** used as the signal: Fleet sets it on a catalog entry whose app
was uploaded as a custom package too (7-Zip on VMs), which would count once as each.

**Manual repro** — **Software → Add software → Fleet-maintained**, fleet selected: the declared apps show as added.

**Assessment**
- *Value:* the QA shelf (20 apps) and the VMs fixtures (4) were never verified; `version-pinning.spec.ts`
  depends on Postman being on QA, which this now proves nightly.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-29 · GitOps verify · software › each Fleet-maintained app's options match gitops

- **File:** [`playwright/tests/api/gitops-verify/software.spec.ts`](../../tests/api/gitops-verify/software.spec.ts)
- **Grep:** `… -g "each Fleet-maintained app's options"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API

**Flow**

1. ☐ For every declared app found live (by slug), from the title detail:
   - ✅ *(API, soft)* an exact `version` pin equals the installer's version; a caret pin bounds its major.
   - ✅ *(API, soft)* the same option checks as GV-27: `self_service`, `categories` (emoji-normalized), setup experience through the fleet's listing (held to `false` when undeclared, as in GV-27), `display_name`, icon presence, label targets, and the pre-install query and three script bodies when declared.

**Assessment**
- *Value:* on QA and VMs nothing declares an option (the shelf's rule), so there this asserts "defaults"; on
  Compliance Itsycal carries self-service, setup experience, a category, a label target, a post-install script
  and a display name, and DB Browser a caret pin, and the min variant turns DB Browser's self-service off.
- *Coverage gaps:* the version an unpinned app resolved to isn't compared with the catalog's latest (it lags
  the hourly auto-update cron by design). No `pre_install_query` on a Fleet-maintained app whose patch policy
  sets `notify_before_patching` or `patch_when_closed`: Fleet manages that query itself and refuses a declared one.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-30 · GitOps verify · software › the App Store app set matches gitops exactly

- **File:** [`playwright/tests/api/gitops-verify/software.spec.ts`](../../tests/api/gitops-verify/software.spec.ts)
- **Grep:** `… -g "App Store app set"`
- **Project:** gitops-verify · **Targets:** fleet files only
- **Mode:** API

**Flow**

1. ☐ Keep the titles with an `app_store_app`, keyed `platform:app_store_id` (or the id alone when a declared app names no platform, since Fleet then adds one title per platform).
   - ✅ *(API)* `expectExactNames` against the declared `app_store_apps`.

**Assessment**
- *Value:* holds every gitops-managed fleet to "no VPP or Android app unless declared" — none is today.
- *Coverage gaps:* the option keys of a store app aren't compared; batch 3 decides whether to declare any
  (fleetdm/fleet#54013: an unavailable app halts the whole apply).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-31 · GitOps verify · controls › disk encryption, key escrow, the BitLocker PIN and the managed local account match gitops

- **File:** [`playwright/tests/api/gitops-verify/controls.spec.ts`](../../tests/api/gitops-verify/controls.spec.ts)
- **Grep:** `SUITE=premium GITOPS_TARGET=../gitops/premium-fleetqa/fleets/compliance.yml npx playwright test --project=gitops-verify -g "disk encryption, key escrow"`
- **Project:** gitops-verify · **Targets:** fleet files that declare at least one of the keys it reads — Compliance; a file that declares none (Workstations, QA, VMs) skips with an inline reason, since a comparison of nothing would report a match (the per-platform controls are a fleet's; the no-team scope's global MDM flags are GV-21's)
- **Mode:** API (one `GET /fleets/{id}` → `team.mdm` in a `beforeAll`, shared by GV-31 … GV-34)

**Flow**

1. ☐ `expectSubset` of the file's `apple_settings.enable_disk_encryption` / `enable_escrow_disk_encryption_key`
   against `mdm.macos_settings`, `windows_settings.enable_disk_encryption` / `require_bitlocker_pin` /
   `enable_managed_local_account` against `mdm.windows_settings`, and
   `linux_settings.enable_escrow_disk_encryption_key` against `mdm.linux_settings`.
   - ✅ *(API, soft per key)* every declared key equals.

**Manual repro** — **Controls → OS settings → Disk encryption**, fleet selected: the macOS, Windows and Linux
toggles, the BitLocker PIN and the managed local account.

**Assessment**
- *Value:* these settings act on every host of the fleet that carries them, which is why only Compliance — a
  fleet with no hosts — declares them, and the min variant turns macOS key escrow and the BitLocker PIN off, so
  the update path runs nightly, not only the first apply.
- *Coverage gaps:* per-host encryption state isn't read (there are no hosts to read it from).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-32 · GitOps verify · controls › Recovery Lock and the host name template match gitops

- **File:** [`playwright/tests/api/gitops-verify/controls.spec.ts`](../../tests/api/gitops-verify/controls.spec.ts)
- **Grep:** `… -g "Recovery Lock and the host name template"`
- **Project:** gitops-verify · **Targets:** fleet files that declare either key (Compliance; the others skip, inline reason)
- **Mode:** API

**Flow**

1. ☐ `expectSubset` of `enable_recovery_lock_password` and `name_template` against the fleet's `mdm`.
   - ✅ *(API, soft per key)* every declared key equals; `$FLEET_VAR_HOST_HARDWARE_SERIAL` is compared verbatim
     (the loader never expands `$FLEET_VAR_*`, and neither does fleetctl).

**Manual repro** — **Controls → OS settings**, fleet selected: Recovery Lock under the macOS section, and the
host name template.

**Assessment**
- *Value:* Recovery Lock on a fleet with hosts is the one setting `recovery-lock.spec.ts` is allowed to flip
  (VMs, and back off); here it is held on in the baseline and off in min, on a fleet nothing can receive it
  from. The name template renames through MDM, so with no hosts it renames nothing.
- *Coverage gaps:* none for the two keys.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-33 · GitOps verify · controls › OS update settings match gitops

- **File:** [`playwright/tests/api/gitops-verify/controls.spec.ts`](../../tests/api/gitops-verify/controls.spec.ts)
- **Grep:** `… -g "OS update settings"`
- **Project:** gitops-verify · **Targets:** fleet files that declare an `*_updates` block (Compliance; the others skip, inline reason)
- **Mode:** API

**Flow**

1. ☐ For `macos_updates`, `ios_updates`, `ipados_updates` and `windows_updates`: `expectSubset` of the declared
   block (`minimum_version`, `deadline`, `update_new_hosts`; `deadline_days`, `grace_period_days`) against
   `mdm.<key>`.
   - ✅ *(API, soft per key)* every declared key equals.

**Manual repro** — **Controls → OS updates**, fleet selected, each platform tab.

**Assessment**
- *Value:* the only place an OS-update minimum or deadline is declared anywhere in `gitops/`:
  `exclusive/os-updates/*` asserts Workstations enforces none, and nothing may set one on the VMs fleet
  (`CLAUDE.md` → Test hosts). The min variant moves the macOS minimum, the iPadOS deadline and the Windows
  deadline days.
- *Coverage gaps:* a DDM software-update declaration isn't declared (batch 3, a new payload type).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### GV-34 · GitOps verify · controls › setup experience matches gitops

- **File:** [`playwright/tests/api/gitops-verify/controls.spec.ts`](../../tests/api/gitops-verify/controls.spec.ts)
- **Grep:** `… -g "setup experience matches"`
- **Project:** gitops-verify · **Targets:** fleet files that declare `setup_experience` (skipped otherwise, inline reason)
- **Mode:** API

**Flow**

1. ☐ `expectSubset` against `mdm.macos_setup`, with the YAML's names mapped to the API's:
   `enable_end_user_authentication`, `lock_end_user_info`, `apple_enable_release_device_manually` →
   `enable_release_device_manually`, `macos_manual_agent_install` → `manual_agent_install`,
   `require_all_software_macos`, `require_all_software_windows`, `enable_create_local_admin_account` →
   `enable_managed_local_account`, `end_user_local_account_type`.
   - ✅ *(API, soft per key)* every declared key equals.
2. ☐ `macos_script`, when declared, compared by **basename** against `macos_setup.script` (Fleet echoes the path
   the YAML gave).
   - ✅ *(API, soft)* the basenames equal.

**Manual repro** — **Controls → Setup experience**, fleet selected: *End user authentication*, the Setup
assistant's options, the local account settings and the setup script.

**Assessment**
- *Value:* end-user authentication on and `lock_end_user_info` need the IdP only premium has, and the min
  variant flips the lock and the local account type (`standard` → `admin`), so both the apply and the update are
  proven on a fleet where no device will ever run setup.
- *Coverage gaps:* the bootstrap package, the ADE setup-assistant profile and `macos_manual_agent_install` (which
  requires a bootstrap package) need fixtures (batch 3); which titles install during setup is GV-27 / GV-29's.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

## Area observations

### Coverage map

GitOps YAML surface present in `gitops/**` vs. what the specs verify:

| GitOps surface (declared in YAML) | Covered by | Gap |
|---|---|---|
| `org_settings.org_info` (name, contact URL, logo URLs) | GV-17 | — |
| `org_settings.server_settings` (8 keys) | GV-17 | — (premium's `enable_analytics` is forced on by Fleet; the YAML says so) |
| `org_settings.features` (`enable_*`, `additional_queries`, `historical_data`, premium's `vulnerability_exposure_historical_reporting`) | GV-17 | `detail_query_overrides` not declared (rewrites every host's detail queries) |
| `org_settings.fleet_desktop` (3 keys) | GV-17 | — |
| `host_expiry_settings`, `activity_expiry_settings`, `webhook_settings` (4), `gitops`, `vulnerability_settings` | GV-18 | `failing_policies_webhook.policy_ids` deliberately undeclared |
| `sso_settings` (6 keys) | GV-19 | — |
| `mdm.end_user_authentication`, `apple_business`, `volume_purchasing_program`, `windows_automatic_enrollment` | GV-20 | `apple_server_url` not declared (saving it re-syncs DEP) |
| `controls.windows_enabled_and_configured`, `android_enabled_and_configured`, `windows_migration_enabled`, `enable_turn_on_windows_mdm_manually`, `apple_require_hardware_attestation`, `macos_migration` | GV-21 | `only_allow_apple_business_enrollment` not declared (Fleet's default; `true` blocks manual enrollment) |
| `agent_options` (org and fleet; `command_line_flags` and `update_channels` on Compliance) | GV-22, GV-25 | — |
| `org_settings.secrets` (free) | GV-23 | premium's fleet secrets are excepted, by design |
| Fleet `settings` (features, host expiry, the failing-policies and host-activities webhooks) | GV-24 | `host_status_webhook` (fleetctl doesn't manage a fleet's); `integrations` (credentials) |
| The set of fleets | GV-04 | `--delete-other-fleets` never passed |
| `custom_host_vitals` | GV-05 | references from scripts/profiles |
| `labels[]` (names, type, query, platform, description, host-vitals `criteria`; fleet-scoped on Compliance) | GV-06, GV-07 | membership |
| `policies[]` (names, query, platform, critical, flags, label targets, `install_software` by path / hash / slug, `run_script`, `resend_configuration_profile`, `webhooks_and_tickets_enabled`, patch policies) | GV-08, GV-09 | `calendar_events_enabled`, `conditional_access_enabled` (Google Calendar / Entra) |
| `reports[]` (every documented key) | GV-13, GV-14 | — |
| `controls.scripts[]` (names, bodies; `paths:` globs) | GV-15, GV-16 | body check unproven until the first apply after this landed |
| `*_settings.configuration_profiles[]` (names per platform, label targets, payloads) | GV-10, GV-11, GV-12 | payload check unproven until the first apply; DDM declarations not declared (batch 3) |
| `software.packages` (filenames, hash, self-service, categories, setup experience, display name, icon, label targets, pre-install query, scripts) | GV-26, GV-27 | a second version of one title (batch 3) |
| `software.fleet_maintained_apps` (slugs, the same options, caret and exact pins) | GV-28, GV-29 | — |
| `software.app_store_apps` | GV-30 | none declared (batch 3) |
| Fleet-level `controls` (disk encryption and escrow, BitLocker PIN, managed local account, Recovery Lock, `name_template`, OS updates for four platforms, setup experience) | GV-31 … GV-34 | bootstrap package, ADE setup assistant, manual agent install, DDM declarations and assets (batch 3) |

**Exact-match everywhere.** Every entity family is compared as an exact set in one test (missing *and* extra,
then the count), and every declared field in a second. The exactness no longer depends on three separate tests
staying enabled together.

### The "green with zero coverage" failure modes

What the 2026-07 audit listed, and where each stands:

1. **A fleet target silently skipped a third of the tests.** Still true that fewer tests apply to a fleet
   file, but the ones that do are the ones that *can* (the org half of `settings`, `fleets` and `host-vitals`
   are global by nature), and the fleet-only specs (`software`, the fleet half of `settings`) now exist. The
   skips are inline data-availability guards.
2. **`GITOPS_TARGET` defaulted to free regardless of `SUITE`.** Fixed: the default follows `SUITE`, and a target
   outside the tier's directories throws at load.
3. **Vacuous loops.** Fixed two ways: `_sanity` pins each kind non-empty for a no-team target, and every
   field loop is preceded by an exact-set test in the same file — a declared entity that is missing fails there.
4. **Silent `continue`s on a missing `platform`.** Gone: `platform` is compared as `''` when undeclared.
5. **`per_page=200` with no guard.** Fixed: `getAll` follows `has_next_results` or pages while full.
6. **Nothing asserts the apply was fresh.** Still true, and still mitigated by the baseline ↔ min alternation —
   now with a changed *value* in every settings section, so an apply that creates and deletes but never updates
   would fail GV-14, GV-17 and GV-18.

Two new ones to know about:

7. **The payload and body checks (GV-12, GV-16) have not run against an applied instance** at the time of this
   rewrite — the suite's cleanup had wiped every script and profile. Their first proof is the branch run that
   lands them; if Fleet normalizes what it serves, the comparison moves to a checksum.
8. **`expectSubset` compares declared keys only.** That is the point (Fleet adds read-only fields), but it means a
   key the YAML drops is not noticed here — and fleetdm/fleet#48021 says Fleet doesn't reset it either. The
   min variant *changing* values is the guard; a key present in the baseline and absent from min is a hole.

### Duplication

- The count / declared-exists / no-extra triad is one helper (`expectExactNames`), called once per entity kind.
- `GET /config` is read once per worker for GV-17 … GV-22, `GET /fleets/{id}` once for GV-24 … GV-25, and the
  software reads once for GV-26 … GV-30.
- Weak overlap with [`tests/api/config.spec.ts`](../../tests/api/config.spec.ts) (shape checks on `/config`) — no
  conflict; the gitops versions strictly dominate.

### UI-vs-API balance

All 34 are pure API, and that is the right call: the question is "does server state match YAML", the
`gitops-verify` project has no browser or `storageState`, and it runs inside a CI apply→verify chain. The e2e
areas assert the UI renders these entities. Still missing from the API-only framing: nothing checks that the
**activity feed** records the apply, so "gitops ran" versus "state coincidentally matches" is indistinguishable
except through the baseline ↔ min alternation.

### Quick wins

1. Add `custom_host_vitals` and `webhook_settings` to `cli/nightly/generate-gitops.spec.ts`'s round-trip, if
   `generate-gitops` emits them.
2. Compare a package's icon by checksum (GV-27 asserts presence only) once Fleet serves the icon bytes from a
   stable URL.

### Bigger bets

1. **Apply-freshness:** read the activity feed for `edited_*` / `applied_*` entries since the chain started.
2. **`fleets/unassigned.yml` on premium**, the layout `generate-gitops` itself emits: the no-team `controls`,
   `policies`, software and webhooks move there, and the loader learns a third scope. A follow-up to batch 2.
3. **Batch 3's fixtures**: a bootstrap package and ADE setup assistant (GV-34 would compare them), a DDM
   declaration with assets (GV-10 … GV-12), a second version of one package (GV-26), App Store apps (GV-30).
