# `fleetctl` CLI — test audit

**Specs covered:** 12 files · **Entries:** 42 (59 test declarations) · **Projects:** premium, free, gitops-nightly

The only area in the suite with **no browser and no HTTP client of its own**. Every entry shells
out to the real `fleetctl` binary and asserts on its exit code, stdout and stderr. Three entries
also read the Fleet API — but only to set up or verify a CLI-driven mutation, never as the thing
under test.

Design rationale, the full licensing matrix, and what these specs deliberately leave to Fleet's
own Go tests live in [`../test-plans/fleetctl.md`](../test-plans/fleetctl.md). Read that first if
you are judging *whether* an entry should exist; this file is for judging whether it does its job.

## How a CLI test runs

[`helpers/fleetctl.ts`](../../helpers/fleetctl.ts) wraps every invocation and absorbs three
things that would otherwise land in each spec:

- **Config isolation.** `fleetctl` reads `~/.fleetctl/config` by default, so an un-isolated call
  would target the *developer's* instance and be clobbered by any `fleetctl config set`. Every
  invocation appends `--config .auth/fleetctl-<suite>.yml`, written on first use from
  `FLEET_URL` + `FLEET_API_TOKEN` (mode `0600`, and `.auth/` is gitignored — the file holds a
  live API token).
- **Version-banner stripping.** When client and server versions differ, `fleetctl` prefixes
  three lines to **stderr** on *every* command (`Warning: Version mismatch.` / `Client Version:`
  / `Server Version:`). Unstripped, every stderr assertion in this area would be skew-dependent.
- **No throw on non-zero.** A licence denial is a normal result here, so a failing command
  returns `{ code, stdout, stderr }` rather than raising. A missing binary *does* raise, with a
  message naming `FLEETCTL_BIN`.

`output(res)` returns stdout+stderr joined — needed because **several `generate-gitops` failure
modes exit 0** and report on the error writer instead (`Either --dir or --key must be
specified`, `Only one of --dir or --key may be specified`, `You are not authorized to run this
command`). Entries that assert on those check message content, never exit code.

## Which project runs what

| Folder | Project(s) | Runs in a normal suite run? |
|---|---|---|
| `tests/cli/shared/` | premium **and** free | yes — twice, once per tier |
| `tests/cli/premium/` | premium | yes |
| `tests/cli/free/` | free | yes |
| `tests/cli/nightly/` | `gitops-nightly` | **no** — nightly GitOps chain only |

59 declarations → **70 executions** in the regular projects (39 premium / 31 free, the 16 shared
ones counted twice) plus **12** in the nightly project (6 per tier).

`tests/cli/nightly/` is excluded from both browser projects via
`'**/cli/nightly/**'` in their `testIgnore`, exactly as `gitops-verify` is. It is
suite-ambiguous, so `SUITE` must be set explicitly. **This separation is load-bearing** — see
FCTL-26..30.

## The binary is a test dependency

Unlike every other area, these specs need a program installed. Both Playwright CI workflows now
resolve the server's version and `npm install -g fleetctl@<that version>` before running. Locally,
`FLEETCTL_BIN` points at an existing binary; without it the area fails hard rather than skipping,
per the suite's no-new-skip-gates rule.

**A stale local binary is the most likely cause of a confusing failure in this area.** A 4.85
client against a 4.91 server passes most entries but can lag behind new output keys. Check
`fleetctl --version` against `/api/v1/fleet/version` before filing anything.

## Contents

| ID | Spec | Test | Mode | Manual? |
|---|---|---|---|---|
| FCTL-01 | `cli/shared/get-read-only.spec.ts` | get labels renders a table | CLI | ☐ |
| FCTL-02 | `cli/shared/get-read-only.spec.ts` | get user_roles renders a table | CLI | ☐ |
| FCTL-03 | `cli/shared/get-read-only.spec.ts` | get enroll_secret emits an enroll_secret spec | CLI | ☐ |
| FCTL-04 | `cli/shared/get-read-only.spec.ts` | get software renders a table | CLI | ☐ |
| FCTL-05 | `cli/shared/get-read-only.spec.ts` | get mdm-apple reports APNs certificate details | CLI | ☐ |
| FCTL-06 | `cli/shared/get-read-only.spec.ts` | get mdm-commands lists recent commands | CLI | ☐ |
| FCTL-07 | `cli/shared/get-read-only.spec.ts` | get carves succeeds | CLI | ☐ |
| FCTL-08 | `cli/shared/get-read-only.spec.ts` | debug migrations reports the schema is current | CLI | ☐ |
| FCTL-09 | `cli/shared/new.spec.ts` | scaffolds a GitOps repository with the given org name | CLI | ☐ |
| FCTL-10 | `cli/shared/new.spec.ts` | scaffolds the fleet manifests and CI workflow | CLI | ☐ |
| FCTL-11 | `cli/shared/new.spec.ts` | prints the GitOps user setup next steps | CLI | ☐ |
| FCTL-12 | `cli/shared/new.spec.ts` | refuses to write into an existing directory without --force | CLI | ☐ |
| FCTL-13 | `cli/shared/new.spec.ts` | requires an organization name | CLI | ☐ |
| FCTL-14 | `cli/premium/fleets.spec.ts` | get fleets lists the provisioned fleets | CLI | ☐ |
| FCTL-15 | `cli/premium/fleets.spec.ts` | hosts transfer moves a simulated host between fleets | CLI + API | ☐ |
| FCTL-16 | `cli/premium/generate-gitops.spec.ts` | emits premium-only SSO JIT provisioning | CLI | ☐ |
| FCTL-17 | `cli/premium/generate-gitops.spec.ts` | scopes controls to a fleet rather than the global config | CLI | ☐ |
| FCTL-18 | `cli/premium/generate-gitops.spec.ts` | rejects --dir and --key together | CLI | ☐ |
| FCTL-19 | `cli/premium/generate-gitops.spec.ts` | requires one of --dir or --key | CLI | ☐ |
| FCTL-20 | `cli/premium/generate-gitops.spec.ts` | reports an unknown fleet by name | CLI | ☐ |
| FCTL-21 | `cli/free/licensing.spec.ts` | get fleets is refused | CLI | ☐ |
| FCTL-22 | `cli/free/licensing.spec.ts` | get teams (deprecated alias) is refused | CLI | ☐ |
| FCTL-23 | `cli/free/licensing.spec.ts` | get mdm-apple-bm is refused | CLI | ☐ |
| FCTL-24 | `cli/free/licensing.spec.ts` | generate-gitops omits premium-only SSO fields | CLI | ☐ |
| FCTL-25 | `cli/free/licensing.spec.ts` | generate-gitops omits software, which is premium-only | CLI | ☐ |
| FCTL-31 | `cli/premium/mdm-lock-wipe.spec.ts` | `{lock,unlock,wipe}` refuses a `{darwin,windows}` host with MDM off (6) | CLI + API | ☐ |
| FCTL-32 | `cli/premium/mdm-lock-wipe.spec.ts` | `{lock,unlock,wipe}` reports an unknown host identifier (3) | CLI | ☐ |
| FCTL-33 | `cli/premium/mdm-lock-wipe.spec.ts` | `{lock,unlock,wipe}` requires the --host flag (3) | CLI | ☐ |
| FCTL-34 | `cli/premium/mdm-lock-lifecycle.spec.ts` | locks a simulated linux host | CLI + API | ☐ |
| FCTL-35 | `cli/premium/mdm-lock-lifecycle.spec.ts` | unlocks the linux host again | CLI + API | ☐ |
| FCTL-36 | `cli/free/mdm-licensing.spec.ts` | `{lock,unlock,wipe}` refused on MDM-enrolled `{darwin,windows}` (6) | CLI + API | ☐ |
| FCTL-37 | `cli/free/mdm-licensing.spec.ts` | `{lock,unlock,wipe}` refused on a Linux host (3) | CLI + API | ☐ |
| FCTL-38 | `cli/shared/gitops-dry-run.spec.ts` | validates the fleetctl new scaffold without changing anything | CLI + API | ☐ |
| FCTL-39 | `cli/shared/gitops-dry-run.spec.ts` | rejects an unknown key | CLI | ☐ |
| FCTL-40 | `cli/shared/gitops-dry-run.spec.ts` | reports a missing config file | CLI | ☐ |
| FCTL-41 | `cli/premium/gitops-dry-run.spec.ts` | processes fleet configs; `--delete-other-fleets` (2) | CLI | ☐ |
| FCTL-42 | `cli/free/gitops-skips-teams.spec.ts` | skips every fleet file in the scaffold | CLI | ☐ |
| FCTL-26 | `cli/nightly/generate-gitops.spec.ts` | reproduces the applied label set | CLI | ☐ |
| FCTL-27 | `cli/nightly/generate-gitops.spec.ts` | reproduces the applied global policy set | CLI | ☐ |
| FCTL-28 | `cli/nightly/generate-gitops.spec.ts` | reproduces the applied global report set | CLI | ☐ |
| FCTL-29 | `cli/nightly/generate-gitops.spec.ts` | reproduces the applied org name | CLI | ☐ |
| FCTL-30 | `cli/nightly/generate-gitops.spec.ts` | emits the tier-appropriate file structure | CLI | ☐ |
| FCTL-43 | `cli/nightly/gitops-idempotence.spec.ts` | dry-run of the applied config proposes no deletions | CLI | ☐ |

Shared across **FCTL-01..25** unless an entry says otherwise:

- **Preconditions:** `fleetctl` on `PATH` (or `FLEETCTL_BIN`), ideally matching the server
  version. `FLEET_URL` + `FLEET_API_TOKEN` for the tier. The token user must be a **global
  admin** — `generate-gitops` refuses any other role, and does so with exit code 0.
- **Data created:** none, except FCTL-09..13 (temp dirs under the OS temp dir, never cleaned —
  harmless, but they accumulate) and FCTL-15 (moves one simulated host and moves it back).
- **Isolation:** independent tests, `fullyParallel: true`. No entry depends on another.

---

