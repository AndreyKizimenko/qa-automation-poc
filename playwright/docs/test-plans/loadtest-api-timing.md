# Loadtest API timing — audit and request matrix

**Goal:** every Fleet API request a user-facing page makes finishes in under 5 s on the per-release
loadtest instance. Two tools get us there: the existing Playwright `loadtest` project (times page
loads) and a new API-timing script (hits each endpoint 5–20× with sorts/filters and reports medians).
This document audits what the UI suite covers today, maps every scale bug Fleet has filed to the
request shape that broke, records a live probe of the 4.93 RC instance, and proposes the request
matrix for the script.

Written 2026-10-01 against `fleet-493loadtest.loadtest.fleetdm.com` (4.93.0-rc, `rc-minor-fleet-v4.93.0`).

## Status

Implemented the same day as the `loadtest-api` Playwright project:

- `tests/loadtest/api/shapes.ts` — the §6 matrix as data (~480 shapes before scope expansion), each with
  its priority, scope and issue; `resolve.ts` looks up the ids; `helpers/perf-api.ts` samples and grades.
- `npm run test:loadtest:api` runs every family; `-g <family>` one of them; `API_PRIORITY=P0` the
  known-bad subset; `API_SAMPLES=20` for tighter medians; `API_SHAPE=<id substring>` one shape.
- Severity: over 5 s but answering is `slow` (flagged, keeps rolling, capped at 3 min of sampling per
  shape and 90 s per request); never answering is `broken` and fails the family; a mix is `error`.
- Results: `.perf-history-api/<timestamp>/summary.md` + `results.json`, console table with the last
  three runs' medians, dataset counts and resolved ids in the run metadata.
- Not implemented: §6.12 write paths and §6.13 device endpoints (they mutate data or need a device token).
- Verified end to end against a local 4.93 RC instance (19 hosts, premium, MDM on): all 11 families run in
  ~2 min at two samples; skipped shapes report their missing id; a failing family restarts the worker and
  the resolution cache is reused. Every shape was then audited mechanically against Fleet's registered GET
  routes and the query parameters each route's request struct decodes (663 variants, all routed, all
  parameters decoded) — the audit script is `tools/loadtest-api-audit/audit-shapes.py` in the repo root.
- What that first local run and the audit turned up, after checking each against the server code:
  - `hosts?connected_to_fleet=true&fleet_id=N` (and `hosts/count`) answer the masked 422 while the same
    filter without `fleet_id` answers 200 — a real bug, no existing issue found.
  - The REST docs list `mdm_enrollment_status=manual-personal`; the server constant is `personal` and the
    documented spelling gets 400 (docs bug; the matrix sends `personal`). Related open work:
    fleetdm/fleet#52285 / #53677 re-establish the personal status and its filters.
  - The CVE sort keys for `software/versions` are only accepted while vulnerability details are included
    (`softwareOrderKeys` in the datastore); the docs don't say so. Not a bug — the matrix now sends
    `without_vulnerability_details=false` for those sorts.
  - `exclude_fleet_maintained_apps` is documented for `software/titles` but no server code decodes it;
    the shape was dropped (docs bug).
  - `hosts/count?order_key=issues` answers the masked 422 where other keys answer 200 — `issues` is not a
    hosts-table column, so this is API robustness rather than a perf finding; low priority.
  - The vulnerability-details path is the cost behind the slow global software lists: the legacy
    `GET /software` the dashboard's top-software card calls took 8 s on 19 hosts / 12k CVEs and 0.7 s with
    `without_vulnerability_details=true`, and `software/versions` with the API default (details on) behaved
    the same. The card has three columns and never shows vulnerabilities. Related: fleetdm/fleet#45415
    (closed) covered the same versions path; fleetdm/fleet#54408 (open) is removing undocumented software
    endpoints, which the legacy list is.
  - `host_summary` over 4 s already has fleetdm/fleet#53701 (open, 76k macOS MDM hosts).
