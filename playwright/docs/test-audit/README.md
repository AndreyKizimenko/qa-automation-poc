# Manual test audit — working index

Every automated test in the suite, broken down into the steps a person performs and
the validations the test makes, so each one can be **re-run by hand** and judged:
does it earn its runtime, does it validate the right thing, does it cover the
feature, and does it test through the UI rather than around it.

This is a working document. The per-test `☐` boxes and `Notes (Andrey)` blocks are
meant to be filled in while running the flows; a later pass (agent or human) turns
those notes into spec changes.

Written 2026-07-29 against `main` @ `a420f1c`. Suite at that commit: **113 spec
files · ~350 test declarations · 4 projects**.

> **⚠️ The audit is behind the suite.** As of `main` @ `45ecf28` (2026-09-28) the suite is
> **158 spec files · 549 test declarations · 5 projects · 83 page objects**. The 306 entries
> below still describe the tests they were written against, but roughly 45 specs are newer than
> the audit and have no entry yet. What is missing, and where it belongs, is listed in
> [Not yet audited](#not-yet-audited) at the bottom of this file.

## The area files

| # | Area | Entries | Project(s) |
|---|---|---|---|
| 01 | [Auth & account](01-auth-and-account.md) | 17 | premium, free |
| 02 | [Hosts — shared + free](02-hosts-shared-and-free.md) | 14 | premium, free |
| 03 | [Hosts — premium](03-hosts-premium.md) | 12 | premium |
| 04 | [Policies](04-policies.md) | 22 | premium, free |
| 05 | [Reports / queries](05-reports.md) | 21 | premium, free |
| 06 | [Software library & packages](06-software-library.md) | 15 | premium, free |
| 07 | [Software vulnerabilities, versions & OS](07-software-vulnerabilities-and-os.md) | 15 | premium, free |
| 08 | [Settings › Users — premium](08-users-premium.md) | 31 | premium |
| 09 | [Settings › Users — free + shared](09-users-free-and-shared.md) | 27 | free, both |
| 10 | [Settings — org, integrations, webhooks, secrets](10-settings-org-and-integrations.md) | 11 | premium, free |
| 11 | [Controls — profiles, disk encryption, scripts, variables](11-controls-profiles-scripts-variables.md) | 23 | premium, free |
| 12 | [Controls — setup experience](12-controls-setup-experience.md) | 8 | premium |
| 13 | [Labels, packs, dashboard, paywalls](13-labels-packs-dashboard-paywalls.md) | 21 | premium, free |
| 14 | [API contract specs](14-api-contracts.md) | 22 | premium, free |
| 15 | [API role-access probes](15-api-role-access.md) | 14 | premium, free |
| 16 | [GitOps drift verification](16-gitops-verify.md) | 22 | gitops-verify |
| 17 | [Loadtest / performance](17-loadtest-performance.md) | 11 (per spec file) | loadtest (local only) |
| 18 | [Locator verification vs React source](18-locator-verification.md) | 56 rows (102 locators) | code review, not tests |
| 19 | [`fleetctl` CLI](19-fleetctl-cli.md) | 42 | premium, free, gitops-nightly |

**306 entries** covering every test in the suite. An entry can expand into several
runtime tests — a parameterized loop is documented once, with its variants listed in
the entry header. The widest expansions: area 11 (23 entries → 74 executions), area
17 (11 → 73), area 06 (15 → 56), area 08 (31 → 40), area 13 (21 → 37). Specs under
`tests/e2e/shared/` and `tests/api/` root also run **twice**, once per tier project.

Plus **[FINDINGS.md](FINDINGS.md)** — the cross-cutting analysis: quick wins,
structural bets, and the suite-wide numbers behind them. Read that after a few
areas, not before; the point of the manual pass is to check its conclusions against
what you actually see on screen.

## How to work through it

1. Pick an area file. Work top to bottom — entries are ordered so serial CRUD
   lifecycles read in execution order.
2. For each entry: run the flow **by hand** in the browser against the same
   instance the project targets, following the numbered steps. Tick each `☐` as
   you complete the step and agree with its validations.
3. Where you disagree, write it in that entry's `Notes (Andrey)` block. Keep the
   four labelled lines so a follow-up agent can parse them:

   ```
   verdict:            (keep / trim / expand / rewrite / delete / merge-with-___)
   missing validations:
   steps to cut:
   other:
   ```

4. To watch the automation do the same thing, each entry carries a **Grep** line:

   ```bash
   npm run test:premium -- -g "Policies CRUD (All fleets) › create" --headed
   ```

   Serial CRUD sub-tests need their siblings, so grep the describe title rather
   than one sub-test.

### Reading an entry

- **Steps** are user actions, with button and field labels as rendered. Page-object
  methods are expanded — `policyEdit.saveNew(v)` appears as the modal fills and
  clicks it actually performs, not as a method name.
- **Validations** are tagged `✅ *(UI)*` or `✅ *(API)*`. This split is the whole
  point: an `(API)` validation inside a browser flow is either a deliberate
  record-level contract check or a shortcut around an assertion that should have
  been made on screen. Judge each one.
- **Preconditions / Data created** tell you what the test needs and what it leaves
  behind. Read these before running anything destructive.
- **Assessment** is the auditing agent's opinion — value, coverage gaps,
  redundancy, smells. It is a starting point to argue with, not a conclusion.

### Before you run anything

- **Hosts on the QA instances are osquery-perf simulations** (~300 online, random
  names, not MDM-enrolled). Tests resolve them by platform + status, never by name.
  Simulated hosts can't install software, run scripts, or take MDM commands.
- **A couple of real MDM-enrolled macOS VMs** exist per tier, reached via the
  `liveMacosHost` worker fixture. Entries say which kind they need. Don't delete
  these.
- **Destructive entries** — host delete (03), enroll secrets and team webhooks
  (10) — mutate shared state with real blast radius. Each such entry documents
  what it changes and whether it restores. Read that before clicking.
- `Workstations` is gitops-provisioned. Never create or delete a fleet by hand.

## Conventions in these files

- **IDs** (`POL-04`, `USRP-17`) are stable handles for cross-references and for
  your notes. They are per-area sequences, not global.
- **One entry per `test()` declaration.** A `for (const scope of …)` loop is one
  entry with the scopes named in its header; the runtime-test column above counts
  the expansions.
- Free/premium mirrors are separate entries in different files, cross-linked from
  each other's *Redundancy* line — that duplication is one of the main things this
  audit is meant to price.
- Area 17 is per **spec file** rather than per test: 73 near-identical one-line
  timing measurements would be noise at one entry each.
- Area 18 isn't tests at all — it's the class-based-locator inventory checked
  against Fleet's React components, kept here because it's the other half of
  "are we testing this the way Playwright intends".

## When a note outgrows the box

Some things belong in the repo's existing records rather than in a Notes block:

| What you found | Where it goes |
|---|---|
| A confirmed Fleet product defect blocking a flow | File the Fleet issue, then a row in [../blocked-by-product-bugs.md](../blocked-by-product-bugs.md) + a `TODO(fleetdm/fleet#NNNNN)` on the skip |
| An env-gated or deliberately deferred skip | A row in [../../TODO.md](../../TODO.md) |
| A convention the whole suite should follow | [../../CLAUDE.md](../../CLAUDE.md) |
| A locator fallback that needs justifying | The reviewer skill's sanctioned-fallback list |

---

## Not yet audited

Everything below landed **after** this audit was written and has no entry in the area files yet. Most came in
with QA Wolf round 2 ([PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61), 2026-09-28);
the migration record is in [../qawolf-migration/round-2/](../qawolf-migration/round-2/).

Auditing these means the same treatment as the rest: steps a person performs, validations the test makes, a
`☐` box and a Notes block. They are grouped by the area file they belong in.

### New area — needs its own file

**`20-gitops-mode.md`** — the `gitops-mode` project, which did not exist when this audit was written. It runs
last, single-worker, after the premium project, and disables the mode again in teardown.

| spec | tests |
|---|---:|
| `premium/gitops-mode/01-indicator-and-links` | 3 |
| `premium/gitops-mode/02-gated-surfaces` | 6 |
| `premium/gitops-mode/03-exceptions` | 4 (1 skipped — fleetdm/fleet#48218) |
| `premium/gitops-mode/zz-everything-is-back` | 6 |
| `free/settings/gitops-mode` | 2 |

Worth auditing early: it is the only project whose *teardown* failing is worse than the tests failing — a run
that leaves gitops mode on disables the next run's whole suite.

### Additions to existing area files

| Area file | New specs | Augmented specs |
|---|---|---|
| [02 / 03 Hosts](02-hosts-shared-and-free.md) | `shared/hosts/host-certificates` | `shared/hosts/host-software`, `shared/hosts/host-reports-tab`, `premium/hosts/host-report-details` |
| [04 Policies](04-policies.md) | — | `premium/policies/policy-automations`, `free/policies/policy-automations` |
| [05 Reports](05-reports.md) | — | `premium/reports/reports` (live-report targets) |
| [06 Software library](06-software-library.md) | `shared/software/titles-table`, `premium/software/titles-table`, `role-access`, `fleet-maintained-filters`, `add-software-validation`, `custom-icons`, `display-name`, `version-pinning`, `script-only-package`, `package-scripts` | `library`, `manage-automations-access`, `no-teams-views` |
| [07 Software vulns & OS](07-software-vulnerabilities-and-os.md) | `free/software/os` | `premium/software/os`, `premium/software/vulnerabilities`, `free/software/vulnerabilities` |
| [10 Settings — org](10-settings-org-and-integrations.md) | `shared/settings/organization/custom-logo` | — |
| [13 Labels, packs, dashboard](13-labels-packs-dashboard-paywalls.md) | `shared/dashboard/platform-cards`, `premium/dashboard/fleet-scoped-cards`, `premium/dashboard/historical-data-collection`, `free/dashboard/historical-data-collection` | — |
| [14 API contracts](14-api-contracts.md) | `api/host-software-payload` | `api/premium/max-request-file-sizes` (4 new size boundaries) |
| [19 fleetctl CLI](19-fleetctl-cli.md) | — | `cli/shared/get-read-only` (`--host` now required), `cli/free/licensing` (2 skipped — fleetdm/fleet#53965) |

### Things the audit's own conclusions should absorb

Findings from round 2 that change how existing entries should be judged, not just what to add:

- **The dashboard has no platform cards any more.** Fleet replaced them with the "Hosts enrolled" bar chart
  (`HostsEnrolledCard`, `role="button"` named `"<platform> hosts"`). Any audit entry describing platform cards
  is describing a UI that no longer exists.
- **Built-in platform labels are not assertable on these instances.** The osquery-perf pool answers every
  built-in label query, so the "macOS" label holds ~200 mostly-Ubuntu hosts. Assert the link contract, never
  the rows behind it.
- **`/charts/cve` takes 10–11 seconds idle**, longer than the suite's 10s assertion timeout. Any spec asserting
  that dataset must wait on the response first.
- **Playwright aborts a timed-out test before its `finally` runs.** Cleanup that must survive a timeout needs
  an `afterEach` as well as the in-test `finally`.
- **Never deploy a passcode profile to a real host** — see `../../CLAUDE.md` → Test hosts. The
  `fleet-test-passcode.mobileconfig` fixture is safe only in the library lifecycle that never reaches a host.