### FCTL-01 · fleetctl · read-only get subcommands › get labels renders a table

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "get labels renders a table"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get labels --config <isolated>`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains the column header `NAME`.
   - ✅ *(CLI)* stdout contains the column header `PLATFORM`.

**Manual repro** — `fleetctl get labels`. Expect an ASCII table whose header row reads
`NAME | PLATFORM | DESCRIPTION | QUERY`. Cross-check the row count against **Hosts → Labels** in the UI.

**Assessment**
- *Value:* proves the whole harness end-to-end — binary found, isolated config written and accepted, token valid, server reachable, table renderer working. If this fails, most of the area will.
- *Coverage gaps:* asserts nothing about the *labels*. A server returning zero labels still passes, because the header prints regardless. Deliberate — label data is `gitops-verify`'s job (GV-05..07) — but it does mean this is a smoke test wearing a data test's name.
- *Redundancy:* none. GV-05..07 assert label data over HTTP, never through the CLI.
- *Efficiency / smells:* one of 8 tests in this file that each pay a fresh process spawn (~150-250ms). Cheap enough not to bother batching, and batching would cost per-command failure attribution.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-02 · fleetctl · read-only get subcommands › get user_roles renders a table

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get user_roles renders a table"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get user_roles`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `USER`.
   - ✅ *(CLI)* stdout contains `GLOBAL ROLE`.

**Manual repro** — `fleetctl get user_roles`. On premium the table carries a third column for
fleet-scoped roles; on free it is `USER | GLOBAL ROLE` only. Compare against **Settings → Users**.

**Assessment**
- *Value:* low on its own. Its real value is latent: this is the natural home for asserting that premium renders fleet-scoped roles and free does not — a genuine tier difference visible in the CLI.
- *Coverage gaps:* the tier difference above is **not** asserted, so the test passes identically on both tiers and proves nothing tier-specific. The static-user fixtures (`helpers/api/static-users.ts`) would give it stable expected rows.
- *Redundancy:* `tests/api/role-access/**` covers role *enforcement* far more thoroughly. This only covers role *display*.
- *Efficiency / smells:* weakest entry in the file — a header-only assertion on a command whose whole point is the rows.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-03 · fleetctl · read-only get subcommands › get enroll_secret emits an enroll_secret spec

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get enroll_secret emits an enroll_secret spec"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get enroll_secret`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `kind: enroll_secret`.
   - ✅ *(CLI)* stdout contains `apiVersion: v1`.

**Manual repro** — `fleetctl get enroll_secret`. Output is a YAML spec document, not a table.
**Do not paste the output anywhere** — it contains live enroll secrets in plaintext.

**Assessment**
- *Value:* the only entry covering `get`'s **YAML spec** output path rather than its table renderer — a genuinely different code path (`printSpec`). Also the canary for `apiVersion` drift.
- *Coverage gaps:* does not assert a secret is actually present, so a server returning an empty `spec.secrets` list passes. Given the premium instance manages secrets via UI and free via gitops, asserting non-empty would be meaningful on both.
- *Redundancy:* none.
- *Efficiency / smells:* the test prints secrets into the Playwright report on failure. Low risk (reports are CI artifacts on private repos, retention 7 days) but worth knowing before you attach one to a ticket.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-04 · fleetctl · read-only get subcommands › get software renders a table

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get software renders a table"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get software`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `VERSIONS`.
   - ✅ *(CLI)* stdout contains `VULNERABILITIES`.

**Manual repro** — `fleetctl get software`. Note this lists **inventory** (what hosts have),
not the installable library — the same distinction the UI draws between **Software → Inventory**
and **Software → Library**.

**Assessment**
- *Value:* moderate. This is the slowest entry in the file (~2.3s vs ~200ms) because the instances carry large inventories, and that slowness is itself informative — it exercises a heavy server query.
- *Coverage gaps:* `get software` is **not** licence-gated, but the *library* it does not read is premium-only. Someone reading this file could easily conclude software is fully tier-agnostic. Worth a comment in the spec.
- *Redundancy:* `tests/api/` and the software e2e areas (06, 07) own software data comprehensively. This is a renderer smoke test only.
- *Efficiency / smells:* 2.3s for two header assertions is the worst value-per-second in the area. A `--json` variant or a `per_page` cap would cut it, if the flag exists on the pinned version.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-05 · fleetctl · read-only get subcommands › get mdm-apple reports APNs certificate details

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get mdm-apple reports APNs certificate details"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get mdm-apple`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `Common name (CN):`.
   - ✅ *(CLI)* stdout contains `Renew date:`.

**Manual repro** — `fleetctl get mdm-apple`. Compare **Renew date** against
**Settings → Integrations → Mobile device management (MDM) → Apple Push Certificate Portal**.

**Assessment**
- *Value:* high, and under-sold by its name. This is the **tier boundary marker** for Apple MDM: APNs is available on free, while ABM (FCTL-23) is not. The pair documents a distinction that is easy to get wrong.
- *Coverage gaps:* does not parse or assert the **renew date**, which is the one field with operational consequence — both QA instances' APNs certs expire May 2027, and a lapsed cert silently breaks MDM enrolment across the suite. Asserting "renew date is in the future" would turn a smoke test into an early-warning canary. **Strongest single improvement available in this area.**
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

### FCTL-06 · fleetctl · read-only get subcommands › get mdm-commands lists recent commands

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get mdm-commands lists recent commands"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get mdm-commands`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout+stderr matches `/most recent commands|No MDM commands/` — populated table **or** explicit empty state.

**Manual repro** — `fleetctl get mdm-commands`. Prints "The list of 20 most recent commands:"
followed by a table, or the empty-state line when the instance has issued none.

