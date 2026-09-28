# API role-access probes — test audit

**Specs covered:** 5 files · **Test declarations:** 14 · **Projects:** premium / free

This area is Fleet's RBAC surface probed over HTTP only — no browser. Each test picks a
pre-provisioned **API-only static user** from [`helpers/api/static-users.ts`](../../helpers/api/static-users.ts),
grabs that user's bearer token out of `.env.<suite>`, fires 3–6 single-request "probes" from
[`helpers/api/role-access.ts`](../../helpers/api/role-access.ts), and classifies each response
**purely by status code**: `401`/`403` = denied, *everything else* = allowed. Four premium specs
cover the six global roles, fleet-scoped roles, multi-fleet role composition, and the
`api_endpoints` (specific-endpoints) restriction; one free spec covers the three free roles.
The useful unit of review here is the **role × endpoint matrix**, not the 14 test bodies —
see [Role × endpoint matrices](#role--endpoint-matrices).

## How to re-run a probe by hand

Every probe is one HTTP request. Tokens are shared secrets in 1Password (never mint new ones —
they are shown once at user-creation time; see `playwright/CLAUDE.md` § Env vars) and land in
`.env.premium` / `.env.free` as `FLEET_STATIC_TOKEN_<KEY_UPPER>`.

```bash
# denied = 401/403 · allowed = anything else (the suite's own definition)
curl -sk -o /dev/null -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $FLEET_STATIC_TOKEN_API_GLOBAL_MAINTAINER" \
  -H 'Content-Type: application/json' -d '{}' \
  "$FLEET_URL/api/v1/fleet/users/admin"
```

Write probes always send `{}` — Fleet rejects a bodyless POST/PATCH with `400 Expected JSON Body`
*before* authz, which would erase the signal. For every endpoint in the catalog authz runs
**before** body validation, so an authorized caller gets `400`/`422` and an unauthorized one gets
`403`; nothing is ever created. `POST /scripts` and `POST /scripts/run` are deliberately absent
from the catalog because they validate the body first ([role-access.ts:1-16](../../helpers/api/role-access.ts)).

## Probe catalog

| Key | Method + path | Fleet handler | Notes |
|---|---|---|---|
| `PROBES_ADMIN_ONLY.createUser` | `POST /api/v1/fleet/users/admin` | `createUserEndpoint` | authz object `user` / write → global admin only (team admins only for users wholly inside their fleets) |
| `PROBES_ADMIN_ONLY.createFleet` | `POST /api/v1/fleet/fleets` | `createTeamEndpoint` | authz object `team` / write → admin + gitops. **Premium-only: on free this handler calls `SkipAuthorization` and returns 402** |
| `PROBES_MAINTAINER.createPolicy` | `POST /api/v1/fleet/global/policies` | `globalPolicyEndpoint` (v1-only route) | authz `policy` / write → admin, maintainer, **gitops** |
| `PROBES_MAINTAINER.createReport` | `POST /api/v1/fleet/reports` | `createQueryEndpoint` | reports *are* queries; authz `query` / write → admin, maintainer, **gitops** |
| `PROBES_OBSERVER.listHosts` | `GET /api/v1/fleet/hosts` | `listHostsEndpoint` | authz `host` / **list** → all roles except gitops (gitops only gets `selective_list`) |
| `PROBES_OBSERVER.listGlobalPolicies` | `GET /api/v1/fleet/global/policies` | `listGlobalPoliciesEndpoint` | authz `policy` / read → every role incl. gitops |
| `PROBES_GITOPS.configForUpdate` | `GET /api/v1/fleet/config?for_update=true` | `getAppConfigEndpoint` | `for_update` is **not a parameter of this route** (only of an Apple-MDM request struct), so this is a plain config read — `app_config`/read is allowed for *every* role |
| `fleetScopedProbes(id).listPolicies` | `GET /api/v1/fleet/fleets/{id}/policies` | team policies list | path form chosen because the `?team_id=` form 404s instead of 403ing |
| `fleetScopedProbes(id).createPolicy` | `POST /api/v1/fleet/fleets/{id}/policies` | team policy create | fleet-role admin/maintainer/gitops → write |

Ground truth used for the cross-check below: Fleet's own permission tables in
`~/repositories/fleet/articles/role-based-access.md` (published as
<https://fleetdm.com/guides/role-based-access>) and the authoritative OPA policy
`~/repositories/fleet/server/authz/policy.rego` (both read at Fleet commit `5e24620862`, 2026-07-29).

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| ROLE-01 | `api/role-access/premium/global-roles.spec.ts` | Premium • API global role access › global admin can hit admin-only writes and observer reads | API | ☐ |
| ROLE-02 | `api/role-access/premium/global-roles.spec.ts` | … › global maintainer can write policies/reports but not users or fleets | API | ☐ |
| ROLE-03 | `api/role-access/premium/global-roles.spec.ts` | … › global technician can read hosts but cannot author policies or reports | API | ☐ |
| ROLE-04 | `api/role-access/premium/global-roles.spec.ts` | … › global observer+ cannot author policies or reports | API | ☐ |
| ROLE-05 | `api/role-access/premium/global-roles.spec.ts` | … › global observer can read but cannot write | API | ☐ |
| ROLE-06 | `api/role-access/premium/global-roles.spec.ts` | … › global gitops can hit the for-update config and admin writes but not host reads | API | ☐ |
| ROLE-07 | `api/role-access/premium/fleet-scoped-roles.spec.ts` | Premium • API fleet-scoped role access › Workstations maintainer can write inside Workstations but not in QA | API | ☐ |
| ROLE-08 | `api/role-access/premium/fleet-scoped-roles.spec.ts` | … › Workstations observer can read inside Workstations but cannot write | API | ☐ |
| ROLE-09 | `api/role-access/premium/multi-fleet-roles.spec.ts` | Premium • API multi-fleet role composition › Maintainer on Workstations + Observer on QA — writes only where Maintainer | API | ☐ |
| ROLE-10 | `api/role-access/premium/specific-endpoints.spec.ts` | Premium • API specific-endpoints restriction › global admin restricted to GET /hosts + GET /global/policies | API | ☐ |
| ROLE-11 | `api/role-access/premium/specific-endpoints.spec.ts` | … › Workstations maintainer restricted to fleet policies stays fleet-scoped | API | ☐ |
| ROLE-12 | `api/role-access/free/global-roles.spec.ts` | Free • API role access › global admin can hit admin-only writes and reads | API | ☐ |
| ROLE-13 | `api/role-access/free/global-roles.spec.ts` | … › global maintainer can write policies but not users | API | ☐ |
| ROLE-14 | `api/role-access/free/global-roles.spec.ts` | … › global observer can read but cannot write | API | ☐ |

`Mode` is **API** for all 14 — none of them opens a page (though all 14 still *launch* one, see
[Efficiency](#efficiency--false-green-risks)).

---

## Role × endpoint matrices

Legend: `☐ allow` = probe asserts *not* 401/403 · `☐ deny` = probe asserts 401/403 · `·` = not probed ·
`(docs: …)` = what Fleet's permission tables + `policy.rego` say the unprobed cell should be.

### premium/global-roles.spec.ts — 6 roles × 7 endpoints (ROLE-01…06)

| Role (static user) | `POST /users/admin` | `POST /fleets` | `POST /global/policies` | `POST /reports` | `GET /hosts` | `GET /global/policies` | `GET /config` |
|---|---|---|---|---|---|---|---|
| admin (`api-global-admin`) | ☐ allow | ☐ allow | ☐ allow | · (docs: allow) | ☐ allow | · (docs: allow) | · (docs: allow) |
| maintainer (`api-global-maintainer`) | ☐ deny | ☐ deny | ☐ allow | ☐ allow | ☐ allow | · (docs: allow) | · (docs: allow) |
| technician (`api-global-technician`) | ☐ deny | · (docs: deny) | ☐ deny | ☐ deny | ☐ allow | · (docs: allow) | · (docs: allow) |
| observer+ (`api-global-observer-plus`) | · (docs: deny) | · (docs: deny) | ☐ deny | ☐ deny | ☐ allow | · (docs: allow) | · (docs: allow) |
| observer (`api-global-observer`) | ☐ deny | · (docs: deny) | ☐ deny | ☐ deny | ☐ allow | ☐ allow | · (docs: allow) |
| gitops (`api-global-gitops`) | · (docs: **deny**) | ☐ allow | · (docs: **allow**) | · (docs: **allow**) | ☐ deny | · (docs: **allow**) | ☐ allow |

24 of 42 cells filled (4 + 5 + 4 + 3 + 5 + 3 probes, top row down). The four bold gitops cells are the interesting misses: gitops is *not*
write-only — `policy.rego:759-763` and `:502-507` grant it policy and query (report) **write**, and
`:766-771`/article "View all policies" grant it policy **read** — none of which is probed, while
the one gitops "allow" that *is* probed (`GET /config`) is allowed for every role and therefore
proves nothing about gitops specifically.

### premium/fleet-scoped-roles.spec.ts — 2 roles × 8 endpoints (ROLE-07…08)

| Role (static user) | `GET /fleets/{WS}/policies` | `POST /fleets/{WS}/policies` | `GET /fleets/{QA}/policies` | `POST /fleets/{QA}/policies` | `POST /global/policies` | `POST /users/admin` | `POST /fleets` | `GET /hosts` |
|---|---|---|---|---|---|---|---|---|
| WS maintainer (`api-ws-maintainer`) | ☐ allow | ☐ allow | ☐ deny | ☐ deny | · (docs: deny) | ☐ deny | ☐ deny | · (docs: allow, WS hosts only) |
| WS observer (`api-ws-observer`) | ☐ allow | ☐ deny | ☐ deny | · (docs: deny) | ☐ deny | · (docs: deny) | · (docs: deny) | · (docs: allow, WS hosts only) |

Not covered at all: **fleet admin** (`api-ws-admin` is provisioned and its token is in `.env`, but
no spec uses it), fleet technician, fleet observer+, fleet gitops. Fleet-scoped *data* filtering
(the "allow" that returns only the fleet's rows) is never asserted — only the status code is read,
so a Workstations observer receiving **all** hosts/policies would still pass.

### premium/multi-fleet-roles.spec.ts — 1 composite role × 5 endpoints (ROLE-09)

| Role (static user) | `GET /fleets/{WS}/policies` | `POST /fleets/{WS}/policies` | `GET /fleets/{QA}/policies` | `POST /fleets/{QA}/policies` | `POST /users/admin` |
|---|---|---|---|---|---|
| Maintainer@WS + Observer@QA (`api-ws-maint-qa-obs`) | ☐ allow | ☐ allow | ☐ allow | ☐ deny | ☐ deny |

The only spec in the area that exercises role *composition*. Untested composition edge: a user who
is Observer on WS + Maintainer on QA (reverse order) — no static user exists.

### premium/specific-endpoints.spec.ts — 2 restricted users × 8 endpoints (ROLE-10…11)

| Role + allow list | `GET /hosts` | `GET /global/policies` | `GET /fleets/{WS}/policies` | `GET /fleets/{QA}/policies` | `POST /fleets/{WS}/policies` | `POST /users/admin` | `POST /fleets` | `POST /global/policies` |
|---|---|---|---|---|---|---|---|---|
| global admin, allow list `GET /hosts` + `GET /global/policies` (`api-specific-endpoints-global`) | ☐ allow | ☐ allow | · (docs: deny — off-list) | · (docs: deny) | · (docs: deny) | ☐ deny | ☐ deny | ☐ deny |
| WS maintainer, allow list `GET /hosts` + `GET /fleets/:id/policies` (`api-specific-endpoints-ws`) | ☐ allow | ☐ deny | ☐ allow | ☐ deny | ☐ deny | · (docs: deny) | · (docs: deny) | · (docs: deny) |

Both users are the *positive* configuration of the feature. Never probed: an allow-listed endpoint
whose route is **not in Fleet's api_endpoints catalog** (first branch of
`server/service/middleware/auth/api_only.go` — also 403), an api-only user with an **empty** allow
list (must fall through to plain role authz — i.e. every other spec in this file relies on that
behaviour implicitly), a `PATCH`/`DELETE` allow list entry, and method-mismatch
(`GET /hosts` allow-listed but `POST /hosts` attempted).

### free/global-roles.spec.ts — 3 roles × 5 endpoints (ROLE-12…14)

| Role (static user) | `POST /users/admin` | `POST /global/policies` | `POST /reports` | `GET /hosts` | `GET /global/policies` |
|---|---|---|---|---|---|
| admin (`api-global-admin`) | ☐ allow | ☐ allow | · (docs: allow) | ☐ allow | · (docs: allow) |
| maintainer (`api-global-maintainer`) | ☐ deny | ☐ allow | ☐ allow | ☐ allow | · (docs: allow) |
| observer (`api-global-observer`) | ☐ deny | ☐ deny | · (docs: deny) | ☐ allow | ☐ allow |

Free has exactly three roles (observer+/technician/gitops are premium-only), so **role** coverage is
complete here; endpoint coverage is a strict subset of the premium spec. Deliberately absent —
and correctly so — is `POST /fleets`: on free that handler skips authorization entirely and returns
402, which this helper would score as "allowed" for *every* role.

---

### ROLE-01 · Premium • API global role access › global admin can hit admin-only writes and observer reads

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global admin can hit admin-only writes and observer reads"`
- **Project:** premium · **Actor:** `api-global-admin` (global admin, api-only) via `FLEET_STATIC_TOKEN_API_GLOBAL_ADMIN`
- **Mode:** API · **Isolation:** independent test, no shared state, no cleanup
- **Preconditions:** static user provisioned on the instance and its bearer token present in `.env.premium` (missing token throws, does not skip)
- **Data created:** none — every write probe sends `{}` and dies in validation *after* the authz check

**Flow**

1. ☐ `POST /users/admin` with `{}`.
   - ✅ *(API)* status ∉ {401,403} — expected real status `422` (email/name required).
2. ☐ `POST /fleets` with `{}`.
   - ✅ *(API)* status ∉ {401,403} — expected `400`/`422`.
3. ☐ `POST /global/policies` with `{}`.
   - ✅ *(API)* status ∉ {401,403} — expected `400`/`422`.
4. ☐ `GET /hosts`.
   - ✅ *(API)* status ∉ {401,403} — expected `200`. Body is never inspected.

**Assessment**
- *Value:* catches a total lockout of the admin role / a broken static-user token; it is the positive control for every deny in ROLE-02…06.
- *Coverage gaps:* no `POST /reports`, no config read, no assertion that the response body is sane (a `404` from a renamed route, a `402` from a license flip, or a `500` all score as "allowed").
- *Redundancy:* near-duplicate of ROLE-12 (free) minus `POST /fleets`.
- *Efficiency / smells:* imports `test` from `@fixtures` while using no page-object/worker fixture, so the auto `pageHealth` fixture (`fixtures.ts:270`, `auto: true`, depends on `page`) launches a browser context this test never touches — `@playwright/test` would do (CLAUDE.md sanctions that for pure-API specs).

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### ROLE-02 · Premium • API global role access › global maintainer can write policies/reports but not users or fleets

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global maintainer can write policies/reports but not users or fleets"`
- **Project:** premium · **Actor:** `api-global-maintainer` via `FLEET_STATIC_TOKEN_API_GLOBAL_MAINTAINER`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `POST /global/policies` `{}` → ✅ *(API)* allowed (∉ {401,403}).
2. ☐ `POST /reports` `{}` → ✅ *(API)* allowed. (`/reports` is the renamed queries endpoint — `createQueryEndpoint`.)
3. ☐ `GET /hosts` → ✅ *(API)* allowed.
4. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied (401 or 403; real answer `403`).
5. ☐ `POST /fleets` `{}` → ✅ *(API)* denied (real answer `403`).

**Assessment**
- *Value:* the maintainer/admin boundary is the most commonly regressed cell in Fleet's matrix (users + fleets are admin-only); this is a cheap guard on it.
- *Coverage gaps:* maintainer's *other* documented grants are unprobed — enroll secrets, labels, packs, config profiles, software add/edit/delete, script upload, host delete/transfer, lock/wipe, `PATCH /config` (must be denied). The admin-only *reads* that are API-only (SSO settings, SMTP settings, agent options) are never denied-probed for maintainer.
- *Redundancy:* steps 1–4 duplicate ROLE-13 (free) exactly; only step 5 is premium-specific.
- *Efficiency / smells:* same `@fixtures`/`pageHealth` browser launch as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-03 · Premium • API global role access › global technician can read hosts but cannot author policies or reports

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global technician can read hosts but cannot author policies or reports"`
- **Project:** premium · **Actor:** `api-global-technician` via `FLEET_STATIC_TOKEN_API_GLOBAL_TECHNICIAN`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /hosts` → ✅ *(API)* allowed.
2. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied.
3. ☐ `POST /reports` `{}` → ✅ *(API)* denied.
4. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* pins the premium-only Technician role below Maintainer. Technician is young and its rego rules are the most-edited block in `policy.rego`, so the negatives are worth having.
- *Coverage gaps:* **the entire reason Technician exists is untested** — run scripts, view script results, install/uninstall software, download added software, add/remove manual labels, transfer hosts, view+resend configuration profiles. All are "allow" cells for Technician and none is probed here (script probes were excluded from the catalog for body-validation-order reasons — `role-access.ts:11-15`; software/label/profile endpoints simply were never added).
- *Redundancy:* steps 2–4 are identical to ROLE-04/ROLE-05 with a different token — three tests share the same three deny probes.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-04 · Premium • API global role access › global observer+ cannot author policies or reports

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global observer\\+ cannot author policies or reports"`
- **Project:** premium · **Actor:** `api-global-observer-plus` via `FLEET_STATIC_TOKEN_API_GLOBAL_OBSERVER_PLUS`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /hosts` → ✅ *(API)* allowed.
2. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied.
3. ☐ `POST /reports` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* thin. Observer+ differs from Observer in exactly one respect — it may **run any report/policy as a live query** (`policy.rego:547-552`, `run_new`) — and that difference is not probed. As written, this test is indistinguishable from ROLE-05 minus one probe, so it would pass even if Observer+ collapsed into Observer.
- *Coverage gaps:* `POST /queries/run` / live-query run for observer+ (allow) vs observer (deny) — the one cell that actually defines the role. Also `POST /users/admin` (deny) is asserted for observer and technician but skipped here.
- *Redundancy:* strict subset of ROLE-05's probe set. Highest-redundancy entry in the area.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-05 · Premium • API global role access › global observer can read but cannot write

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global observer can read but cannot write"` — ⚠️ the free spec (ROLE-14) uses the **same title**; always pass `--project`.
- **Project:** premium · **Actor:** `api-global-observer` via `FLEET_STATIC_TOKEN_API_GLOBAL_OBSERVER`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /hosts` → ✅ *(API)* allowed.
2. ☐ `GET /global/policies` → ✅ *(API)* allowed.
3. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied.
4. ☐ `POST /reports` `{}` → ✅ *(API)* denied.
5. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* the read-only role is the one whose escalation would be a security bug; the three denies are the most valuable cells in the area.
- *Coverage gaps:* no probe on the observer's read-but-obfuscated surface (`GET /config` must succeed yet hide SMTP/SSO secrets — status-only classification cannot see that), no `PATCH /config` deny, no `DELETE` probe anywhere in the area (delete authz is a separate rego action from write for several object types).
- *Redundancy:* steps 1–5 = ROLE-14 (free) exactly. Steps 3–4 shared with ROLE-03/ROLE-04.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-06 · Premium • API global role access › global gitops can hit the for-update config and admin writes but not host reads

- **File:** [`playwright/tests/api/role-access/premium/global-roles.spec.ts`](../../tests/api/role-access/premium/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global gitops can hit the for-update config and admin writes but not host reads"`
- **Project:** premium · **Actor:** `api-global-gitops` via `FLEET_STATIC_TOKEN_API_GLOBAL_GITOPS`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /config?for_update=true` → ✅ *(API)* allowed.
2. ☐ `POST /fleets` `{}` → ✅ *(API)* allowed (gitops may write teams — `policy.rego:128-131`).
3. ☐ `GET /hosts` → ✅ *(API)* denied — gitops gets `selective_list` only, not `list` (`policy.rego:302-308`).

**Assessment**
- *Value:* step 3 is a genuinely non-obvious cell (gitops is the only role denied the host list) and step 2 guards the CI/CD path. Worth keeping.
- *Coverage gaps:* step 1 is mislabelled as a "GitOps marker" — `for_update` is not a parameter of `GET /config` (it only exists on an Apple-MDM request struct, `server/service/apple_mdm.go:3477`) and `app_config`/read is granted to **every** role (`policy.rego:72-75`), so the probe cannot distinguish gitops from an observer. The gitops cells that would actually be worth asserting are unprobed: policy write (allow), report write (allow), policy read (allow), `PATCH /config` (allow), `POST /users/admin` (deny), and `GET /hosts/:id` (allowed — `selective_list` — while `GET /hosts` is denied, an especially good pair).
- *Redundancy:* none.
- *Efficiency / smells:* if the token were invalid, step 3 would pass for the wrong reason (401); steps 1–2 are what actually prove the token is live.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-07 · Premium • API fleet-scoped role access › Workstations maintainer can write inside Workstations but not in QA

- **File:** [`playwright/tests/api/role-access/premium/fleet-scoped-roles.spec.ts`](../../tests/api/role-access/premium/fleet-scoped-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Workstations maintainer can write inside Workstations but not in QA"`
- **Project:** premium · **Actor:** `api-ws-maintainer` (Maintainer on Workstations only)
- **Mode:** API · **Isolation:** independent · **Fixtures:** `workstationsFleetId` + `qaFleetId` worker fixtures resolve both ids once per worker via `GET /fleets` as the **admin** token (`fixtures.ts:244-251`; throws if either fleet is missing)
- **Preconditions:** `Workstations` and `QA` fleets exist (gitops-provisioned); token in `.env.premium`
- **Data created:** none

**Flow**

1. ☐ `GET /fleets/{WS}/policies` → ✅ *(API)* allowed.
2. ☐ `POST /fleets/{WS}/policies` `{}` → ✅ *(API)* allowed.
3. ☐ `GET /fleets/{QA}/policies` → ✅ *(API)* denied (cross-fleet read).
4. ☐ `POST /fleets/{QA}/policies` `{}` → ✅ *(API)* denied (cross-fleet write).
5. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied.
6. ☐ `POST /fleets` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* highest-value test in the area — cross-fleet denial is the premium tenancy boundary, and it is asserted in both directions (read and write) plus the global-escalation denial.
- *Coverage gaps:* only the *status* is checked, never the payload, so scoping leaks that return 200-with-other-fleets'-data are invisible (e.g. `GET /hosts` for this user should return only Workstations hosts — unprobed). No probe on inherited global policies (a fleet maintainer may read global policies but not write them). `POST /global/policies` deny is asserted for the observer (ROLE-08) but not here.
- *Redundancy:* steps 1–4 repeat in ROLE-09 for the composite user; ROLE-11 repeats steps 1 and 3 through the specific-endpoints user.
- *Efficiency / smells:* fleet ids resolved with the admin token — correct, but it means a wrong/renamed fleet would surface as a fixture error rather than a silent 404-scored-as-allow. Worth keeping in mind if the probes are ever hand-built.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-08 · Premium • API fleet-scoped role access › Workstations observer can read inside Workstations but cannot write

- **File:** [`playwright/tests/api/role-access/premium/fleet-scoped-roles.spec.ts`](../../tests/api/role-access/premium/fleet-scoped-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Workstations observer can read inside Workstations but cannot write"`
- **Project:** premium · **Actor:** `api-ws-observer` (Observer on Workstations only) · **Fixtures:** `workstationsFleetId`, `qaFleetId`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /fleets/{WS}/policies` → ✅ *(API)* allowed.
2. ☐ `POST /fleets/{WS}/policies` `{}` → ✅ *(API)* denied (in-fleet write).
3. ☐ `GET /fleets/{QA}/policies` → ✅ *(API)* denied (cross-fleet read).
4. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied (global write).

**Assessment**
- *Value:* the "read-only inside my own fleet" cell — the combination most likely to break when Fleet refactors team authz.
- *Coverage gaps:* no `POST /fleets/{QA}/policies` deny (cross-fleet *write* for the observer); no `GET /hosts` probe, which for a fleet observer must be allowed but scoped.
- *Redundancy:* structurally the same test as ROLE-07 with one fewer allow; steps 1/3 repeat in ROLE-09 and ROLE-11.
- *Efficiency / smells:* as ROLE-01 (browser launched, unused).

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-09 · Premium • API multi-fleet role composition › Maintainer on Workstations + Observer on QA — writes only where Maintainer

- **File:** [`playwright/tests/api/role-access/premium/multi-fleet-roles.spec.ts`](../../tests/api/role-access/premium/multi-fleet-roles.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "writes only where Maintainer"`
- **Project:** premium · **Actor:** `api-ws-maint-qa-obs` (Maintainer@Workstations + Observer@QA) · **Fixtures:** `workstationsFleetId`, `qaFleetId`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /fleets/{WS}/policies` → ✅ *(API)* allowed (maintainer read).
2. ☐ `POST /fleets/{WS}/policies` `{}` → ✅ *(API)* allowed (maintainer write).
3. ☐ `GET /fleets/{QA}/policies` → ✅ *(API)* allowed (observer read — contrast ROLE-07 step 3, where the same request is denied).
4. ☐ `POST /fleets/{QA}/policies` `{}` → ✅ *(API)* denied (observer cannot write).
5. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied (no global escalation from holding two fleet roles).

**Assessment**
- *Value:* the only per-fleet role *composition* check in the suite, and step 3-vs-4 is exactly the assertion that a naive "highest role wins" implementation would fail. Keep.
- *Coverage gaps:* no differing-role pair beyond maintainer+observer (e.g. admin@A + observer@B, where the team-admin user-management rule in `policy.rego:191-197` gets subtle); no assertion that `GET /hosts` returns the union of both fleets and nothing else.
- *Redundancy:* overlaps ROLE-07/08 on the WS cells; the QA cells are unique.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-10 · Premium • API specific-endpoints restriction › global admin restricted to GET /hosts + GET /global/policies

- **File:** [`playwright/tests/api/role-access/premium/specific-endpoints.spec.ts`](../../tests/api/role-access/premium/specific-endpoints.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "global admin restricted to GET /hosts \\+ GET /global/policies"`
- **Project:** premium · **Actor:** `api-specific-endpoints-global` — global **admin** whose `api_endpoints` allow list is `GET /api/v1/fleet/hosts` + `GET /api/v1/fleet/global/policies`
- **Mode:** API · **Isolation:** independent · **Data created:** none
- **Preconditions:** the user was provisioned *with* the allow list (`user_api_endpoints` rows); re-provisioning without it silently turns every deny below into an allow

**Flow**

1. ☐ `GET /hosts` → ✅ *(API)* allowed (on the allow list).
2. ☐ `GET /global/policies` → ✅ *(API)* allowed.
3. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied *despite being a global admin* (real answer `403` from `APIOnlyEndpointCheck`).
4. ☐ `POST /fleets` `{}` → ✅ *(API)* denied.
5. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied — same path as step 2, different method: proves the allow list is method-aware.
- ✅ *(API)* Implicitly: the restriction is enforced *inside* `AuthenticatedUser`, i.e. after token auth and before role authz.

**Assessment**
- *Value:* real, and step 5's method-sensitivity is the sharpest assertion in the file. This feature (added by migration `20260409153714_AddApiEndpointPermissionsTables`) has no other automated coverage anywhere in the suite.
- *Coverage gaps:* an off-catalog route (the `isInCatalog` branch of `api_only.go` — also 403, but a different code path), an api-only user with an empty allow list, a `PATCH`/`DELETE` allow-list entry, and the UI/API for *editing* a user's allow list (nothing in the suite creates or edits `api_endpoints`; the config is baked into manual provisioning).
- *Redundancy:* none.
- *Efficiency / smells:* the spec's docblock says restricted endpoints "reject with 401/403"; the middleware always returns 403 (`permissionDenied` → `NewPermissionError`), so the assertion could be tightened to exactly 403.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-11 · Premium • API specific-endpoints restriction › Workstations maintainer restricted to fleet policies stays fleet-scoped

- **File:** [`playwright/tests/api/role-access/premium/specific-endpoints.spec.ts`](../../tests/api/role-access/premium/specific-endpoints.spec.ts)
- **Grep:** `npx playwright test --project=premium -g "Workstations maintainer restricted to fleet policies stays fleet-scoped"`
- **Project:** premium · **Actor:** `api-specific-endpoints-ws` — Maintainer@Workstations, allow list `GET /hosts` + `GET /fleets/:id/policies` (template form; concrete ids are rejected by Fleet's catalog validator) · **Fixtures:** `workstationsFleetId`, `qaFleetId`
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `GET /fleets/{WS}/policies` → ✅ *(API)* allowed (on the allow list *and* in scope).
2. ☐ `GET /hosts` → ✅ *(API)* allowed.
3. ☐ `GET /fleets/{QA}/policies` → ✅ *(API)* denied — same allow-listed route template, but role authz still applies on top.
4. ☐ `GET /global/policies` → ✅ *(API)* denied (off the allow list).
5. ☐ `POST /fleets/{WS}/policies` `{}` → ✅ *(API)* denied (method not allow-listed, even though the role permits it).

**Assessment**
- *Value:* the two-layer check (allow list ∧ role scope) is the whole point of the feature and steps 3+5 are the only place it is asserted. Keep.
- *Coverage gaps:* no probe distinguishing the two rejection layers by status/body — both are 403, so a regression that collapsed role authz into the allow-list check (or vice versa) would still be green as long as *something* returned 403.
- *Redundancy:* steps 1/3 duplicate ROLE-07/08's WS-vs-QA pair, but here they carry different meaning (restriction ∧ scope).
- *Efficiency / smells:* `:id` templating in the static-user definition is a provisioning subtlety worth keeping in the manual runbook — a concrete id in `api_endpoints` is rejected at user-creation time.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-12 · Free • API role access › global admin can hit admin-only writes and reads

- **File:** [`playwright/tests/api/role-access/free/global-roles.spec.ts`](../../tests/api/role-access/free/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=free -g "global admin can hit admin-only writes and reads"`
- **Project:** free · **Actor:** `api-global-admin` via `FLEET_STATIC_TOKEN_API_GLOBAL_ADMIN` in `.env.free` (same key, different instance + different token)
- **Mode:** API · **Isolation:** independent · **Data created:** none

**Flow**

1. ☐ `POST /users/admin` `{}` → ✅ *(API)* allowed.
2. ☐ `POST /global/policies` `{}` → ✅ *(API)* allowed.
3. ☐ `GET /hosts` → ✅ *(API)* allowed.

**Assessment**
- *Value:* positive control for ROLE-13/14 on the free instance; also implicitly proves these three endpoints are not premium-gated.
- *Coverage gaps:* nothing free-specific is asserted. The interesting free-tier cell is the *inverse* — that premium-only endpoints return 402 rather than 200 for a free admin — and the current helper cannot express it (402 ∉ {401,403} ⇒ scored "allowed").
- *Redundancy:* subset of ROLE-01.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-13 · Free • API role access › global maintainer can write policies but not users

- **File:** [`playwright/tests/api/role-access/free/global-roles.spec.ts`](../../tests/api/role-access/free/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=free -g "global maintainer can write policies but not users"`
- **Project:** free · **Actor:** `api-global-maintainer` · **Mode:** API · **Data created:** none

**Flow**

1. ☐ `POST /global/policies` `{}` → ✅ *(API)* allowed.
2. ☐ `POST /reports` `{}` → ✅ *(API)* allowed.
3. ☐ `GET /hosts` → ✅ *(API)* allowed.
4. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* low incremental value over ROLE-02 — Fleet's authz is tier-independent for these four cells (`policy.rego` has no license branch), so this re-tests the same rego rules against a differently-licensed instance.
- *Coverage gaps:* no free-specific denial (e.g. maintainer must be denied fleet-scoped endpoints because fleets don't exist on free — those return 402, again unexpressible today).
- *Redundancy:* exact subset of ROLE-02 (its steps 1–4). Prime merge candidate if the free/premium split is ever revisited — though the tier-separation convention in `feedback_review_style` argues for keeping the duplication.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

### ROLE-14 · Free • API role access › global observer can read but cannot write

- **File:** [`playwright/tests/api/role-access/free/global-roles.spec.ts`](../../tests/api/role-access/free/global-roles.spec.ts)
- **Grep:** `npx playwright test --project=free -g "global observer can read but cannot write"` — ⚠️ same title as ROLE-05; `--project` is mandatory
- **Project:** free · **Actor:** `api-global-observer` · **Mode:** API · **Data created:** none

**Flow**

1. ☐ `GET /hosts` → ✅ *(API)* allowed.
2. ☐ `GET /global/policies` → ✅ *(API)* allowed.
3. ☐ `POST /global/policies` `{}` → ✅ *(API)* denied.
4. ☐ `POST /users/admin` `{}` → ✅ *(API)* denied.

**Assessment**
- *Value:* read-only escalation guard on the free instance.
- *Coverage gaps:* `POST /reports` deny is asserted for the premium observer (ROLE-05 step 4) but omitted here for no stated reason.
- *Redundancy:* subset of ROLE-05 (which is a strict superset). Shares the title, too.
- *Efficiency / smells:* as ROLE-01.

**Notes (Andrey)**
```
verdict:
missing validations:
steps to cut:
other:
```

---

## Area observations

### Cross-check against Fleet's documented permissions

Ground truth: `~/repositories/fleet/articles/role-based-access.md` (the source of
<https://fleetdm.com/guides/role-based-access>) plus `~/repositories/fleet/server/authz/policy.rego`
— both reachable and read at commit `5e24620862`. Nothing below is guessed. There is **no**
permissions table under `fleet/docs/` (the docs tree only links out to the guide), so the article +
rego are the two authorities.

Every assertion the 14 tests make agrees with both authorities. The gap is breadth:

- **Roles.** All 6 global roles (premium) and all 3 free roles are touched. Fleet-scoped roles are
  covered only for **maintainer** and **observer** (+ the maintainer/observer composite). Missing:
  **fleet admin** — `api-ws-admin` is provisioned, has a token in `.env`, and is referenced by *no
  spec* — plus fleet technician, fleet observer+ and fleet gitops (all four are real, distinct rego
  branches; the fleet-admin user-management rule `policy.rego:187-197` — "team admin may write a
  user only if they administer *every* fleet that user belongs to" — is the subtlest rule in the
  file and is entirely untested).
- **Object types.** The rego policy has 49 `object.type` values. The probes touch 5: `user`, `team`,
  `policy`, `query`, `host` (+ `app_config` read). Untested authz surface with a distinct role
  matrix includes: `script`/`host_script_result` (Technician's headline grant — excluded from the
  catalog on purpose, `role-access.ts:11-15`), `installable_entity`/`software_inventory`/
  `maintained_app`/`software_category`, `label`, `pack`, `enroll_secret`, `mdm_config_profile`,
  `mdm_command`, `mdm_apple_*` (APNs/ABM/VPP/EULA/setup-assistant — mostly admin-only),
  `certificate_authority`/`certificate_template`/`certificate_request`, `secret_variable`,
  `custom_vital`, `activity`, `invite`, `carve`, `scim_user`, `android_enterprise`,
  `conditional_access_*`, `cron_schedules`, `target`/`targeted_query` (live-query run — the cell
  that separates Observer from Observer+), `host_health`, `version`.
- **Role-defining grants that no test asserts.** Technician: run scripts, install/uninstall
  software, manual labels, host transfer, view+resend profiles. Observer+: run any report as a live
  query. GitOps: policy write, report write, policy read, `PATCH /config`, `GET /hosts/:id`
  (`selective_list`, allowed — the perfect contrast to the denied `GET /hosts`). Admin-only *reads*
  (SSO settings, SMTP settings, agent options — API-only per the article) get no deny probe for any
  lower role.
- **Actions.** Only `read`/`list`/`write` are probed. `delete` (a separate action for several object
  types), `run`/`run_new`, `write_host_label`, `transfer_host`, `cancel_host_activity`,
  `selective_list`/`selective_read`, `change_password`, `write_role` — none probed.

### Coverage map

| Feature / user flow | Covered by | Gap |
|---|---|---|
| Global role hierarchy (6 roles, premium) | ROLE-01…06 | only 7 endpoints; gitops positives and observer+/technician positives missing |
| Global role hierarchy (3 roles, free) | ROLE-12…14 | strict subset of premium; no 402/tier-gate assertions |
| Fleet-scoped isolation (read + write, both directions) | ROLE-07, ROLE-08 | fleet admin / technician / observer+ / gitops; payload scoping never checked |
| Multi-fleet role composition | ROLE-09 | only maintainer+observer; no admin+observer pair |
| `api_endpoints` per-user restriction | ROLE-10, ROLE-11 | off-catalog route, empty allow list, non-GET allow-list entries, editing the allow list |
| Token auth itself (401 for bad/absent token) | — | nothing asserts that a *missing* or *garbage* token 401s, yet the deny helper treats 401 as a pass |
| Premium license gating (402) | — | no spec asserts 402 anywhere in this area; the helper cannot express it |
| UI permission gating for the same roles | e2e specs (below), not this area | see UI-vs-API |

### Duplication

1. **Deny triple `createPolicy` + `createReport` + `createUser`** is repeated across ROLE-03, ROLE-04,
   ROLE-05 (premium) and ROLE-13/14 (free) — 5 of 14 tests are largely the same three probes with a
   different token. A single data-driven table (`role → expectations[]`) would collapse them without
   losing per-role attribution if each row became its own `test()`.
2. **ROLE-04 ⊂ ROLE-05.** Observer+ asserts nothing Observer doesn't, so the pair cannot detect the
   two roles collapsing into each other.
3. **Free ⊂ premium.** ROLE-12 ⊂ ROLE-01, ROLE-13 ⊂ ROLE-02, ROLE-14 ⊂ ROLE-05. Justified only as a
   second-instance smoke test — `policy.rego` has no tier branch for these cells.
4. **WS-vs-QA policy pair** appears in ROLE-07, ROLE-08, ROLE-09 and ROLE-11 (4×), each time with a
   different actor — this one is *legitimate* variation, not redundancy.
5. **Duplicate test title** `global observer can read but cannot write` in the premium and free
   specs makes `-g` ambiguous.

### UI-vs-API balance

All 14 are 100% API by design — that is correct for this area; RBAC is an authz contract and the
browser adds nothing. What matters is that **the UI side of the same matrix is tested elsewhere and
much more thinly**, and the two sets never reference each other:

- [`tests/e2e/premium/labels/role-access.spec.ts`](../../tests/e2e/premium/labels/role-access.spec.ts) — global observer / ws-maintainer / team-admin against label add/edit/delete affordances.
- [`tests/e2e/premium/hosts/cta-visibility.spec.ts`](../../tests/e2e/premium/hosts/cta-visibility.spec.ts) + [`free/hosts/cta-visibility.spec.ts`](../../tests/e2e/free/hosts/cta-visibility.spec.ts) — Add hosts / Enroll secrets / Export by role.
- [`tests/e2e/premium/hosts/host-transfer-permissions.spec.ts`](../../tests/e2e/premium/hosts/host-transfer-permissions.spec.ts), [`host-delete.spec.ts`](../../tests/e2e/premium/hosts/host-delete.spec.ts) — transfer/delete per role, incl. the team-admin negative.
- [`tests/e2e/{premium,free}/software/manage-automations-access.spec.ts`](../../tests/e2e/premium/software/manage-automations-access.spec.ts) — Manage automations gating.
- [`tests/e2e/premium/settings/team-host-status-webhook.spec.ts`](../../tests/e2e/premium/settings/team-host-status-webhook.spec.ts) — team-admin settings access.
- [`tests/e2e/{premium,free}/account/my-account.spec.ts`](../../tests/e2e/premium/account/my-account.spec.ts) — role/fleets *display* only, no gating.

So: host transfer/delete and label writes are gated in the UI specs but **not** probed at the API
level, while script/software/live-query permissions are missing from *both* sides. The human static
users (`global-technician`, `global-observer-plus`, `team-admin`, …) exist for the UI specs; the
`api-*` twins exist for this area — a rename or role drift in one set will not be caught by the other.

### Efficiency + false-green risks

The classification in [`helpers/api/role-access.ts:35`](../../helpers/api/role-access.ts) is
`denied = {401,403}`, `allowed = everything else`. Consequences, in order of danger:

1. **402 counts as "allowed."** Confirmed mechanism: on free, `POST /fleets` calls
   `svc.authz.SkipAuthorization` and returns `402 ErrMissingLicense` for *every* role
   (`fleet/server/service/teams.go:140-146`). Any premium-gated endpoint added to a free-tier probe
   would therefore score as an **allow for all roles** — a textbook false green. Today's free spec
   dodges it by only probing non-gated endpoints; nothing prevents the next one from stepping in it.
2. **404 / 405 / 5xx count as "allowed."** A renamed or removed route (Fleet renamed teams →
   fleets, queries → reports within the last two releases) turns every `expectAllow` on it into a
   permanent pass. Note `/global/policies` is registered `EndingAtVersion("v1")` — it is a
   deprecated route, so it *will* eventually 404 and the allow probes will not notice. `500`s also
   pass (relevant given the known QA MySQL temp-table 500s).
3. **401 counts as "denied."** A stale/typo'd `FLEET_STATIC_TOKEN_*` makes every deny probe pass;
   only the allow probes in the same test would catch it. ROLE-06 is the thinnest case (one real
   allow that any role can do + one gitops-specific allow).
4. **Status-only classification never inspects the body,** so fleet-scoped *data* leakage
   (200 containing another fleet's rows) is invisible everywhere in this area.
5. **A browser is launched for all 14 API tests.** They import `test` from `@fixtures`, which
   auto-applies the `page`-dependent `pageHealth` fixture (`fixtures.ts:270`, `auto: true`). Only
   the four premium specs that need `workstationsFleetId`/`qaFleetId` have a reason to touch
   `@fixtures` at all; both `global-roles.spec.ts` files use no fixture and could import from
   `@playwright/test`, per CLAUDE.md.

### Quick wins

1. Replace the boolean classifier with explicit expectations: `expectDeny` → `expect(status).toBe(403)`
   (with a dedicated message for 401 = "token problem, not a permission result") and `expectAllow` →
   `expect([200,400,422]).toContain(status)`, which kills the 402/404/500 false greens in one edit
   (`helpers/api/role-access.ts:56-78`).
2. Use `api-ws-admin` — it is provisioned, tokenised, and unreferenced. A fleet-admin entry in
   `fleet-scoped-roles.spec.ts` (may write in WS, may not create fleets/users, may not read QA) is
   ~10 lines and covers the most intricate rego rule in the file.
3. Give ROLE-04 a reason to exist: probe the live-query run route (`POST /api/v1/fleet/reports/run`
   → `createDistributedQueryCampaignEndpoint`, rego action `run_new`) as allow for observer+ and deny
   for observer — currently the only difference between the two roles is unasserted. ⚠️ unclear
   whether that handler validates the body before authz; if it does it needs a real query id rather
   than `{}`.
4. Add the four documented gitops cells to ROLE-06 (policy write allow, report write allow, policy
   read allow, `POST /users/admin` deny) and re-label `configForUpdate` — `for_update` is not a
   parameter of `GET /config` and every role may read config, so the current "GitOps marker" name
   overstates what the probe proves.
5. Rename `Free • API role access › global observer can read but cannot write` (or the premium twin)
   so `-g` is unambiguous, and drop the redundant browser launch by importing `test` from
   `@playwright/test` in both `global-roles.spec.ts` files.

### Bigger bets

1. **Make the matrix the source of truth.** Declare one table `role × probe → allow|deny|n/a`
   generated per tier, emit one `test()` per role (titles unchanged), and assert every cell —
   unfilled cells become explicit `n/a` with a reason. That turns "24 of 42 cells" into a number
   the suite reports, and adding an endpoint means adding a column, not editing 5 specs.
2. **Extend the catalog to the role-defining endpoints**, accepting that some need a real body:
   scripts run/upload, software install/uninstall + add/edit/delete, labels, enroll secrets, config
   profiles, MDM commands, live-query run, `PATCH /config`, plus the admin-only reads (SSO/SMTP/agent
   options). This is where Technician, Observer+ and GitOps actually differ from their neighbours,
   and it is the difference between "the hierarchy exists" and "the hierarchy is correct".
3. **Assert scope, not just status.** For every fleet-scoped allow, check the payload only contains
   the permitted fleet's resources (ids from the `workstationsFleetId`/`qaFleetId` fixtures). A
   tenancy leak that returns 200 with foreign data is the highest-severity bug this area could
   catch and currently the one it is structurally blind to.