- First pass on the 4.93 RC loadtest instance, 2026-10-01, hosts offline, instance otherwise idle
  (`.perf-history-api/2026-10-01_151344/`, P0 shapes, 3 samples): 192 ok · 35 slow · 6 error · 11 broken.
  Never succeeds: `software/titles` with `vulnerable=true` (#51954), `min_cvss_score`, `max_cvss_score`,
  the CVSS range and `query=a` — every sample the masked 422; the titles and versions `name` sorts
  complete two samples in three at 9–15 s and 422 on the third. Slow: versions `min_cvss_score` 48 s,
  vulnerabilities with explicit `order_key=created_at` 27 s (0.6 s implicit), titles `query=chrome`
  21–27 s, `os_versions` no platform 14–17 s and `platform=linux` 19 s, versions `query=chrome` 16 s,
  `populate_software` 9.3 s, CSV export 8.6 s, FMA catalog 6.1 s, versions `vulnerable` 6.0 s, hosts
  default sort / deep pages 5.0–5.7 s. Recovered without load: labels with host counts 4.6 s, macadmins
  1.8 s, host_summary 2.1 s. Page-load suite the same day (one worker, token-cookie auth): 70 passed,
  6 failed — four are the MDM-off "Additional configuration required" state (OS updates ×2, Configuration
  profiles, Certificates), one was the report-name helper picking up the Inherited badge (fixed), one is
  the Vulnerable software filter never rendering (#51954 in the UI). Slowest pages: Versions search
  29.6 s, Software search 20.7 s, Vulnerabilities page 14.7 s, titles name sort 13–14 s, versions name
  sort 9.7 s, hosts page 1000 9.4 s, Export hosts 8.9 s, hosts list and sorts 8.4–8.7 s.
- The first-pass report with the UI-reachable vs API-only split is
  [`docs/loadtest-runs/2026-10-01-493-first-pass.md`](../loadtest-runs/2026-10-01-493-first-pass.md).
- UI suite follow-ups landed: one worker for the `loadtest` project, data anchors for Labels /
  Configuration profiles / Scripts / Variables, `measureSearch` for the team reports search, a
  `perf-slow` annotation over 5 s, and new Library tab / hosts page 1000 / Export hosts measurements.

---

## 1. Headline findings

1. **On the 4.93 RC instance, 21 of the ~78 request shapes probed took more than 5 s on at least one
   sample (19 on the first sample), and 6 failed outright with HTTP 422 after 5–43 s.** The 422s are MySQL errors masked by Fleet's generic
   "The request could not be processed." message (`server/platform/endpointer/transport_error.go`
   `safeReason`: any non-duplicate-key MySQL error becomes that string). The response `uuid` is the
   handle an engineer needs to find the real error in the logs.
2. **The UI's own default requests are among the slow ones.** The hosts list sends
   `order_key=display_name&order_direction=asc` by default and that sort costs 6–39 s at 100k hosts
   in one fleet, while the same list unsorted returns in 0.13 s. `GET /os_versions` without a
   `platform` filter (what the Dashboard OS card, Software › OS and Controls › OS updates all call)
   takes 42–52 s; with `platform=windows` it takes 0.09 s.
3. **Three issues that were closed as fixed have regressed or were never fully fixed:** the software
   titles sorts/filters from #35799 (name sort 18 s, `query=chrome` 30 s, `vulnerable=true` 422),
   the versions/vulnerabilities shapes from #45415 (`min_cvss_score=7` 49 s, `order_key=created_at`
   28 s), and the labels host-count subquery from #4890 (2022) — `GET /labels` with the default
   `include_host_counts=true` takes 37–48 s.
4. **The UI suite measures 73 page loads but only ~20 distinct API shapes**, all single-sample, with
   4 workers contending, no budget assertion, and five measurements that anchor on a static heading
   and never wait for data. That audit already exists in
   [`docs/test-audit/17-loadtest-performance.md`](../test-audit/17-loadtest-performance.md); this
   document does not repeat it.
5. **The current loadtest instance does not have the gitops loadtest bundle applied** to the fleet the
   hosts live in. Fleet 1 ("Ducks", all 100k hosts) has 0 policies, 0 reports, 0 configuration
   profiles and 50 scripts. Every policy / report / profile measurement in the UI suite is timing an
   empty state there, and the #48996 / #42565 shapes (OS settings status at scale) cannot be
   exercised until Windows profiles are applied.

---

## 2. What the Playwright loadtest suite targets today

73 measurements across 11 spec files in `tests/loadtest/`. The table maps each spec to the API
requests the page fans out to (from `frontend/services/entities/*` and the page components), so the
API script can cover the same surface directly.

| Spec (measurements) | Page(s) | API requests behind the page |
|---|---|---|
| `dashboard.spec.ts` (6) | `/dashboard[/mac\|windows\|linux]?fleet_id` | `config`, `fleets`, `me`, `host_summary?fleet_id[&platform]`, `labels/summary`, `hosts/summary/mdm`, `macadmins?fleet_id`, **`os_versions?fleet_id[&platform]`** (OS card), `software/versions?…order_key=hosts_count` (top software card), `activities?per_page=8` (All-fleets view only), `charts/{metric}` (historical cards) |
| `hosts.spec.ts` (9) | `/hosts/manage` + status / platform / label / search / sort | `hosts?fleet_id&per_page=50&order_key=display_name&order_direction=asc` (UI default), `hosts/count` (paired with every list call), `labels/summary`, `hosts/summary/mdm`; filters add `status=online`, `labels/{id}/hosts` (platform + custom labels), `query=` |
| `host-details.spec.ts` (6) | `/hosts/{id}` + Software / Reports / Policies tabs | `hosts/{id}`, `hosts/{id}/activities`, `hosts/{id}/activities/upcoming`, `hosts/{id}/software[?vulnerable=true\|available_for_install=true]`, `hosts/{id}/reports`, `hosts/{id}/configuration_profiles`, `hosts/{id}/certificates`, `hosts/{id}/scripts`, `hosts/{id}/device_mapping`, `hosts/{id}/macadmins`, `hosts/{id}/mdm`, `hosts/{id}/dep_assignment` |
| `software.spec.ts` (14) | `/software/inventory`, `/software/versions` | `software/titles?fleet_id&order_key=name\|hosts_count&vulnerable=true&query=`, `software/versions?…` (same params + `without_vulnerability_details=true`) |
| `software-os.spec.ts` (7) | `/software/os` + View hosts | `os_versions?fleet_id[&platform][&order_key=hosts_count]`, then `hosts?os_version_id=` |
| `software-vulnerabilities.spec.ts` (5) | `/software/vulnerabilities` | `vulnerabilities?fleet_id[&exploit=true][&order_key=cvss_score][&query=]` |
| `policies.spec.ts` (4) | `/policies/manage` (All fleets + team) | `policies` (global, `/api/latest`), `policies/count`, `fleets/{id}/policies[?automation_type=]`, `fleets/{id}/policies/count` |
| `reports.spec.ts` (6) | `/reports/manage` (All fleets + team) | `reports[?fleet_id][&platform=darwin][&query=]` |
| `controls.spec.ts` (14) | OS updates, OS settings, profiles, certificates, setup experience ×6, scripts, batch progress, variables | `os_versions?fleet_id`, `hosts?os_settings=` (status link), `configuration_profiles?fleet_id`, `configuration_profiles/summary?fleet_id`, `disk_encryption?fleet_id`, `certificates?fleet_id`, `setup_experience/software?fleet_id&platform=` ×6, `scripts?fleet_id`, `scripts/batch?fleet_id&status=finished`, `custom_variables` |
| `labels.spec.ts` (1) | `/labels/manage` | `labels?include_host_counts=false` |
| `users.spec.ts` (1) | `/settings/users` | `users` |

**Not measured by the UI suite at all** (and therefore where the API script adds the most):
every `order_key` other than `display_name` / `name` / `hosts_count` / `cvss_score`; pagination
past page 0; `hosts/count` and `hosts/report` (CSV export); `populate_*` payload expanders;
`labels` with host counts; `macadmins`; `host_summary` by platform; `os_versions` without
platform; the Software Library / Fleet-maintained / App Store tabs (`available_for_install`,
`fleet_maintained_apps`, `app_store_apps`); CVE / OS / policy / report / label detail pages;
`commands`; `activities` beyond page 1; every write path.

---

## 3. The 4.93 loadtest instance as of 2026-10-01

| Entity | Count | Notes |
|---|---:|---|
| Hosts | 100,000 | all in fleet 1 "Ducks" (`FLEET_LOADTEST_FLEET_ID=1`); 60k darwin / 20k windows / 20k ubuntu, osquery-perf simulations |
| Fleets | 6 | Geese, Pigeons, Turkeys, Swans, fma-batch-timeout-repro are empty |
| Software titles | 505,261 | |
| Software versions | 817,325 | |
| Vulnerabilities (CVEs) | 47,035 | vuln crons have run |
| OS versions | 29 | |
| Labels | 530 | 500 from a bundle + builtins; no host counts visible until `include_host_counts=true` |
| Fleet-maintained apps (fleet 1) | 1,424 | Add software › Fleet-maintained catalog |
| Titles available for install (fleet 1) | 260 | |
| Policies | 6 global, **0 in fleet 1** | the 500-policy bundle is not applied to the hosts' fleet |
| Reports | 503 global, **0 in fleet 1** | |
| Configuration profiles (fleet 1) | **0** | #48996 / #42565 shapes cannot be exercised |
| Scripts (fleet 1) | 50 | |
| Users | 2 | |
| Activities | ~100k | |

Steady-state server load during the probe (from `tools/loadtest/metrics` 15 m synopsis): Fleet
CPU 26%, RDS writer 27%, readers 33–41%, Redis 48%, ALB 5xx = 0. The slow requests below are not
a saturated instance; they are the queries themselves.

---

## 4. Scale bugs filed so far, mapped to request shapes

Sources: every issue with the `:loadtest` label (73), the `~performance-scaling` label, and open
bugs whose title mentions slow / timeout / 502. Agent check-in paths (`osquery/config`,
`distributed/read|write`, orbit config, MDM check-in) and cron runtimes (vulnerabilities, Apple
reconciler, FMA sync) are listed for completeness but are not request-level targets for this
script — osquery-perf already generates that load and the metrics scripts measure it.

### 4a. Read endpoints (what the API script should cover)

| Issue | State | Request shape that broke | Status on 4.93 RC probe |
|---|---|---|---|
| [#35799](https://github.com/fleetdm/fleet/issues/35799) Software titles perf | closed (4.76) | `software/titles` with `order_key=name`, `vulnerable=true`, `query=chrome`, `exploit=true`, `min/max_cvss_score` | **regressed**: name 18 s, `query=chrome` 30 s, `vulnerable` 422, `min_cvss` 422 / 43 s, exploit 7–11 s |
| [#51954](https://github.com/fleetdm/fleet/issues/51954) `titles?vulnerable=true` 10 s+ | open | `software/titles?vulnerable=true` | 422 at 10 s (fleet and all-fleets) |
| [#45415](https://github.com/fleetdm/fleet/issues/45415) versions + vulns slow, DB CPU 100% | closed | `software/versions?vulnerable&min_cvss_score&order_key=hosts_count&query=c`; `vulnerabilities?order_key=created_at\|cvss_score&min_cvss_score` | **still bad**: versions `min_cvss=7` 49 s, `vulnerable` 13 s, `query=chrome` 17 s; vulns `order_key=created_at desc` 28 s |
| [#43030](https://github.com/fleetdm/fleet/issues/43030) / [#47755](https://github.com/fleetdm/fleet/issues/47755) versions without `per_page` | closed / open | `software/versions` (no `per_page` → 1M default) | 3.1 s, 200 — fixed in practice |
| [#47722](https://github.com/fleetdm/fleet/issues/47722) hosts search + device_mapping | closed | `hosts?device_mapping=true&query=<email>&per_page=100` | 4.2 s — borderline; host_emails not seeded here |
| [#15744](https://github.com/fleetdm/fleet/issues/15744) host search by email | closed | `hosts?query=<partial email>`, `hosts/count`, `hosts/report` | search 3.9–4.2 s; needs the email seeding SQL from the issue |
| [#48996](https://github.com/fleetdm/fleet/issues/48996) hosts list 1 min+ with 100 profiles on 50k hosts | open | `hosts?os_settings=verified` and the OS settings page (`configuration_profiles/summary`) | 0.13 s — **not exercised** (0 profiles in fleet 1) |
| [#42565](https://github.com/fleetdm/fleet/issues/42565) Windows OS settings summary timeout | closed | `configuration_profiles/summary?fleet_id` with Windows profiles | 0.08 s — not exercised |
| [#44170](https://github.com/fleetdm/fleet/issues/44170) list MDM commands times out | closed | `commands?host_identifier=…&per_page=10` (UNION ALL + OR join) | now 400 without `host_identifier`; needs a host with command history |
| [#44388](https://github.com/fleetdm/fleet/issues/44388) many list endpoints time out on `order_key` (audit requested) | closed | every allowlisted `order_key` on hosts, activities, titles, versions, policies, scripts, labels, reports, profiles, users, teams | **this script is that audit** — see §6 |
| [#4890](https://github.com/fleetdm/fleet/issues/4890) label host_count subquery | closed (2022) | `labels` (default `include_host_counts=true`) | **regressed**: 37–48 s; 0.17 s with counts off |
| [#52213](https://github.com/fleetdm/fleet/issues/52213) affected-hosts for a CVE never loads | open | `hosts/count?vulnerability=CVE`, `hosts?vulnerability=CVE` | count 3.9 s, list 0.12 s; needs a CVE with many hosts |
| [#51896](https://github.com/fleetdm/fleet/issues/51896) host software quadratic self-join | open | `hosts/{id}/software` on a host with install history | 0.35 s — simulated hosts have no `host_software_installs` rows |
| [#21847](https://github.com/fleetdm/fleet/issues/21847) long JSON encode | closed | `osquery/config` with 15k-char queries (agent path) | n/a |
| [#49746](https://github.com/fleetdm/fleet/issues/49746) stale Windows enrollments | open | inflates every `mdm_windows_enrollments` join (profiles summary, hosts MDM filters) | n/a — distorts Windows baselines on recycled fleets |

### 4b. Write endpoints (opt-in, separate run — they mutate the dataset)

| Issue | State | Request |
|---|---|---|
| [#38955](https://github.com/fleetdm/fleet/issues/38955), [#44071](https://github.com/fleetdm/fleet/issues/44071), [#44858](https://github.com/fleetdm/fleet/issues/44858), [#46894](https://github.com/fleetdm/fleet/issues/46894) | closed / closed / open / open | `POST hosts/transfer` and `hosts/transfer/filter` with 1k / 10k / 30k hosts (lock waits, silent reverts, reader spike) |
| [#39921](https://github.com/fleetdm/fleet/issues/39921) | closed | `POST spec/teams` (gitops apply) with ~70k hosts and ~30 profiles — 107 s |
| [#48349](https://github.com/fleetdm/fleet/issues/48349), [#46993](https://github.com/fleetdm/fleet/issues/46993), [#44051](https://github.com/fleetdm/fleet/issues/44051), [#44050](https://github.com/fleetdm/fleet/issues/44050) | closed | `POST mdm/profiles/batch` (Windows, large add / remove); OS settings page 502 while profiles apply |
| [#54536](https://github.com/fleetdm/fleet/issues/54536) | open | `POST software/batch` with 40+ FMAs exceeds fleetctl's 45 s |
| [#44191](https://github.com/fleetdm/fleet/issues/44191) | closed | policy creation / edit → `policy_membership` rewrite over all hosts |
| [#42441](https://github.com/fleetdm/fleet/issues/42441), [#49197–#49199](https://github.com/fleetdm/fleet/issues/49199) | closed / open | `POST reports/run` live query targeting all hosts (Redis O(hosts × queries)) |

### 4c. Agent / cron (covered by osquery-perf + metrics scripts, not this script)

#50157, #50171, #43928, #46338, #44629, #35484, #44188–#44190, #45635, #45650, #44804, #44798,
#48875, #49705, #41374, #43978, #44391, #31820, #51508, #41910, #41907, #46153, #44956, #48326.

---

## 5. Live probe of 4.93 RC (single samples, read-only)

Method: one `curl` per shape, 75 s timeout, bearer token from `.env.loadtest`, `fleet_id=1` unless
noted. Two probe scripts ran concurrently, so at most two requests were in flight; the re-samples
(second column) ran while the 422-body script was also running, which is why some are slower. Treat
every number as indicative — the script in §6 is what produces trustworthy medians.

Legend: **bold** = over 5 s; `422` = MySQL error masked as "The request could not be processed."

### Hosts

| Request | 1st sample | re-sample |
|---|---:|---:|
| `hosts?per_page=50` (no sort) | 0.14 s | |
| `hosts?order_key=display_name&order_direction=asc` (**UI default**) | **5.93 s** | **18.6 s / 39.4 s** |
| `hosts?order_key=issues&order_direction=desc` | 4.85 s | **34.6 s** |
| `hosts?order_key=seen_time&order_direction=desc` | 4.86 s | |
| `hosts?page=1000&order_key=display_name` | **7.28 s** | |
| `hosts?status=online` | 0.12 s | |
| `hosts?query=<4-char prefix>` | 3.85 s | |
| `hosts?query=john@example.com&device_mapping=true&per_page=100` (#47722) | 4.22 s | |
| `hosts?os_settings=verified` (#48996, no profiles applied) | 0.13 s | |
| `hosts?mdm_enrollment_status=enrolled` | 0.07 s | |
| `labels/{regular}/hosts` | 0.13 s | |
| `hosts?vulnerability=CVE-2020-1171` | 0.12 s | |
| `hosts/count?vulnerability=CVE-2020-1171` (#52213) | 3.90 s | |
| `hosts?software_title_id=` / `?os_version_id=` | 0.14 s / 0.12 s | |
| `hosts?populate_software=true&per_page=50` | **15.2 s** | |
| `hosts/report?format=csv&fleet_id=1` (Export) | **16.8 s** | |
| `hosts/count?fleet_id=1` | 1.5 s | 3.6 s |
| `host_summary?fleet_id=1` (Dashboard) | 2.46 s | **5.53 s** |
| `hosts/summary/mdm?fleet_id=1` | 0.08 s | |
| `macadmins?fleet_id=1` (Dashboard MDM/Munki card) | **5.59 s** | **15.0 s** |
| `hosts/{id}` | 0.46 s | |
| `hosts/{id}/software` / `?vulnerable=true` | 0.35 s / 0.89 s | |
| `hosts/{id}/activities` / `/activities/upcoming` | 0.08 s / 0.08 s | |

### Software titles and versions

| Request | 1st sample | re-sample |
|---|---:|---:|
| `software/titles?per_page=20` (default `hosts_count desc`) | 0.52 s | |
| `software/titles?order_key=name&order_direction=asc` | **18.5 s** | **18.7 s** |
| `software/titles?order_key=name&page=1000` | **16.3 s** | |
| `software/titles?vulnerable=true` (#51954) | `422` @ 10.2 s | `422` @ 10.2 s |
| `software/titles?vulnerable=true&exploit=true` | **7.46 s** | **11.4 s** |
| `software/titles?vulnerable=true&min_cvss_score=7` | `422` @ 43.2 s | `422` @ 10.9 s |
| `software/titles?vulnerable=true&min_cvss_score=7&max_cvss_score=9` | `422` @ 27.3 s | |
| `software/titles?query=chrome` | **30.5 s** | |
| `software/titles?query=a` | `422` @ 4.7 s | `422` @ 8.1 s |
| `software/titles?available_for_install=true` (Library tab) | **9.81 s** | |
| `software/titles?self_service=true` | **10.0 s** | |
| `software/titles?vulnerable=true` (all fleets) | `422` @ 12.9 s | |
| `software/titles/{id}` | 0.09 s | |
| `software/versions?per_page=20` (default) | 0.56 s | |
| `software/versions?order_key=name&order_direction=asc` | `422` @ 35.0 s | `422` @ 31.9 s |
| `software/versions?vulnerable=true` | **13.2 s** | |
| `software/versions?vulnerable=true&exploit=true` | 1.27 s | |
| `software/versions?vulnerable=true&min_cvss_score=7` | **49.4 s** | |
| `software/versions?query=chrome` | **17.3 s** | |
| `software/versions` (no `per_page`, #47755) | 3.11 s | |
| `software/versions/{id}` | 0.08 s | |
| `software/fleet_maintained_apps?fleet_id=1` (1,424 apps) | **6.25 s** | **36.0 s** |

### Vulnerabilities and OS

| Request | 1st sample | re-sample |
|---|---:|---:|
| `vulnerabilities?per_page=20` (no sort params) | 3.99 s | |
| `vulnerabilities?order_key=created_at&order_direction=desc` (documented default, explicit) | **28.1 s** | **28.5 s / 29.1 s** |
| `vulnerabilities?order_key=cvss_score&order_direction=desc` | 1.94 s | |
| `vulnerabilities?order_key=hosts_count&order_direction=desc` | 3.06 s | |
| `vulnerabilities?order_key=epss_probability&order_direction=desc` | 1.62 s | |
| `vulnerabilities?exploit=true` | 0.12 s | |
| `vulnerabilities?query=CVE-2024` | 0.68 s | |
| `vulnerabilities?page=1000&order_key=cvss_score` | 1.71 s | |
| `vulnerabilities/{cve}` | 0.09 s | |
| `os_versions?fleet_id=1` (Dashboard OS card, Software › OS, OS updates) | **50.5 s** | **48.4 s / 42.4 s** |
| `os_versions` (all fleets) | | **52.6 s** |
| `os_versions?platform=windows` | 0.09 s | |
| `os_versions/{id}` | 0.29 s | |

### Everything else

| Request | 1st sample | re-sample |
|---|---:|---:|
| `labels` (default `include_host_counts=true`, #4890) | **37.5 s** | **48.2 s** |
| `labels?include_host_counts=false` (what the UI sends) | 0.17 s | |
| `labels/summary` | 0.15 s | |
| `activities?per_page=20` / `?query=admin` | 0.08 s / 0.08 s | |
| `configuration_profiles/summary` / `disk_encryption` (0 profiles) | 0.08 s / 0.08 s | |
| `scripts?fleet_id=1` / `scripts/batch?status=finished` | 0.08 s / 0.08 s | |
| `/api/latest/fleet/policies` / `fleets/1/policies` / `reports` / `reports?order_key=name` | 0.09–0.12 s | |
| `fleets` / `config` / `users` | 0.26 s / 0.09 s / 0.09 s | |
| `/api/v1/fleet/policies` | 404 (v1 path is `global/policies`; use `/api/latest`) | |
| `commands?per_page=10` (no `host_identifier`) | 400 (now required) | |

Two findings worth flagging to engineering independently of the script: **explicitly sending the
documented default sort is 7× slower than omitting it** on `vulnerabilities`
(`order_key=created_at` 28 s vs no params 4 s — same ordering, different query plan), and
**`os_versions` is 500× slower without a `platform` filter** (50 s vs 0.09 s).

---

## 6. Proposed API-timing request matrix

Conventions for every row:

- Base path `/api/latest/fleet`. Each list shape runs **twice**: fleet-scoped (`fleet_id=$FLEET`)
  and all-fleets (no `fleet_id`), because the two aggregate differently (`global_stats` rows vs
  per-team rows in `software_host_counts` / `vulnerability_host_counts`).
- Every `hosts?…` shape also runs as `hosts/count?…` with the same params — the UI pairs them and
  the count query has blown up independently (#47722, #52213).
- `per_page=50` for hosts (UI default), `20` for everything else, unless the row says otherwise.
- Priority: **P0** = known-broken or a UI default request; **P1** = allowlisted sort/filter nobody
  has measured; **P2** = long tail / API-only consumers.
- IDs resolved at run start (see §7): `$HOST_FIRST` (display_name asc), `$HOST_ISSUES`
  (`order_key=issues desc`), `$HOST_WIN` (Windows label, MDM-enrolled), `$TITLE_TOP`,
  `$TITLE_INSTALLER` (`available_for_install=true`), `$VERSION_TOP`, `$CVE_TOP`
  (`order_key=hosts_count desc`), `$CVE_RARE` (lowest non-zero host count), `$OSV_TOP`,
  `$LABEL_MAC` / `$LABEL_ALL` (builtins), `$LABEL_DYN` (biggest regular label), `$LABEL_MANUAL`,
  `$POLICY_G` / `$POLICY_T`, `$REPORT_T`, `$PROFILE_UUID`, `$SCRIPT_ID`, `$BATCH_ID`,
  `$HOST_PREFIX` (first 3 chars of a hostname), `$SERIAL`, `$EMAIL`.

### 6.1 Hosts list — `GET hosts` (+ `hosts/count` twin)

| # | Shape | Why | Pri |
|---|---|---|---|
| H1 | no sort, `per_page=50` | control (0.14 s) | P0 |
| H2 | `order_key=display_name` asc **and** desc | UI default; 6–39 s | P0 |
| H3 | `order_key=` each of: `hostname`, `computer_name`, `issues`, `seen_time`, `last_restarted_at`, `last_enrolled_at`, `created_at`, `updated_at`, `detail_updated_at`, `platform`, `os_version`, `osquery_version`, `memory`, `cpu_type`, `hardware_vendor`, `hardware_model`, `hardware_serial`, `primary_ip`, `primary_mac`, `public_ip`, `team_name`, `agent` (orbit), `fleet_desktop_version`, `software_updated_at`, `gigs_disk_space_available`, `percent_disk_space_available`, `gigs_total_disk_space`, `uuid`, `label_updated_at`, `policy_updated_at` — desc only, asc for the UI-sortable ones | full `hostAllowedOrderKeys` allowlist; #44388 | P1 (issues / seen_time P0) |
| H4 | `page=0`, `100`, `1000`, last page (`count/per_page`) with the UI default sort | offset pagination cost | P0 |
| H5 | `per_page=100`, `500` | API consumers | P2 |
| H6 | `status=online` / `offline` / `new` / `missing` / `mia` / `enrolled` | status dropdown | P0 |
| H7 | `query=` 1 char, `$HOST_PREFIX`, full hostname, `$SERIAL`, uuid, `10.` (IPv4 prefix), `$EMAIL` local part, full `$EMAIL` | search box; #15744 | P0 |
| H8 | H7 × `device_mapping=true` | #47722 | P0 |
| H9 | `labels/{id}/hosts` for `$LABEL_ALL`, `$LABEL_MAC`, Windows, Linux, iOS, Android, `$LABEL_DYN`, `$LABEL_MANUAL`; each with H2 sort and `status=online` | platform + label filters | P0 |
| H10 | `policy_id=$POLICY_G&policy_response=failing` / `passing`; same for `$POLICY_T` | policy "view hosts"; 30k/30k split on the instance | P0 |
| H11 | `software_title_id=$TITLE_TOP`; `software_version_id=$VERSION_TOP`; `software_title_id=$TITLE_INSTALLER&software_status=installed` / `pending` / `failed` | software "view hosts" | P1 |
| H12 | `os_version_id=$OSV_TOP`; `os_name=…&os_version=…` | OS "view hosts" | P1 |
| H13 | `vulnerability=$CVE_TOP` and `$CVE_RARE` | CVE affected hosts; #52213 | P0 |
| H14 | `mdm_enrollment_status=enrolled` / `manual` / `automatic` / `pending` / `unenrolled` / `manual-personal`; `mdm_name=Fleet`; `connected_to_fleet=true` | MDM filters | P1 |
| H15 | `os_settings=verified` / `verifying` / `pending` / `failed`; `os_settings_disk_encryption=verified` / `enforcing` / `action_required` / `failed`; `macos_settings=…`; `macos_settings_disk_encryption=…` | OS settings status links; #48996 (needs profiles applied) | P0 |
| H16 | `bootstrap_package=installed` / `pending` / `failed`; `profile_uuid=$PROFILE_UUID&profile_status=verified` / `pending` / `failed`; `dep_profile_error=true`; `dep_assign_profile_response=SUCCESS`; `munki_issue_id=`; `low_disk_space=10` / `32` | remaining MDM / premium filters | P1 |
| H17 | `script_batch_execution_id=$BATCH_ID&script_batch_execution_status=ran` / `pending` / `errored` | batch script progress | P1 |
| H18 | `populate_software=true`; `populate_software=without_vulnerability_details`; `populate_policies=true`; `populate_users=true`; `populate_labels=true`; `include_device_status=true`; `device_mapping=true` (no query); `disable_failing_policies=true` (the documented fast path) | payload expanders; 15 s today | P0 |
| H19 | combos: `status=online` + `$LABEL_MAC` + `query=$HOST_PREFIX`; `os_settings=failed&order_key=issues`; `vulnerability=$CVE_TOP&order_key=display_name` | realistic worst case | P1 |
| H20 | `hosts/report?format=csv` — fleet, all fleets, `+label_id`, `+status=online`, `+query=`, `+columns=hostname,hardware_serial,os_version` | Export hosts; 16.8 s | P0 |
| H21 | `host_summary` — fleet, all; `platform=darwin` / `windows` / `linux` / `ios` / `ipados` / `android` / `chrome`; `low_disk_space=32` | Dashboard cards; 2.5–5.5 s | P0 |
| H22 | `hosts/summary/mdm` (fleet / all / platform); `macadmins` (fleet / all) | Dashboard MDM + Munki cards; 5.6–15 s | P0 |

### 6.2 Host details fan-out — for each of `$HOST_FIRST`, `$HOST_ISSUES`, `$HOST_WIN`

| # | Shape | Why | Pri |
|---|---|---|---|
| D1 | `hosts/{id}`; `hosts/identifier/{serial}`; `hosts/identifier/{serial}?exclude_software=true` | details page; API integrations | P0 |
| D2 | `hosts/{id}/software` default; `order_key=name&order_direction=desc`; `per_page=100`; last page; `query=`; `vulnerable=true`; `exploit=true`; `min_cvss_score=7`; `available_for_install=true`; `include_available_for_install=true`; `self_service=true`; `macos_applications=true` | Software tab + Library view; #51896 needs a host with install history | P0 |
| D3 | `hosts/{id}/activities` (p1, `page=100`, `order_key=created_at`); `hosts/{id}/activities/upcoming` | Activity card | P1 |
| D4 | `hosts/{id}/reports`; `hosts/{id}/reports/{report_id}` | Reports tab | P1 |
| D5 | `hosts/{id}/configuration_profiles`; `hosts/{id}/certificates` (+`order_key=not_valid_after` / `common_name`); `hosts/{id}/scripts`; `hosts/{id}/device_mapping`; `hosts/{id}/macadmins`; `hosts/{id}/mdm`; `hosts/{id}/encryption_key`; `hosts/{id}/health`; `hosts/{id}/dep_assignment` | remaining cards | P1 |
| D6 | `commands?host_identifier={uuid}&per_page=10`; `+command_status=ran` / `pending` / `failed`; `+request_type=InstallProfile`; `+order_key=updated_at&order_direction=desc`; `page=10`; `commands/results?command_uuid=` | MDM commands table; #44170 | P0 |

### 6.3 Software — `software/titles`, `software/versions`, `software`, FMA, App Store

| # | Shape | Why | Pri |
|---|---|---|---|
| S1 | `software/titles` default (`hosts_count desc`) | control | P0 |
| S2 | `order_key=name` asc + desc; `order_key=hosts_count` asc | #35799; 18 s | P0 |
| S3 | `page=100`, `1000`, last (≈25k) — with default and with `name` sort | pagination | P0 |
| S4 | `vulnerable=true`; `vulnerable=true&exploit=true`; `vulnerable=true&min_cvss_score=7`; `max_cvss_score=8`; `min=7&max=9` | #51954, #35799; 422s | P0 |
| S5 | `query=chrome`; `query=a`; `query=Microsoft`; `query=$CVE_TOP` (title search matches CVE) | search; 30 s / 422 | P0 |
| S6 | `available_for_install=true`; `self_service=true`; `packages_only=true`; `available_for_install=true&platform=darwin` / `windows` / `linux` / `ios` / `ipados` / `android`; `exclude_fleet_maintained_apps=true` | Library tab + platform filter; 10 s | P0 |
| S7 | `hash_sha256=` / `package_name=` lookups (fleet-scoped) | gitops dedupe path | P2 |
| S8 | combo: `vulnerable=true&exploit=true&min_cvss_score=7&order_key=name&query=a` | worst case | P1 |
| S9 | `software/titles/{id}` (fleet / all); `software/titles/{id}/package` | title detail | P1 |
| S10 | `software/versions` default; `order_key=name` asc/desc; `cve_published` / `cvss_score` / `epss_probability` / `cisa_known_exploit` desc; `page=1000` / last (≈40k) | #45415; 422 at 35 s | P0 |
| S11 | `software/versions?vulnerable=true`; `+exploit=true`; `+min_cvss_score=7`; `+max_cvss_score=8`; `+query=chrome` — each with `without_vulnerability_details=true` (UI) and `false` (API default) | #45415; 13–49 s | P0 |
| S12 | `software/versions` with **no** `per_page` | #43030 / #47755 regression guard | P0 |
| S13 | `software/versions/{id}` | version detail | P1 |
| S14 | legacy `software` list: default and `vulnerable=true` | fleetctl / older integrations | P2 |
| S15 | `software/fleet_maintained_apps?fleet_id`; `+platform=darwin` / `windows`; `+available=true`; `+order_key=name`; `fleet_maintained_apps/{id}` | Add software › Fleet-maintained; 6–36 s | P0 |
| S16 | `software/app_store_apps?fleet_id`; `software/self_service_categories` | App Store tab (needs a VPP token; expect 4xx otherwise) | P2 |
| S17 | `setup_experience/software?fleet_id&platform=macos` / `windows` / `linux` / `ios` / `ipados` / `android`; `setup_experience/script?fleet_id` | Controls › Setup experience | P1 |

### 6.4 Vulnerabilities — `vulnerabilities`

| # | Shape | Why | Pri |
|---|---|---|---|
| V1 | no params (implicit default) **and** `order_key=created_at&order_direction=desc` (explicit) | 4 s vs 28 s — different plans | P0 |
| V2 | `order_key=` `cve` / `cvss_score` / `epss_probability` / `cve_published` / `hosts_count` × asc/desc | full allowlist | P0 |
| V3 | `exploit=true` (+ each V2 sort) | exploited filter | P0 |
| V4 | `query=CVE-2024`; `query=$CVE_TOP`; `query=2021`; `query=1171` | search | P1 |
| V5 | `page=100` / `1000` / last (≈2.3k); `per_page=100` | pagination | P1 |
| V6 | `vulnerabilities/{cve}` for `$CVE_TOP` and `$CVE_RARE` (fleet / all) | CVE detail | P0 |
| V7 | H13 (`hosts?vulnerability=` + count) immediately after V6 | the "affected hosts" click; #52213 | P0 |

### 6.5 Operating systems — `os_versions`

| # | Shape | Why | Pri |
|---|---|---|---|
| O1 | no params — fleet **and** all fleets | 42–52 s; Dashboard OS card, Software › OS, OS updates | P0 |
| O2 | `platform=darwin` / `windows` / `linux` / `ios` / `ipados` / `android` / `chrome` | 0.09 s — the comparison that isolates the bug | P0 |
| O3 | `order_key=hosts_count` asc / desc; `page=1`; `per_page=100`; `max_vulnerabilities=5`; `os_name=…&os_version=…` | remaining params | P1 |
| O4 | `os_versions/{id}` (fleet / all); then H12 | OS detail + view hosts | P1 |

### 6.6 Policies (needs the 500-policy bundle applied to `$FLEET`)

| # | Shape | Why | Pri |
|---|---|---|---|
| P1 | `policies` (global); `policies/count`; `fleets/{id}/policies`; `fleets/{id}/policies/count` | All fleets + team pages | P0 |
| P2 | `fleets/{id}/policies?merge_inherited=true`; `inherited_page=1&inherited_per_page=20` | inherited block | P1 |
| P3 | `automation_type=software` / `patch` / `scripts` / `calendar` / `conditional_access` / `profiles` / `other` | automation filter | P1 |
| P4 | `platform=darwin`; `query=policy-1`; `order_key=name` / `failing_host_count` / `passing_host_count` / `updated_at` × asc/desc; `page=10` | sorts over host-count aggregates | P0 |
| P5 | `policies/{id}`; `fleets/{id}/policies/{id}`; `policies/{id}/automation_activities` (+`status=error` / `success`, `page=10`) | detail page | P1 |
| P6 | H10 | policy "view hosts" | P0 |

### 6.7 Reports (needs the 500-report bundle)

| # | Shape | Why | Pri |
|---|---|---|---|
| R1 | `reports` (global, 503 today); `reports?fleet_id`; `+merge_inherited=true` | list pages | P0 |
| R2 | `platform=macos` / `windows` / `linux`; `query=query-1`; `query=q`; `order_key=name` / `updated_at` / `created_at` × asc/desc; `page=10` | filters + allowlist | P1 |
| R3 | `reports/{id}`; `reports/{id}/report` (results; fleet / all; `+per_page=20&page=100`; `+order_key=`; `+query=`) | report results can be 100k rows × columns | P0 |
| R4 | `spec/reports`; `schedule`; `packs`; `packs/{id}/scheduled` | gitops / legacy consumers | P2 |

### 6.8 Labels

| # | Shape | Why | Pri |
|---|---|---|---|
| L1 | `labels` (default, host counts on); `labels?include_host_counts=false`; `labels?fleet_id=global`; `labels?fleet_id=$FLEET` | #4890 regressed; 37–48 s | P0 |
| L2 | `order_key=name` / `host_count` / `created_at` × asc/desc | allowlist | P1 |
| L3 | `labels/summary` (+`fleet_id`); `labels/{id}` for each resolved label | pickers + detail | P1 |
| L4 | H9 for `$LABEL_ALL` (100k members) and `$LABEL_DYN`, with `page=last` and `status=online` | label detail host list | P0 |
| L5 | `spec/labels` | gitops | P2 |

### 6.9 Controls / MDM (needs the profile + script bundle; Windows profiles for #48996 / #42565)

| # | Shape | Why | Pri |
|---|---|---|---|
| C1 | `configuration_profiles?fleet_id` (+`order_key=name` / `uploaded_at`; `per_page=1000`; `page=5`) | profiles list | P0 |
| C2 | `configuration_profiles/summary?fleet_id`; `disk_encryption?fleet_id`; `mdm/apple/filevault/summary?fleet_id`; `bootstrap/summary?fleet_id` | OS settings page aggregates; #42565 | P0 |
| C3 | `configuration_profiles/{uuid}`; `configuration_profiles/{uuid}/status` | profile detail / status modal | P1 |
| C4 | H15 right after C2 | the status links; #48996 | P0 |
| C5 | `scripts?fleet_id` (+`order_key=name` / `updated_at`; `per_page=400`; `page=10`); `scripts/{id}`; `scripts/{id}?alt=media` | scripts library | P1 |
| C6 | `scripts/batch?fleet_id&status=started` / `finished` / `scheduled`; `scripts/batch/{id}`; `scripts/batch/{id}/host_results?status=ran` / `pending` / `errored` / `incompatible` / `canceled` (+`order_key=display_name` / `hostname` / `updated_at`) | batch progress | P1 |
| C7 | `custom_variables`; `custom_host_vitals`; `certificates?fleet_id` (+`page`); `certificates/{id}`; `certificate_authorities`; `enrollment_profiles/automatic?fleet_id`; `bootstrap/{fleet}/metadata`; `setup_experience/eula/metadata` | remaining Controls pages | P2 |
| C8 | `apns`; `abm`; `ab_tokens`; `vpp_tokens`; `mdm/apple`; `scim/details`; `microsoft_graph_credentials` | integrations settings | P2 |

### 6.10 Dashboard as a group

Run the full `/dashboard?fleet_id` fan-out back-to-back and report the **max** as the page's
server cost: `config`, `fleets`, `me`, H21 (7 platform variants), `labels/summary`,
`hosts/summary/mdm`, `macadmins`, O1, `software/versions?order_key=hosts_count&order_direction=desc&per_page=8`
(top software card), `activities?per_page=8` (all-fleets only), `charts/{metric}` (metric names in
`frontend/services/entities/charts.ts`). Repeat without `fleet_id` for the All-fleets dashboard.

### 6.11 Admin / global

| # | Shape | Why | Pri |
|---|---|---|---|
| A1 | `users` (+`query=`; `fleet_id`; `order_key=name` / `email` / `created_at`; `page`); `users/{id}`; `invites` | users page (needs more than 2 users to mean anything) | P2 |
| A2 | `fleets` (+`query=`; `order_key=name`; `page`); `fleets/{id}`; `fleets/{id}/users`; `fleets/{id}/secrets` | fleet pickers | P1 |
| A3 | `activities` (+`order_key=created_at` desc, `id`, `user_name`, `activity_type`; `query=admin`; `activity_type=…`; `start_created_at` / `end_created_at`; `page=100` / `1000` / last of ≈100k; `per_page=100`) | Activity feed; #44388 | P1 |
| A4 | `config`; `config/certificate`; `version`; `me`; `rest_api`; `status/result_store`; `status/live_query`; `spec/enroll_secret`; `carves` | cheap controls / API-only | P2 |

### 6.12 Write path (opt-in flag, runs last, on a throwaway fleet)

`POST hosts/transfer` (1k / 10k / 30k ids) and `hosts/transfer/filter`; `POST hosts/delete` (1k);
`POST labels` (dynamic, matches all hosts) then `DELETE`; `POST fleets/{id}/policies` + `PATCH`
(membership rewrite) then `DELETE`; `POST reports/run` targeting all hosts; `POST mdm/profiles/batch`
(100 Windows + 100 macOS, then empty to remove); `POST software/batch` (40+ FMAs);
`POST spec/teams` (the gitops bundle); `POST hosts/{id}/refetch`; `POST scripts/run/batch` to 100k.
These are minutes-not-seconds operations by nature; the script should time them and record the
side-effects (`hosts/count` drift, `activities` growth), not gate them at 5 s.

### 6.13 Device / agent (optional)

`device/{token}`, `device/{token}/software`, `device/{token}/policies`, `device/{token}/desktop`
(the My device page) using a token from `hosts/{id}/device_url`. Agent paths (`osquery/config`,
`distributed/read` / `write`, `orbit/config`) are exercised by osquery-perf continuously and show
up in the metrics synopsis, not here.

---

## 7. How the script should take measurements

1. **One request in flight, always.** Two concurrent probe scripts tripled the hosts-list latency
   (5.9 s → 39 s). `workers: 1`, no `Promise.all` across shapes. The matrix is long; accept the
   runtime (estimate: ~350 shapes × 5 samples × fleet/all ≈ 1–2 h on a healthy build, longer when
   things are broken).
2. **Warm-up then N samples, shapes interleaved.** Discard one call per shape, then take N = 5
   (P2), 10 (P1), 20 (P0 and anything over 5 s on the previous run). Randomise the order of shapes
   within each iteration (Victor's gist for #35799 does this) so a slow neighbour's cache effect is
   spread rather than attributed to one row.
3. **Record per call:** HTTP status, time-to-first-byte, total, bytes, the response `count` /
   `meta` (so an empty result is visible), and on ≥400 the body's `uuid`. Report median, p95, max.
4. **Gate on median ≤ 5 s *and* max ≤ 5 s** — a 4 s median hiding a 40 s outlier is what users
   see. Any 422 / 5xx / timeout is a failure regardless of timing. Colour the markdown table
   ✅ ≤ 2 s / ⚠️ 2–5 s / ❌ > 5 s or error, with the delta against the previous stored run, the way
   `tools/loadtest/metrics/compare-metrics.sh` in the fleet repo does for CloudWatch numbers.
5. **Timeout 90 s per call.** The ALB idle timeout is 60 s; 502 / 504 arrive at 60–90 s, and
   those are the signals #44170 / #47755 were filed on.
6. **Mirror the browser.** `/api/latest`, `Accept-Encoding: gzip`, the UI's exact param spelling
   (`fleet_id`, `without_vulnerability_details=true` on versions, `include_host_counts=false` on
   labels) — and the API-consumer spelling next to it where they differ (default labels call,
   explicit `order_key=created_at`), because fleetctl and integrations send the latter.
7. **Resolve IDs up front, record run metadata.** Fleet version (`/version`), fleet id, host /
   title / version / CVE / label / policy / report / profile counts, worker count, start/end time,
   and the resolved IDs from §6. Fail the run (do not record) when a precondition count is 0 for a
   family — an empty-state 80 ms is worse than no number, which is the trap the UI suite fell into
   on this instance.
8. **Where it lives.** A `loadtest-api` Playwright project (`tests/loadtest-api/`, `workers: 1`,
   `retries: 0`, `expect(median).toBeLessThan(5000)`) reuses `.env.loadtest`, the bearer-token
   helpers in `helpers/api/core.ts`, and the `.perf-history` teardown so API runs sit next to UI
   runs and are diffed the same way. Keep the shape list as a data file
   (`tests/loadtest-api/shapes.ts`: `{ family, id, path, params, priority, samples, issue }`) so
   it can also be driven as a plain script and so adding a shape is one line.
9. **Dataset preconditions to automate or document per run:** apply `gitops/loadtest/generated/`
   to the hosts' fleet (policies, reports, labels, scripts, macOS + Windows profiles); seed host
   emails with the SQL from #15744; create install history on a few hosts for #51896; let the
   Windows profile reconciler churn before D6 (#44170); wait for the vuln and software crons.

---

## 8. UI suite follow-ups that this audit changes

The existing audit's quick wins still stand (fix the four shell-only anchors, replace `rowOrEmpty()`
with row-count assertions, use `measureSearch` for `Reports › Team - search`, record run metadata,
pin `workers=1` and sample 3×). On top of that, from the probe:

- **Split API time from render time** inside `measureNav` with `page.waitForResponse` on the
  page's primary request, so a 20 s Hosts list can be attributed (it is the `display_name` sort,
  not React).
- **Add a 5 s budget assertion** per measurement once sampling is ≥ 3; today a 50 s OS page passes.
- **Add the pages whose requests are the slow ones:** Dashboard OS card (`os_versions`), Software
  › OS without a platform filter, Software Library / Fleet-maintained / App Store tabs, Export
  hosts (CSV), hosts page 1000, OS settings page itself, CVE / OS / label / policy / report detail
  pages, and the `vulnerable=true` software filter (which the suite already runs and which
  currently 422s — confirm `pageHealth` is catching that as a failure rather than an empty state).
- **Fix the dataset before trusting the numbers:** apply the bundle to fleet 1 (or point
  `FLEET_LOADTEST_FLEET_ID` at a fleet that has both the bundle and the hosts) and assert the
  counts in `loadtest.setup.ts`.