**Assessment**
- *Value:* moderate — the only entry tolerant of an empty instance by design, which is correct here since MDM command history depends on what other specs did.
- *Coverage gaps:* the either/or regex means a *malformed* table still passes as long as the preamble prints. Tightening it would require seeding a command, which needs a real MDM-enrolled host and would pull this out of `shared/`.
- *Redundancy:* none.
- *Efficiency / smells:* the alternation is the right call for a shared-state instance, but it does make the entry near-unfalsifiable. Judge whether that is worth keeping.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-07 · fleetctl · read-only get subcommands › get carves succeeds

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "get carves succeeds"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get carves`.
   - ✅ *(CLI)* Exit code is `0`.

**Manual repro** — `fleetctl get carves`. Both QA instances print `No carves found`; file carving
is not exercised anywhere in the suite.

**Assessment**
- *Value:* **lowest in the area.** A single exit-code assertion on a feature nothing else touches and that the instances never populate. It proves the subcommand is wired and the endpoint is not 500ing.
- *Coverage gaps:* everything. No output assertion at all — it does not even check `No carves found` prints.
- *Redundancy:* none, but that is because carving is uncovered generally, not because this covers it.
- *Efficiency / smells:* **the clearest deletion candidate**, or promote it by asserting the empty-state string so it at least pins the copy.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-08 · fleetctl · read-only get subcommands › debug migrations reports the schema is current

- **File:** [`playwright/tests/cli/shared/get-read-only.spec.ts`](../../tests/cli/shared/get-read-only.spec.ts)
- **Grep:** `-g "debug migrations reports the schema is current"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl debug migrations`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `Migrations up-to-date.`

**Manual repro** — `fleetctl debug migrations`. Anything other than `Migrations up-to-date.` means
the instance was deployed without completing its migrations — the schema is behind the binary.

**Assessment**
- *Value:* **highest value-per-millisecond in the area, and arguably in the suite.** ~200ms to detect a half-migrated instance, which is the single most likely cause of a mass unexplained failure after an upgrade. Directly complements the `release-migration-test` skill, which checks migrations in CI but not on the QA instances themselves.
- *Coverage gaps:* none worth adding. The command is binary by nature.
- *Redundancy:* none.
- *Efficiency / smells:* arguably belongs in a **setup** project rather than a test — if migrations are pending, every other spec in the run is suspect and should fail fast rather than produce 300 confusing failures. Worth considering as a `cleanup-setup` precondition.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-09 · fleetctl new › scaffolds a GitOps repository with the given org name

- **File:** [`playwright/tests/cli/shared/new.spec.ts`](../../tests/cli/shared/new.spec.ts)
- **Grep:** `-g "scaffolds a GitOps repository with the given org name"`
- **Project:** premium **and** free · **Mode:** CLI (offline)
- **Server contact:** none — runs with `withoutConfig`, so no token and no network

**Flow**

1. ☐ Create a temp dir; run `fleetctl new --org-name "Playwright QA Org" --dir <tmp>/it-and-security`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `Created new Fleet GitOps repository`.
   - ✅ *(CLI)* stdout contains `Organization name: Playwright QA Org`.
2. ☐ Inspect the written tree.
   - ✅ *(FS)* `default.yml`, `README.md`, `.gitignore` all exist.
   - ✅ *(FS)* Parsed `default.yml` → `org_settings.org_info.org_name` **exactly equals** `Playwright QA Org`.

**Manual repro** — `fleetctl new --org-name "Test Org" --dir /tmp/scaffold` and read
`/tmp/scaffold/default.yml`. No Fleet instance required; this command never contacts a server.

**Assessment**
- *Value:* high. This is the repository Fleet hands a brand-new customer, and the org-name substitution goes through a Go `text/template` with custom `<%= %>` delimiters plus a YAML round-trip for escaping — a real path with real failure modes.
- *Coverage gaps:* the escaping is the interesting part and is untested. An org name containing a quote, a colon, or a newline is exactly what would break the YAML marshal, and `new.go` has explicit handling for it (control-character stripping, 255-char limit). A `"O'Brien & Co: \"Test\""` case would earn its place.
- *Redundancy:* Fleet's own `new_test.go` (241 lines) covers local emission. The distinct value here is running the **shipped binary**, not the package under test.
- *Efficiency / smells:* three separate tests (FCTL-09/10/11) each re-run `fleetctl new` into a fresh temp dir — 3 spawns where one `beforeAll` scaffold would do. ~25ms each, so the granular failure attribution is worth more than the saved time. Temp dirs are never cleaned up.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-10 · fleetctl new › scaffolds the fleet manifests and CI workflow

- **File:** [`playwright/tests/cli/shared/new.spec.ts`](../../tests/cli/shared/new.spec.ts)
- **Grep:** `-g "scaffolds the fleet manifests and CI workflow"`
- **Project:** premium **and** free · **Mode:** CLI (offline)

**Flow**

1. ☐ Run `fleetctl new --org-name "Playwright QA Org" --dir <tmp>/it-and-security`.
   - ✅ *(CLI)* Exit code is `0`.
2. ☐ Inspect the tree.
   - ✅ *(FS)* `fleets/workstations.yml` exists.
   - ✅ *(FS)* `fleets/personal-mobile-devices.yml` exists.
   - ✅ *(FS)* `.github/workflows/workflow.yml` exists.
   - ✅ *(FS)* `.gitlab-ci.yml` exists.

**Manual repro** — scaffold as above and run `find /tmp/scaffold -type f`. Expect ~40 files,
mostly `.gitkeep` placeholders under `platforms/<os>/<category>/`.

**Assessment**
- *Value:* moderate-to-high, and it hides a genuine tier trap: the scaffold ships **`fleets/`**, which is premium-only. Applied to a free instance, `fleetctl gitops` skips both files with `[!] skipping team config … since teams are only supported for premium Fleet users`. That means the repo Fleet gives every new customer is partly inert on free.
- *Coverage gaps:* that skip behaviour is exactly what the planned free `gitops-skips-teams.spec.ts` should assert, and it does not exist yet. Until it does, this entry documents a premium-shaped default without testing its free consequence.
- *Redundancy:* overlaps FCTL-09 on the scaffold run itself; the file lists are disjoint.
- *Efficiency / smells:* the `.gitkeep` tree (~25 files) is entirely unasserted. Probably right — asserting it would pin the plan to a layout Fleet reshuffles freely.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-11 · fleetctl new › prints the GitOps user setup next steps

- **File:** [`playwright/tests/cli/shared/new.spec.ts`](../../tests/cli/shared/new.spec.ts)
- **Grep:** `-g "prints the GitOps user setup next steps"`
- **Project:** premium **and** free · **Mode:** CLI (offline)

**Flow**

1. ☐ Run `fleetctl new --org-name "Playwright QA Org" --dir <tmp>/it-and-security`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `Next steps:`.
   - ✅ *(CLI)* stdout contains `--global-role gitops --api-only`.

**Manual repro** — scaffold and read the trailing output. It instructs the user to create a
GitOps API-only user and add `FLEET_URL` / `FLEET_API_TOKEN` as CI secrets.

**Assessment**
- *Value:* low-to-moderate. It is copy-pinning, but the pinned copy is a **command the user is told to paste** — if the flags drift (`--global-role` renamed, `--api-only` removed) the onboarding instructions silently become wrong. That is a defensible thing to pin.
- *Coverage gaps:* pins the flag fragment but never checks the printed command actually works. The natural strengthening is the planned `user.spec.ts` running that exact invocation.
- *Redundancy:* none.
- *Efficiency / smells:* the most brittle-by-design entry in the area — it will fail on innocuous copy edits. Acceptable *if* the team wants onboarding copy pinned; delete it if not. Worth an explicit decision rather than drift.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-12 · fleetctl new › refuses to write into an existing directory without --force

- **File:** [`playwright/tests/cli/shared/new.spec.ts`](../../tests/cli/shared/new.spec.ts)
- **Grep:** `-g "refuses to write into an existing directory without --force"`
- **Project:** premium **and** free · **Mode:** CLI (offline)

**Flow**

1. ☐ Scaffold once with `--org-name First`.
   - ✅ *(CLI)* Exit code is `0`.
2. ☐ Scaffold again into the **same** dir with `--org-name Second`, no `--force`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `already exists; use --force`.
3. ☐ Scaffold a third time with `--org-name Second --force`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(FS)* `default.yml` → `org_name` is now `Second` — the overwrite actually took effect.

**Manual repro** — run `fleetctl new --dir /tmp/x --org-name First` twice, then once with `--force`,
checking `org_name` in `/tmp/x/default.yml` after each.

**Assessment**
- *Value:* **best entry in this spec file.** It is the only one asserting a *state transition* rather than a single invocation, and step 3's `org_name` check proves `--force` overwrote rather than merely exiting 0. Guard-then-override is exactly where a data-loss bug would live.
- *Coverage gaps:* does not check `--force` leaves unrelated pre-existing files intact — the flag writes *into* a directory rather than replacing it, so a user's own files should survive. That is the actual data-loss scenario and it is untested.
- *Redundancy:* none.
- *Efficiency / smells:* three spawns in one test, correctly so — they are sequential states of one scenario, not independent cases.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-13 · fleetctl new › requires an organization name

- **File:** [`playwright/tests/cli/shared/new.spec.ts`](../../tests/cli/shared/new.spec.ts)
- **Grep:** `-g "requires an organization name"`
- **Project:** premium **and** free · **Mode:** CLI (offline)

**Flow**

1. ☐ Run `fleetctl new --org-name "   " --dir <tmp>/it-and-security` (whitespace-only).
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `organization name is required`.

**Manual repro** — `fleetctl new --org-name "   " --dir /tmp/y`. Note that **omitting** `--org-name`
entirely does something different: it opens an interactive `promptui` prompt, which is why the
test passes whitespace instead.

**Assessment**
- *Value:* moderate. Covers the `cleanOrgName` → `validateOrgName` path, and the whitespace-not-omitted choice is deliberate and correct for a non-TTY runner.
- *Coverage gaps:* the 255-character limit (`new.go`) and control-character stripping are unasserted, and they share this validator. Both are one-line additions here.
- *Redundancy:* Fleet's `new_test.go` likely covers the validator directly; this covers it through the shipped binary.
- *Efficiency / smells:* the reason for whitespace-over-omission is captured in a code comment — keep it if this is ever rewritten, since the obvious refactor (drop the flag) would hang the runner.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-14 · fleetctl · premium fleet commands › get fleets lists the provisioned fleets

- **File:** [`playwright/tests/cli/premium/fleets.spec.ts`](../../tests/cli/premium/fleets.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "get fleets lists the provisioned fleets"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get fleets`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `FLEET NAME`.
   - ✅ *(CLI)* stdout contains `HOST COUNT`.
   - ✅ *(CLI)* stdout contains `Workstations`.

**Manual repro** — `fleetctl get fleets`. The premium instance carries `Workstations` (gitops-provisioned),
plus `QA` and `VMs`. Compare with the team dropdown in the UI.

**Assessment**
- *Value:* high as the **positive half of a tier pair** — FCTL-21 asserts the same command is refused on free. Neither is worth much alone; together they pin the licence boundary from both sides. Asserting `Workstations` by name (not just a header) makes this a real data assertion, unlike FCTL-01/02.
- *Coverage gaps:* `HOST COUNT` and `USER COUNT` values are unchecked. Host count in particular drifts as other specs transfer hosts — including FCTL-15 in the same file — so pinning it would be wrong; noting *why* it is unpinned is useful.
- *Redundancy:* `helpers/api/fleets.ts` and the premium e2e areas cover fleets over HTTP. This is the CLI surface only.
- *Efficiency / smells:* hard-codes `Workstations`, which is safe — CLAUDE.md forbids creating or deleting fleets from test bodies, so it is a standing fixture.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-15 · fleetctl · premium fleet commands › hosts transfer moves a simulated host between fleets

- **File:** [`playwright/tests/cli/premium/fleets.spec.ts`](../../tests/cli/premium/fleets.spec.ts)
- **Grep:** `-g "hosts transfer moves a simulated host between fleets"`
- **Project:** premium · **Mode:** CLI + API
- **⚠️ Mutating** — moves one host between fleets and moves it back.

**Flow**

1. ☐ `findSimulatedHostIds(request, 'darwin', 1, 30)` — one simulated macOS host at **offset 30**.
   - ✅ *(API)* A host was found (fails loudly if the pool cannot cover the slice).
2. ☐ `GET /hosts/:id` → read `hostname`; `getHostFleetId()` → record `originalFleetId`.
3. ☐ Run `fleetctl hosts transfer --fleet Workstations --hosts <hostname>`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(API)* Polls until the host's `team_id` **differs** from `originalFleetId`.
4. ☐ *(finally)* Run `fleetctl hosts transfer --fleet '' --hosts <hostname>` to restore.
   - ✅ *(API)* Polls until `team_id` is back to `originalFleetId` (`null` = Unassigned).

**Manual repro** — pick a simulated macOS host (avoid anything reporting `VirtualMac2,1` or
`QEMU Virtual Machine` — those are the real VMs), note its **hostname** from the host details page,
then `fleetctl hosts transfer --fleet Workstations --hosts <hostname>` and watch the host's fleet
change in the UI. Restore with `--fleet ''`.

**Assessment**
- *Value:* highest in the area. The only entry that **mutates through the CLI and verifies through the API**, which is the correct shape for a CLI test: the command is the subject, the API is the oracle. Restoration is in a `finally`, so an assertion failure still returns the host.
- *Coverage gaps:* only the `--hosts` selector. `--label`, `--status` and `--search_query` are three untested selectors on a destructive command, and the mutual-exclusion rule (`--hosts cannot be used along side any other flag`) is unasserted.
- *Redundancy:* [`tests/e2e/premium/hosts/bulk-transfer.spec.ts`](../../tests/e2e/premium/hosts/bulk-transfer.spec.ts) covers transfer through the UI. Same outcome, different surface — not redundant, but the two should keep their host-pool offsets disjoint (this one takes 30; bulk-transfer takes 0, host-delete 10 and 20).
- *Efficiency / smells:* **two traps captured here that will bite the next author.** (1) `--hosts` resolves by **hostname**, not display name, and the two diverge on macOS VMs (`macos-prem's Virtual Machine` vs `macos-prems-Virtual-Machine.local`) — hence the explicit `GET /hosts/:id`. (2) `getHostFleetId` returns **`null`**, not `0`, for Unassigned. Restoring to `originalFleetId` rather than a literal is both more correct and avoids that trap.
- *Safety:* uses `findSimulatedHostIds`, which excludes virtualized hardware, so a real QA VM can never be selected. **This is the rule for every destructive CLI entry.**

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-16 · fleetctl generate-gitops · premium › emits premium-only SSO JIT provisioning

- **File:** [`playwright/tests/cli/premium/generate-gitops.spec.ts`](../../tests/cli/premium/generate-gitops.spec.ts)
- **Grep:** `-g "emits premium-only SSO JIT provisioning"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --key org_settings.sso_settings`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `enable_jit_provisioning`.

**Manual repro** — `fleetctl generate-gitops --key org_settings.sso_settings` on premium, then the
same on free. The premium output carries `enable_jit_provisioning: false`; the free output omits
the key entirely (`generate_gitops.go:1249`).

**Assessment**
- *Value:* high — the **premium half** of a tier pair with FCTL-24, targeting a licence branch that Fleet's own tests barely exercise (`generate_gitops_test.go` sets the free tier in exactly one of 3,239 lines).
- *Coverage gaps:* asserts the key's *presence*, not its value. Present-with-wrong-value would pass. Minor, since the value tracks instance config.
- *Redundancy:* none.
- *Efficiency / smells:* `--key` output is a partial generate — ~2.4s because the command still walks the whole instance before selecting the key. Three of the five entries in this file pay that cost.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-17 · fleetctl generate-gitops · premium › scopes controls to a fleet rather than the global config

- **File:** [`playwright/tests/cli/premium/generate-gitops.spec.ts`](../../tests/cli/premium/generate-gitops.spec.ts)
- **Grep:** `-g "scopes controls to a fleet rather than the global config"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --key controls`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* Output contains `Key controls not found in default.yml` — premium emits **no** global controls.
2. ☐ Run `fleetctl generate-gitops --fleet Workstations --key controls`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout contains `enable_disk_encryption`.

**Manual repro** — run both commands. On **free**, the first returns `{}` (controls exist at global
scope but are empty) rather than "not found" — the inverse of premium. That inversion is the whole point.

**Assessment**
- *Value:* high. Covers the most structurally significant tier difference in `generate-gitops` (`generate_gitops.go:566`): controls live per-fleet on premium and at global scope on free. Getting this wrong would produce a config that applies to the wrong scope — a silent, dangerous failure.
- *Coverage gaps:* asserts the **absence** of global controls via an error string, which is a weaker signal than parsing the generated tree. FCTL-30 asserts the same property structurally and is the better test; this one earns its place by covering the `--key`/`--fleet` flag combination.
- *Redundancy:* partial overlap with FCTL-30, on purpose — that one runs nightly-only, so this keeps the property covered in every run.
- *Efficiency / smells:* asserting on the string `Key controls not found in default.yml` couples the test to an error message. A message reword would fail it spuriously. Acceptable given `--key`'s design, but it is the fragile part.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-18 · fleetctl generate-gitops · premium › rejects --dir and --key together

- **File:** [`playwright/tests/cli/premium/generate-gitops.spec.ts`](../../tests/cli/premium/generate-gitops.spec.ts)
- **Grep:** `-g "rejects --dir and --key together"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --dir /tmp/unused --key controls`.
   - ✅ *(CLI)* Output contains `Only one of --dir or --key may be specified`.
   - ⚠️ **Exit code deliberately not asserted** — this path returns nil, so the command exits **0**.

**Manual repro** — run it and check `echo $?`. It prints the error and exits 0. Nothing is written
to `/tmp/unused`.

**Assessment**
- *Value:* moderate. Flag-validation coverage is normally Go-test territory, but the exit-0-on-error behaviour makes it worth pinning from outside: any script wrapping `generate-gitops` and checking `$?` would treat this as success.
- *Coverage gaps:* does not assert `/tmp/unused` stays unwritten — the meaningful safety property. Currently the test would pass even if the command created the directory before erroring.
- *Redundancy:* Fleet's Go tests likely cover the branch; the distinct value here is the exit code, which unit tests do not observe.
- *Efficiency / smells:* **the exit-0-on-error behaviour is arguably a product bug** and is called out in the test plan. If Fleet ever fixes it, this entry and FCTL-19 must be updated to assert exit 1 — worth a note so a future author does not "fix" the test by loosening it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-19 · fleetctl generate-gitops · premium › requires one of --dir or --key

- **File:** [`playwright/tests/cli/premium/generate-gitops.spec.ts`](../../tests/cli/premium/generate-gitops.spec.ts)
- **Grep:** `-g "requires one of --dir or --key"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops` with no flags.
   - ✅ *(CLI)* Output contains `Either --dir or --key must be specified`.
   - ⚠️ Exit code not asserted — also returns 0.

**Manual repro** — `fleetctl generate-gitops` bare. Prints the message immediately, before any
server call (the check precedes `GetAppConfig`).

**Assessment**
- *Value:* moderate, and the cheapest entry in this file (~150ms) because it short-circuits before contacting the server.
- *Coverage gaps:* none meaningful — this is a single guard clause.
- *Redundancy:* pairs with FCTL-18 as the two halves of the `--dir`/`--key` XOR. Neither is complete alone.
- *Efficiency / smells:* same exit-0 caveat as FCTL-18.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-20 · fleetctl generate-gitops · premium › reports an unknown fleet by name

- **File:** [`playwright/tests/cli/premium/generate-gitops.spec.ts`](../../tests/cli/premium/generate-gitops.spec.ts)
- **Grep:** `-g "reports an unknown fleet by name"`
- **Project:** premium · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --fleet no-such-fleet-here --key controls`.
   - ✅ *(CLI)* Output contains `not found`.

**Manual repro** — run it. Prints `Fleet no-such-fleet-here not found` after listing teams, and
exits 0.

**Assessment**
- *Value:* moderate. Covers the name-resolution path, which normalises through `generateFilename()` — so `Workstations`, `workstations` and `workstations.yml` all resolve to the same fleet.
- *Coverage gaps:* that normalisation is the interesting behaviour and is untested. A positive case (`--fleet workstations` lower-case resolving to `Workstations`) would cover it in one line and is more valuable than the negative case here.
- *Redundancy:* none.
- *Efficiency / smells:* matching on the bare substring `not found` is loose — it would also match an unrelated "key not found" message. Asserting the full `Fleet <name> not found` would be tighter.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-21 · fleetctl · free licence gating › get fleets is refused

- **File:** [`playwright/tests/cli/free/licensing.spec.ts`](../../tests/cli/free/licensing.spec.ts)
- **Grep:** `npm run test:free -- tests/cli/ -g "get fleets is refused"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get fleets` against the **free** instance.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* stderr matches `/missing or invalid license/`.

**Manual repro** — `fleetctl get fleets` on free. Expect
`Error: could not list teams: missing or invalid license (API time: NNms)`.

**Assessment**
- *Value:* high. The canonical licence-denial assertion, and the **free half** of the pair with FCTL-14. Asserting exit code *and* stderr matters: a command that printed the error but exited 0 would break every wrapping script, and this area has three commands that do exactly that (FCTL-18/19/20).
- *Coverage gaps:* none for this command.
- *Redundancy:* `tests/api/free/` covers licence gating at the HTTP layer. This covers the CLI's translation of it, which is a separate surface with its own exit-code contract.
- *Efficiency / smells:* the regex tolerates the `(API time: NNms)` suffix, which is correct — that timing value is nondeterministic and must not be pinned.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-22 · fleetctl · free licence gating › get teams (deprecated alias) is refused

- **File:** [`playwright/tests/cli/free/licensing.spec.ts`](../../tests/cli/free/licensing.spec.ts)
- **Grep:** `-g "get teams (deprecated alias) is refused"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get teams` (the pre-rename alias).
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `'fleetctl teams' is deprecated; use 'fleets' instead`.
   - ✅ *(CLI)* stderr matches `/missing or invalid license/`.

**Manual repro** — `fleetctl get teams` on free. Prints the deprecation notice *and* the licence
error. On premium it prints the deprecation notice and then the table.

**Assessment**
- *Value:* high, and easy to under-rate. Fleet's teams → fleets rename is the exact class of change that silently breaks customer automation, and this pins that the **old name still works and still warns**. The suite's own CLAUDE.md flags these renames as costly.
- *Coverage gaps:* only asserts the alias on free, where it errors anyway. The premium path — where the alias must return real data — is unasserted, and that is where a broken alias would actually hurt.
- *Redundancy:* overlaps FCTL-21 on the licence assertion; the deprecation-notice assertion is unique.
- *Efficiency / smells:* the deprecation string is pinned verbatim including the quotes. Brittle, but appropriate — the whole point is that this copy is a compatibility promise.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-23 · fleetctl · free licence gating › get mdm-apple-bm is refused

- **File:** [`playwright/tests/cli/free/licensing.spec.ts`](../../tests/cli/free/licensing.spec.ts)
- **Grep:** `-g "get mdm-apple-bm is refused"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl get mdm-apple-bm`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* stderr matches `/missing or invalid license/`.

**Manual repro** — `fleetctl get mdm-apple-bm` on free →
`Error: could not get Apple BM information: missing or invalid license`. On premium it prints the
Apple ID, organisation name, MDM server URL and renew date.

**Assessment**
- *Value:* high. Together with FCTL-05 this pins the **Apple MDM tier boundary**: APNs works on free, ABM does not. That split is genuinely easy to get wrong when reasoning about MDM as one feature.
- *Coverage gaps:* the premium positive case is not asserted anywhere — there is no `get mdm-apple-bm` entry in `tests/cli/premium/`. This is the clearest **missing counterpart** in the area, and it would also cover the ABM renew date (expiring May 2027), same argument as FCTL-05.
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

### FCTL-24 · fleetctl · free licence gating › generate-gitops omits premium-only SSO fields

- **File:** [`playwright/tests/cli/free/licensing.spec.ts`](../../tests/cli/free/licensing.spec.ts)
- **Grep:** `-g "generate-gitops omits premium-only SSO fields"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --key org_settings.sso_settings` on free.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* stdout does **not** contain `enable_jit_provisioning`.
   - ✅ *(CLI)* stdout **does** contain `enable_sso` — proving the command ran and produced SSO output, not nothing.

**Manual repro** — run on free, then premium, and diff. Only `enable_jit_provisioning` differs.

**Assessment**
- *Value:* high — the **free half** of the pair with FCTL-16, and a well-constructed negative test. The `enable_sso` positive assertion is what keeps it honest: without it, a command that output nothing at all would pass.
- *Coverage gaps:* two other premium-only omissions on this path are unasserted — `microsoft_graph_credentials` (`generate_gitops.go:930`) and the Google Workspace IdP entry in `integrations` (`:976`). Both are one-line additions in the same shape.
- *Redundancy:* none.
- *Efficiency / smells:* none. This is the entry other negative tests in the area should be modelled on.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-25 · fleetctl · free licence gating › generate-gitops omits software, which is premium-only

- **File:** [`playwright/tests/cli/free/licensing.spec.ts`](../../tests/cli/free/licensing.spec.ts)
- **Grep:** `-g "generate-gitops omits software, which is premium-only"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --key software` on free.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* Output contains `Key software not found`.

**Manual repro** — run on free. `generate_gitops.go:2077` hard-returns `nil` for software on the
free tier, so the key never appears in the generated tree.

**Assessment**
- *Value:* moderate. Covers a clean, explicit licence branch.
- *Coverage gaps:* `Key software not found` is also what you would get on **premium** for a fleet with no installable software — so this assertion does not actually distinguish "omitted because free" from "empty because nothing installed". On free that ambiguity is harmless (the branch is unconditional), but the test does not prove what its name claims. FCTL-30's structural check is the stronger form.
- *Redundancy:* overlaps FCTL-30's free branch, which asserts `default.yml` has no `software` key at all.
- *Efficiency / smells:* the ambiguity above is the one thing worth fixing in this entry — asserting on the generated tree rather than the `--key` miss would remove it.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## FCTL-38..43 — `gitops --dry-run`

All six drive a **fresh `fleetctl new` scaffold** rather than anything under `gitops/`. That is
deliberate: the repo configs interpolate ABM/VPP/SSO variables the suite does not otherwise
require (see `.env.*.example`), so using them would make those variables mandatory for everyone.
A scaffold needs only `FLEET_URL` plus a throwaway `FLEET_ENROLL_SECRET` passed per-invocation,
cannot be perturbed by whatever the nightly last applied, and doubles as a check that the
repository Fleet hands new customers actually validates against a live server.

**`--dry-run` is not a diff.** It reports everything it *would apply* regardless of current
state, so `[+] would've applied 22 policies` says nothing about the instance. Only
`[-] would've deleted …` is state-dependent: gitops proposes a deletion solely for something
that exists on the server and is absent from the config. Every assertion in this group that
cares about instance state keys on the `[-]` lines.

FCTL-43 lives in the nightly project; the rest run every time.

---

### FCTL-38 · fleetctl gitops --dry-run › validates the fleetctl new scaffold without changing anything

- **File:** [`playwright/tests/cli/shared/gitops-dry-run.spec.ts`](../../tests/cli/shared/gitops-dry-run.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "without changing anything"`
- **Project:** premium **and** free · **Mode:** CLI + API

**Flow**

1. ☐ `fleetctl new --org-name "Dry Run Org" --dir <tmp>` .
2. ☐ `GET /labels` — record every label name.
3. ☐ `fleetctl gitops --dry-run -f <tmp>/default.yml`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* Output contains `gitops dry run succeeded`.
   - ✅ *(CLI)* Output matches `would've deleted` — the scaffold declares none of this instance's
     labels, so the dry run announces removing them.
4. ☐ `GET /labels` again.
   - ✅ *(API)* The label set is **identical** to step 2.

**Manual repro** — scaffold into `/tmp`, note the label count in **Hosts → Labels**, run the
dry run, watch it threaten to delete 19 labels, then confirm the count is unchanged.

**Assessment**
- *Value:* high, and it is the group's keystone. Step 3's deletion assertion and step 4's
  no-change assertion only mean something together: the dry run has to *threaten* destruction for
  "nothing was destroyed" to be evidence rather than a tautology. It is also the negative control
  that makes FCTL-43's no-deletions assertion non-vacuous.
- *Coverage gaps:* only labels are re-read. Policies, reports, scripts and profiles are equally
  threatened by the same dry run and equally unverified — cheap to extend, and labels were chosen
  only because they are global on both tiers.
- *Redundancy:* none.
- *Efficiency / smells:* the assertion in step 3 depends on the instance having at least one
  label the scaffold does not declare. True on both QA instances and on any real deployment, but
  it would silently become vacuous against an empty Fleet.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-39 · fleetctl gitops --dry-run › rejects an unknown key

- **File:** [`playwright/tests/cli/shared/gitops-dry-run.spec.ts`](../../tests/cli/shared/gitops-dry-run.spec.ts)
- **Grep:** `-g "rejects an unknown key"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ Write `org_settings:\n  bogus_key: true` to a temp file.
2. ☐ `fleetctl gitops --dry-run -f <that file>`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `unknown key "org_settings.bogus_key"`.

**Manual repro** — as above. Note the message names the offending key *and* the file, which is
what makes gitops usable across a multi-file repo.

**Assessment**
- *Value:* moderate. Strict key validation is what stops a typo'd GitOps key from silently doing
  nothing in a customer's repo — a failure mode with no other signal.
- *Coverage gaps:* one key, at one nesting depth. Unknown keys inside `controls`, `policies` or a
  fleet file take different parse paths and are unasserted.
- *Redundancy:* Fleet's Go tests cover the parser; this covers it through the shipped binary.
- *Efficiency / smells:* fast (~300ms) and fully self-contained.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-40 · fleetctl gitops --dry-run › reports a missing config file

- **File:** [`playwright/tests/cli/shared/gitops-dry-run.spec.ts`](../../tests/cli/shared/gitops-dry-run.spec.ts)
- **Grep:** `-g "reports a missing config file"`
- **Project:** premium **and** free · **Mode:** CLI

**Flow**

1. ☐ `fleetctl gitops --dry-run -f <path that does not exist>`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `failed to read file`.

**Manual repro** — point `-f` at any nonexistent path.

**Assessment**
- *Value:* low-to-moderate. Its real worth is the **exit code**: a CI pipeline whose `-f` path
  drifts after a repo reshuffle must fail loudly, not skip the file and report success.
- *Coverage gaps:* none meaningful.
- *Redundancy:* none.
- *Efficiency / smells:* the loosest matcher in the group (`failed to read file`), which is
  appropriate — the rest of the message is an OS-level error string.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-41 · fleetctl gitops --dry-run · premium › processes fleet configs; `--delete-other-fleets`

- **File:** [`playwright/tests/cli/premium/gitops-dry-run.spec.ts`](../../tests/cli/premium/gitops-dry-run.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "processes fleet configs"`
- **Project:** premium · **Mode:** CLI · **2 tests**

**Flow — fleet configs are processed**

1. ☐ Scaffold, then `fleetctl gitops --dry-run -f default.yml -f fleets/*.yml`.
   - ✅ *(CLI)* Exit code is `0`, output contains `gitops dry run succeeded`.
   - ✅ *(CLI)* Output does **not** contain `teams are only supported for premium Fleet users`.
   - ✅ *(CLI)* Output matches `would've applied \d+ fleet`.

**Flow — `--delete-other-fleets`**

2. ☐ Same, plus `--delete-other-fleets`.
   - ✅ *(CLI)* Exit code is `0`.
   - ✅ *(CLI)* Output matches `would've deleted .*fleet` — the scaffold names none of this
     instance's fleets, so all of them, `Workstations` included, are proposed for removal.

**Manual repro** — run both. **Never drop `--dry-run` from the second one**: a real apply would
delete the gitops-provisioned `Workstations` fleet and create a separate `💻 Workstations`.

**Assessment**
- *Value:* high. The premium half of the tier pair with FCTL-42, and the only coverage anywhere of
  `--delete-other-fleets` — the single most destructive flag in the CLI.
- *Coverage gaps:* asserts that deletion is *proposed*, never which fleets. Naming `Workstations`
  explicitly would be a stronger assertion, at the cost of coupling to instance state.
- *Redundancy:* none.
- *Efficiency / smells:* the second test is one `--dry-run` away from wiping the instance's fleet
  structure. That is inherent to covering the flag at all, and the header comment says so, but it
  is the entry to be most careful editing.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-42 · fleetctl gitops · free skips team configs › skips every fleet file in the scaffold

- **File:** [`playwright/tests/cli/free/gitops-skips-teams.spec.ts`](../../tests/cli/free/gitops-skips-teams.spec.ts)
- **Grep:** `npm run test:free -- tests/cli/ -g "skips every fleet file"`
- **Project:** free · **Mode:** CLI

**Flow**

1. ☐ Scaffold; collect every `fleets/*.yml` it wrote.
   - ✅ *(FS)* At least one fleet manifest exists.
2. ☐ `fleetctl gitops --dry-run -f default.yml -f <each fleet file>`.
   - ✅ *(CLI)* Exit code is `0` — skipping is not an error, the global config still applies.
   - ✅ *(CLI)* Output contains `gitops dry run succeeded`.
   - ✅ *(CLI)* For **each** fleet file: `[!] skipping team config <path> since teams are only
     supported for premium Fleet users`.

**Manual repro** — scaffold, then dry-run the whole thing against the free instance. Both fleet
files are skipped by name.

**Assessment**
- *Value:* high, and higher than "a skipped-file message" sounds. `fleetctl new` ships
  `fleets/workstations.yml` and `fleets/personal-mobile-devices.yml` to **every** new customer,
  free included — for whom both are inert. A free user following Fleet's own onboarding gets a
  repo that manages less than it appears to, and this line is the only thing saying so.
- *Coverage gaps:* asserts the message, not the consequence — nothing checks that no fleet was
  actually created. On free that is guaranteed by licensing, so the gap is theoretical.
- *Redundancy:* the premium mirror is FCTL-41.
- *Efficiency / smells:* the expected string is pinned verbatim including the absolute path, so a
  reworded message fails it. Correct — that message is the entire user-facing signal.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## FCTL-31..37 — `mdm lock` / `unlock` / `wipe`

Grouped because they share one set of environment facts, measured live on 2026-08-14 by locking
one simulation per platform and following it through. **Read this before running any of them by
hand** — it is the difference between a safe test and a host you cannot get back.

### What a simulation actually does

| Platform | `lock` | `unlock` | Recovers? |
|---|---|---|---|
| Linux | → `locked` at once | script, succeeded first try | ✅ |
| Windows | → `locked` at once | script, **needed 2–3 requests** | ✅ |
| macOS | **502 `bad device token`** — never locks | n/a | ✅ (an unlock clears it) |

- **macOS simulations can never be locked.** osquery-perf enrols with a synthetic APNs device
  token, so the DeviceLock push always 502s. The host still briefly records
  `pending_action: 'lock'` before an unlock clears it.
- **Windows/Linux lock and unlock are scripts**, and osquery-perf answers every script with
  `exitCode := rand.Intn(2)` — a coin flip **on each step**. Fleet accepts the request either
  way; the host simply doesn't reach the new state. Hence the shared `settle()` retry used by
  both FCTL-34 and FCTL-35; single-shot assertions flake ~50% each.
- **Nothing gets permanently poisoned.** The simulations do run orbit (`orbit_version 1.22.0`,
  `scripts_enabled true`) and do execute scripts. Watch out: `scripts_enabled` reads `null` on the
  **list** endpoint and `true` on the **detail** endpoint — the list value makes this look unsafe.

### Why the refusal specs are safe

`fleetctl` refuses a non-MDM-connected host **client-side** (`hostMdmActionSetup`), before any
server call, for darwin/ios/ipados/windows/android. FCTL-31 relies on that entirely: it never
reaches Fleet. Linux is *not* MDM-gated, so it would reach the server — which is why Linux is
absent from FCTL-31 and appears only in FCTL-37 (free, short-circuited by the licence check) and
FCTL-34/35 (premium, where a real lock is the point).

Every refusal entry draws its host with `mdmConnected: false` via `findSimulatedHostForMdm`.
About a third of the pool *is* enrolled, and one of those would reach the server.

### Auditing the pool

```bash
curl -sH "Authorization: Bearer $FLEET_API_TOKEN" \
  "$FLEET_URL/api/latest/fleet/hosts?per_page=300&status=online&include_device_status=true" \
  | jq '[.hosts[] | select(.mdm.device_status != "unlocked" and .mdm.device_status != null)]'
```

`include_device_status=true` returns lock state for every host in one call; without it you need
one detail request per host (~300).

---

### FCTL-31 · fleetctl mdm · premium error handling › `{lock,unlock,wipe}` refuses a `{darwin,windows}` host with MDM off

- **File:** [`playwright/tests/cli/premium/mdm-lock-wipe.spec.ts`](../../tests/cli/premium/mdm-lock-wipe.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "refuses a darwin host with MDM off"`
- **Project:** premium · **Mode:** CLI + API · **Expands to 6 tests** (2 platforms × 3 actions)

**Flow**

1. ☐ `findSimulatedHostForMdm(request, <platform>, false)` — a simulation **with MDM off**.
   - ✅ *(API)* A host was found.
2. ☐ Run `fleetctl mdm <action> --host <hostname>`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output matches `Can't <action> the host because it doesn't have MDM turned on.`

**Manual repro** — find an online simulated macOS or Windows host whose **MDM status is Off**
(host details → MDM), then `fleetctl mdm lock --host <hostname>`. It refuses without contacting
the server; the host's `device_status` stays `unlocked` throughout.

**Assessment**
- *Value:* high. Six tests for one guard, but the guard is the thing standing between this suite and an unrecoverable host, and it is asserted per platform *and* per action because the message interpolates both.
- *Coverage gaps:* the two other macOS-family refusals — `CantLockPersonalHostsMessage` (personal enrolment) and `CantLockManualIOSIpadOSHostsMessage` (manual iOS/iPadOS) — are unasserted, and the pool has no iOS/iPadOS or personally-enrolled hosts to reach them with.
- *Redundancy:* none. FCTL-36 asserts the *licence* refusal on free; this asserts the *MDM-state* refusal on premium. Different guards, different layers.
- *Efficiency / smells:* the message is asserted via an interpolated regex, so a reworded error fails all six at once — correct, since that message is the contract.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-32 · fleetctl mdm · premium error handling › `{lock,unlock,wipe}` reports an unknown host identifier

- **File:** [`playwright/tests/cli/premium/mdm-lock-wipe.spec.ts`](../../tests/cli/premium/mdm-lock-wipe.spec.ts)
- **Grep:** `-g "reports an unknown host identifier"`
- **Project:** premium · **Mode:** CLI · **Expands to 3 tests**

**Flow**

1. ☐ Run `fleetctl mdm <action> --host no-such-host-fleetctl-cli-spec`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output contains `Host doesn't exist.`

**Manual repro** — `fleetctl mdm lock --host definitely-not-a-host`. The full message points at
Fleet's host-identifiers doc.

**Assessment**
- *Value:* moderate. Cheap (~160ms, no host lookup needed) and pins that identifier resolution happens *before* any state change — a lock against a typo must not do anything.
- *Coverage gaps:* asserts only the first sentence. The message's value is really the doc link, which is unasserted and is the part most likely to rot.
- *Redundancy:* the same `HostNotFoundErrMsg` path is exercised by `hosts transfer` (FCTL-15) implicitly, but nothing asserts it there.
- *Efficiency / smells:* none.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-33 · fleetctl mdm · premium error handling › `{lock,unlock,wipe}` requires the --host flag

- **File:** [`playwright/tests/cli/premium/mdm-lock-wipe.spec.ts`](../../tests/cli/premium/mdm-lock-wipe.spec.ts)
- **Grep:** `-g "requires the --host flag"`
- **Project:** premium · **Mode:** CLI · **Expands to 3 tests**

**Flow**

1. ☐ Run `fleetctl mdm <action>` with no `--host`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output matches `Required flag "host" not set`.

**Manual repro** — `fleetctl mdm wipe`. Fails instantly with no server contact.

**Assessment**
- *Value:* low-to-moderate on its own — urfave/cli enforces `Required: true`, so this is really testing the library. It earns a little back on `wipe`, where "what happens with no target" is a question worth having an answer on record for.
- *Coverage gaps:* none meaningful.
- *Redundancy:* three near-identical tests for one library behaviour. The clearest **trim candidate** in this group — one test would carry the same information.
- *Efficiency / smells:* fastest tests in the area (~16ms each), so the trim saves nothing but noise.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-34 · fleetctl mdm lock lifecycle › locks a simulated linux host

- **File:** [`playwright/tests/cli/premium/mdm-lock-lifecycle.spec.ts`](../../tests/cli/premium/mdm-lock-lifecycle.spec.ts)
- **Grep:** `npm run test:premium -- tests/cli/ -g "locks a simulated linux host"`
- **Project:** premium · **Mode:** CLI + API · **Serial** with FCTL-35
- **⚠️ Mutating** — genuinely locks a host. FCTL-35 restores it; `afterAll` is the backstop.

**Flow**

1. ☐ `findSimulatedHostForMdm(request, 'linux', { mdmConnected: false, withOrbit: true, offset: 5 })`.
   - ✅ *(API)* A host was found.
2. ☐ Run `fleetctl mdm lock --host <hostname>`.
   - ✅ *(CLI)* Exit code is `0` (failure message includes the CLI output).
   - ✅ *(CLI)* stdout contains `The host will lock when it comes online.`
3. ☐ `settle(..., 'lock', 'locked')` — up to 5 rounds, re-issuing whenever the script rolls a
   failure, waiting for `pending_action` to clear between rounds.
   - ✅ *(API)* Final `mdm.device_status` is `locked`.

**Manual repro** — pick an online simulated Linux host **that reports an `orbit_version`**, run
`fleetctl mdm lock --host <hostname>`, then watch **Host details → status** or
`curl .../hosts/<id> | jq .host.mdm.device_status`. It flips to `locked` within seconds.
**Then unlock it** — see FCTL-35 — or delete the host.

**Assessment**
- *Value:* high. The only entry in the suite that drives Fleet's lock state machine for real. Everything else in this area asserts refusals.
- *Coverage gaps:* macOS cannot be covered at all (502 on a synthetic APNs token), so the platform customers actually lock has no lifecycle coverage. Windows was dropped deliberately — see below. `wipe` has no lifecycle either, and unlike lock it is genuinely irreversible: a wiped simulation can only be deleted.
- *Redundancy:* none.
- *Efficiency / smells:* **`withOrbit` is load-bearing, not a nicety.** Only ~39 of ~97 Ubuntu simulations run orbit (`--orbit_prob` defaults to 0.5), and orbit is what polls for the lock script. Locking a host without it strands the host permanently — one was lost that way while building this spec, and had to be deleted. The offset is 5 rather than 40 for the same reason: requiring orbit makes the real pool a third of the raw platform count.
- *Scope note:* Windows was covered here initially and removed. It reaches the same script path, so the increment was thin (fleetctl's client-side MDM guard in its *passing* direction, plus `VerifyMDMWindowsConfigured`) while the precondition was fragile — it needs an MDM-connected simulation, and only ~29 exist with enrolment set probabilistically by `--mdm_prob 0.3`. **The gap that leaves:** nothing now exercises the client-side guard in the passing direction, so a guard that broke toward "always refuse" would leave FCTL-31 green.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-35 · fleetctl mdm lock lifecycle › unlocks the linux host again

- **File:** [`playwright/tests/cli/premium/mdm-lock-lifecycle.spec.ts`](../../tests/cli/premium/mdm-lock-lifecycle.spec.ts)
- **Grep:** `-g "unlocks the linux host again"`
- **Project:** premium · **Mode:** CLI + API · **Serial** after FCTL-34
- **⚠️ Mutating** — restores FCTL-34's host.

**Flow**

1. ☐ `settle(..., 'unlock', 'unlocked')` — up to **5 rounds**:
   - ☐ If no action is pending, run `fleetctl mdm unlock --host <hostname>`.
     - ✅ *(CLI)* Exit code is `0`.
   - ☐ Poll until `pending_action` clears (120s budget).
   - ✅ *(API)* Re-read `device_status`.
2. ✅ *(API)* Final `device_status` is `unlocked`.
3. ☐ *(describe `afterAll`)* If the host is not `unlocked` with no pending action, try one more
   unlock and then **delete it**.

**Manual repro** — `fleetctl mdm unlock --host <hostname>` on a locked simulation, wait ~60s for
orbit's config poll, check `device_status`. **If it is still `locked`, run unlock again** — the
simulated script fails about half the time. Repeat until it clears.

**Assessment**
- *Value:* high, and it is what makes FCTL-34 safe to run at all. The retry loop is not defensive padding — two consecutive unlock failures were observed while characterising this.
- *Coverage gaps:* it cannot distinguish "unlock failed because osquery-perf rolled a 1" from "unlock failed because Fleet is broken". Five rounds makes a false failure ~3% likely, but a *real* regression would present identically. The failure message says so rather than pretending otherwise.
- *Redundancy:* none.
- *Efficiency / smells:* the pair is the slowest thing in the area — 58s–2.5m across four consecutive runs, timeout `5 × 120s` per step. **Cleanup deliberately lives in the describe's `afterAll`, not in this test.** The describe is serial, so a failure in FCTL-34 skips this test entirely; cleanup hanging off it would never run and would strand a locked host — which is exactly how a host was lost during development. Deletion stays last-resort: a deleted simulation does not re-enrol, and the pool only refills on the daily `tools/perf-hosts/` refresh.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-36 · fleetctl mdm · free licence gating › `{lock,unlock,wipe}` refused on MDM-enrolled `{darwin,windows}`

- **File:** [`playwright/tests/cli/free/mdm-licensing.spec.ts`](../../tests/cli/free/mdm-licensing.spec.ts)
- **Grep:** `npm run test:free -- tests/cli/ -g "is refused on an MDM-enrolled darwin host"`
- **Project:** free · **Mode:** CLI + API · **Expands to 6 tests**

**Flow**

1. ☐ `findSimulatedHostForMdm(request, <platform>, true)` — an **MDM-enrolled** simulation.
   - ☐ Skips with a reason when the pool has none.
2. ☐ Run `fleetctl mdm <action> --host <hostname>`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output matches `/missing or invalid license/`.

**Manual repro** — on the **free** instance, find a simulated host whose MDM status is On, then
`fleetctl mdm lock --host <hostname>`. Expect the licence error. The host is untouched: free's
`LockHost` returns `ErrMissingLicense` immediately, with no datastore write.

**Assessment**
- *Value:* high. Free is the only tier where these commands can be aimed at an *enrolled* host safely, so this is the only place the server-side licence gate is provably reached rather than the CLI's client-side MDM guard shadowing it. That distinction is the whole design of this file.
- *Coverage gaps:* free's Android wipe carve-out (COBO wipe is permitted on free) is unasserted — the QA pool has no Android hosts. That is the one free-tier MDM behaviour with no coverage anywhere.
- *Redundancy:* FCTL-31 covers the same three verbs on premium against the *other* guard.
- *Efficiency / smells:* uses `test.skip` when no enrolled host exists, which is right — it is a data-availability precondition, not debt — but it does mean a pool drift to 0% enrolment would silently zero this coverage.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-37 · fleetctl mdm · free licence gating › `{lock,unlock,wipe}` refused on a Linux host

- **File:** [`playwright/tests/cli/free/mdm-licensing.spec.ts`](../../tests/cli/free/mdm-licensing.spec.ts)
- **Grep:** `-g "is refused on a Linux host"`
- **Project:** free · **Mode:** CLI + API · **Expands to 3 tests**

**Flow**

1. ☐ `findSimulatedHostForMdm(request, 'linux', false)`.
   - ✅ *(API)* A host was found.
2. ☐ Run `fleetctl mdm <action> --host <hostname>`.
   - ✅ *(CLI)* Exit code is `1`.
   - ✅ *(CLI)* Output matches `/missing or invalid license/`.

**Manual repro** — on **free**, `fleetctl mdm lock --host <ubuntu simulation hostname>`. Note this
is the one platform where fleetctl does *not* pre-check MDM, so the request genuinely reaches the
server. On **premium** the same command would lock the host for real.

**Assessment**
- *Value:* high, and easy to mistake for a duplicate of FCTL-36. Linux is the only platform that
  bypasses fleetctl's client-side guard, so these three are the only ones proving the licence
  check fires **server-side** rather than the CLI refusing first. They also give Linux — otherwise
  untestable for MDM refusals — its coverage.
- *Coverage gaps:* none for the licence path.
- *Redundancy:* verb overlap with FCTL-36, guard coverage is disjoint. Worth keeping both.
- *Efficiency / smells:* the asymmetry (safe on free, destructive on premium) is the single most
  dangerous thing to forget in this area. It is documented in the spec header; anyone copying
  this pattern to `tests/cli/premium/` would lock a host for real.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## FCTL-26..30 — the nightly `generate-gitops` project

These five **do not run in a normal suite run.** They compare `fleetctl generate-gitops` output
against the min GitOps config that produced the instance state, which is only a valid comparison
in one window: **immediately after the min apply, before the Playwright suite touches anything.**

`setup/cleanup.steps.ts` drains every global report and policy before the first browser test. Run
these afterwards and FCTL-27/28 compare against an empty instance. This was confirmed live —
running the project against premium today gives 4 passes and one failure on reports (26 expected,
0 found), which is the constraint, not a bug.

Wired as `verify-generate-gitops` in both
[`nightly-qa-gitops-premium.yml`](../../../.github/workflows/nightly-qa-gitops-premium.yml) and
[`nightly-qa-gitops-free.yml`](../../../.github/workflows/nightly-qa-gitops-free.yml), gated on
the min-verify jobs.

**Two traps that shaped these entries:**

- **File refs ≠ entities.** `premium-fleetqa-min/default.yml` lists **10** label `path:` refs which
  resolve to **23** labels — `lib/labels/macs-with-fleet-maintained-apps-installed.yml` alone
  declares nine. Comparison goes through `loadGitOpsConfig()`, which flattens them; never count `path:` lines.
- **Byte-diffing will not work.** `generate-gitops` inlines content where the source used `path:`
  refs. Only resolved entity-name sets are comparable.

Shared **preconditions** for FCTL-26..30:

- `fleetctl gitops` applied for `<tier>-fleetqa-min` immediately before, and the Playwright suite
  has **not** run since.
- `SUITE` set explicitly (`generate-gitops` is in `SUITE_AMBIGUOUS_PROJECTS`).
- `GITOPS_TARGET` optional — defaults to `gitops/<tier>-fleetqa-min` by `SUITE`.
- **Data created:** none on the instance. Writes one temp dir per process; no `--insecure`, so no
  live secrets are ever written to disk.
- One `generate` run is shared across all five tests via a module-level cache.

---

### FCTL-26 · generate-gitops › reproduces the applied label set

- **File:** [`playwright/tests/cli/nightly/generate-gitops.spec.ts`](../../tests/cli/nightly/generate-gitops.spec.ts)
- **Grep:** `npm run test:gitops-nightly:premium -- -g "reproduces the applied label set"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Run `fleetctl generate-gitops --dir <tmp>`; parse `default.yml`.
   - ✅ *(CLI)* Exit code is `0` and `default.yml` was written (else the helper throws).
2. ☐ Load `gitops/<tier>-fleetqa-min` and flatten its label refs.
   - ✅ *(FS)* Generated `labels[].name`, sorted, **exactly equals** the min config's resolved label names, sorted.

**Manual repro** — after a min apply: `fleetctl generate-gitops --dir /tmp/gen`, then compare
`grep '^  name:' /tmp/gen/default.yml` (labels block) against the names inside the files listed
under `labels:` in `gitops/<tier>-fleetqa-min/default.yml`. Verified as an exact 23/23 match.

**Assessment**
- *Value:* high. Exact set equality — not superset — which is only possible because gitops label application is fully declarative. Catches both dropped and spurious labels in one assertion.
- *Coverage gaps:* names only. Label *queries*, platforms and descriptions round-trip unchecked, and a label whose query was silently mangled would pass.
- *Redundancy:* GV-05..07 assert the same names over HTTP against the same config. The distinct value here is that the **CLI's generated YAML** matches, not just the server state — the two could diverge only through a generate bug, which is precisely what this catches.
- *Efficiency / smells:* built-in labels are correctly excluded by `generate-gitops` itself, so no filtering is needed on the test side. Worth knowing, since GV-05 has to filter `label_type`.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-27 · generate-gitops › reproduces the applied global policy set

- **File:** [`playwright/tests/cli/nightly/generate-gitops.spec.ts`](../../tests/cli/nightly/generate-gitops.spec.ts)
- **Grep:** `-g "reproduces the applied global policy set"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Generate (shared run).
2. ☐ Compare `default.yml` → `policies[].name` against the min config's resolved policy names.
   - ✅ *(FS)* Sorted sets are **exactly equal** (22/22 on premium-min).

**Manual repro** — as FCTL-26, reading the `policies:` block.

**Assessment**
- *Value:* high, same argument as FCTL-26.
- *Coverage gaps:* names only — `platform`, `critical`, `resolution` and the premium-only label-scoping keys (`labels_include_any` etc., `generate_gitops.go:1852-1861`) all round-trip unchecked. The label-scoping keys are premium-gated, so this is also a **missed tier assertion**.
- *Redundancy:* GV-08..11 cover policy names *and* platform over HTTP. This adds the CLI generate path; GV-11's platform check is the stronger of the two on field coverage.
- *Efficiency / smells:* **most likely of the five to fail on residue.** Global policies are drained by cleanup *and* created by policy specs, so an out-of-window run fails here first. A leftover `playwright-policy-…-edited` was observed doing exactly that during development.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-28 · generate-gitops › reproduces the applied global report set

- **File:** [`playwright/tests/cli/nightly/generate-gitops.spec.ts`](../../tests/cli/nightly/generate-gitops.spec.ts)
- **Grep:** `-g "reproduces the applied global report set"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Generate (shared run).
2. ☐ Compare `default.yml` → `reports[].name` against the min config's resolved report names (26 on premium-min).
   - ✅ *(FS)* Sorted sets are **exactly equal**.
   - ℹ️ On an empty result the failure message explains the ordering constraint rather than just diffing.

**Manual repro** — as FCTL-26, reading the `reports:` block. If it comes back empty, the Playwright
suite has already run; re-apply the min config before judging.

**Assessment**
- *Value:* high, and the **most fragile of the five by design** — it is the entry that proves the ordering constraint is being honoured. Its failure is the signal that the nightly chain has drifted out of order.
- *Coverage gaps:* names only; report SQL, platform and interval unchecked. GV-21 covers platform over HTTP.
- *Redundancy:* GV-19..22.
- *Efficiency / smells:* the conditional failure message is doing real work here — without it this failure reads as a `generate-gitops` regression when it is almost always a scheduling problem. Keep that if the entry is ever rewritten.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-29 · generate-gitops › reproduces the applied org name

- **File:** [`playwright/tests/cli/nightly/generate-gitops.spec.ts`](../../tests/cli/nightly/generate-gitops.spec.ts)
- **Grep:** `-g "reproduces the applied org name"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Generate (shared run).
2. ☐ Read generated `org_settings.org_info.org_name`.
   - ✅ *(FS)* **Exactly equals** the min config's `orgName` (`Premium QA Automation (min)` / `Free QA Automation (min)`).

**Manual repro** — `grep -A2 org_info /tmp/gen/default.yml` and compare with the min config's YAML.

**Assessment**
- *Value:* high per millisecond — the cheapest possible proof that the right config was applied to the right instance *and* that scalar org settings survive the generate round-trip. Because the min and baseline configs differ in this string, it also catches "min was never applied", which would make FCTL-26..28 compare against the wrong baseline.
- *Coverage gaps:* one scalar. `contact_url`, feature flags, `server_settings` and the whole `mdm` block round-trip unchecked — and unlike the entity sets, these are cheap to add since they are single values.
- *Redundancy:* GV-01 asserts the same value over HTTP. Direct analogue, different surface.
- *Efficiency / smells:* should probably run **first** in the file — it is the precondition canary for the other four, and its failure explains theirs.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-30 · generate-gitops › emits the tier-appropriate file structure

- **File:** [`playwright/tests/cli/nightly/generate-gitops.spec.ts`](../../tests/cli/nightly/generate-gitops.spec.ts)
- **Grep:** `-g "emits the tier-appropriate file structure"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Generate (shared run).
2. ☐ **Premium branch:**
   - ✅ *(FS)* `fleets/workstations.yml` exists.
   - ✅ *(FS)* `fleets/unassigned.yml` exists.
   - ✅ *(FS)* `fleets/workstations.yml` has a `name` key.
   - ✅ *(FS)* `fleets/workstations.yml` has a `controls` key.
   - ✅ *(FS)* `default.yml` has **no** `controls` key.
3. ☐ **Free branch:**
   - ✅ *(FS)* No `fleets/` files at all.
   - ✅ *(FS)* `default.yml` **has** `controls`.
   - ✅ *(FS)* `default.yml` has **no** `software`.

**Manual repro** — generate on both tiers and run `find /tmp/gen -type f`. Premium yields
`default.yml` plus one file per fleet plus `unassigned.yml`; free yields `default.yml` alone.

**Assessment**
- *Value:* **highest of the five.** The only entry asserting the *structural* tier contract rather than entity names, and it covers three separate licence branches at once (fleets tree, controls scoping, software omission). It is also the structurally correct version of what FCTL-17 and FCTL-25 assert via error strings.
- *Coverage gaps:* checks key *presence*, not contents. Premium `fleets/*.yml` should also carry `software` and `settings` (per the test plan's shape table) and neither is asserted. The other fleets on the instance (`qa`, `vms`) are ignored — correct, since they are not gitops-managed.
- *Redundancy:* deliberately overlaps FCTL-17 and FCTL-25, which run every night in the regular projects while this runs only in the gitops chain. The overlap is the point: the property stays covered in both windows.
- *Efficiency / smells:* the `if (isPremium)` branch means one test declaration behaves as two different tests. Slightly against the suite's explicit-tier-separation preference, but splitting it would duplicate the generate setup for little gain. Judge whether the tier split should be explicit here.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

### FCTL-43 · gitops --dry-run › proposes no deletions against the config it was applied from

- **File:** [`playwright/tests/cli/nightly/gitops-idempotence.spec.ts`](../../tests/cli/nightly/gitops-idempotence.spec.ts)
- **Grep:** `npm run test:gitops-nightly:premium -- -g "proposes no deletions"`
- **Project:** gitops-nightly · **Mode:** CLI

**Flow**

1. ☐ Collect the files the nightly applied for this tier: `default.yml` plus every `fleets/*.yml`
   under `gitops/<tier>-fleetqa-min/`.
2. ☐ `fleetctl gitops --dry-run -f <each>`.
   - ✅ *(CLI)* Exit code is `0`, output contains `gitops dry run succeeded`.
   - ✅ *(CLI)* **No** line starts with `[-] would've deleted`.

**Manual repro** — after a min apply, dry-run the same config. Expect a wall of `[+] would've
applied …` and not a single `[-]`. For contrast, dry-run a `fleetctl new` scaffold against the
same instance and watch 19 label deletions appear — that is FCTL-38.

**Assessment**
- *Value:* high, and it covers something no other entry does: that the apply **fully took**.
  `gitops-verify` (GV-01..22) checks the resulting entities over HTTP; this asks gitops itself
  whether it still sees anything to remove. A partial apply that left extra resources behind
  passes GV's "every gitops X exists" checks and fails here.
- *Coverage gaps:* deletions only. Additions and updates are unassertable, because `--dry-run`
  reports those unconditionally — asserting on them would pin the config's own contents rather
  than the instance.
- *Redundancy:* overlaps GV-07/10/15/18/22 ("no extra X on live"), which make the same claim per
  resource type over the API. This makes it once, through the tool that would actually perform
  the deletion — so it also catches a gitops-side mismatch that the API view cannot see.
- *Efficiency / smells:* less window-sensitive than the FCTL-26..30 group. The Playwright suite
  mostly *deletes* global state, which produces no deletions here, so this tends to pass out of
  window rather than break. What it cannot survive is running while the suite is mid-flight — the
  policy and report CRUD specs create entities the config doesn't declare, and gitops would
  rightly propose removing them. A failure outside the nightly chain is that, not real drift.

**Notes (Andrey)**
```
verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
missing validations:
steps to cut:
other:
```

---

## Area-level observations

Things that are true of the area rather than any one entry — start here if you are deciding where
to spend review time.

1. **The shared `get` entries are smoke tests wearing data-test names.** FCTL-01/02/04 assert only
   that column headers render. That is a defensible scope (data contracts belong to `tests/api/`
   and `gitops-verify`), but the entry names promise more than they deliver. Either rename them or
   give them one real data assertion each. **FCTL-07 (`get carves`) asserts nothing but exit code
   and is the clearest deletion candidate in the area.**
2. **Two renew-date canaries are one line each and currently missing.** FCTL-05 reads the APNs
   cert and FCTL-23's premium counterpart would read ABM; both print a renew date (May 2027 on
   these instances) and neither asserts it is in the future. An expired APNs cert breaks MDM
   enrolment across the whole suite, and nothing else in the suite would catch it early.
3. **Three tier pairs are complete; one is half-built.** 14↔21 (fleets), 16↔24 (JIT), 17↔30
   (controls scoping) each assert both sides. But `get mdm-apple-bm` has only the free denial
   (FCTL-23) with no premium positive — the one asymmetric pair.
4. **Exit-0-on-error is a real product wart, pinned in three places.** FCTL-18/19/20 all assert
   message content because the command returns nil. If Fleet fixes this, all three need updating
   to assert exit 1 — they should not be "fixed" by loosening.
5. **The nightly five are only meaningful in one window.** FCTL-26..30 are correct tests with a
   hard scheduling precondition. The most likely future failure mode is not a bug in them but
   someone moving the job, or the Playwright nightly starting earlier. FCTL-28's failure message
   is the guardrail.
6. **`debug migrations` (FCTL-08) may be in the wrong place entirely.** As a test it is excellent
   value; as a *precondition* it would be better still — a pending migration invalidates the
   entire run, and finding out via one green CLI test among 300 red browser tests is backwards.
7. **Coverage stops well short of the command surface, and the gaps are not all equal.** They
   divide into three groups rather than one:
   - **Worth building next:** `user` (create/delete/`create-users` — cheap, deterministic, and
     it would actually *run* the GitOps-user invocation FCTL-11 only pins as copy) and
     `run-script`. Note osquery-perf really does execute scripts, so one round-trips — assert
     that a *result returned*, never that it exited 0, since the exit code is `rand.Intn(2)`.
   - **Worth building elsewhere:** `package` for the rarely-built types (`pkg.tar.zst`, `rpm`,
     `--arch arm64`), which rot precisely because nobody builds them. Each build pulls from TUF
     and takes minutes, so it wants its own weekly matrix workflow, not the nightly suite.
   - **Deliberately out of scope:** `preview` (boots Docker + MySQL + Redis locally, while every
     project here targets a deployed Fleet), `goquery` (interactive), `updates` (TUF repo
     management), `debug profile/heap/trace` (artifacts, no assertable contract), `setup`
     (one-shot on a fresh instance).

   Still genuinely unexamined: `config` context isolation, `trigger`, `api`, `convert`,
   `upgrade-packs`, and `gitops --dry-run` as a first-class subject. See the test plan's
   [open decisions](../test-plans/fleetctl.md#open-decisions), which also documents why the
   existing `preview` upgrade smoke test cannot pass as written.
