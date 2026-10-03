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

> **Brought current 2026-09-28** against `main` @ `45ecf28`: **158 spec files · 549 test
> declarations · 5 projects · 83 page objects**. The QA Wolf round-2 specs (batches A–C and the
> new `gitops-mode` project) are audited — see area **20** and the round-2 additions throughout.
> The migration record is in [../qawolf-migration/round-2/](../qawolf-migration/round-2/).
>
> **Batch D added 2026-09-28** (`playwright/qawolf-round2-batch-d`): **167 spec files · ~573 test
> declarations · 7 projects · 90 page objects**. Execution on the real VMs — scripts, MDM commands,
> software install / uninstall / update, batch runs — is audited in areas **02**, **11**, **14** and the new
> area **21**.
>
> **Area 21 restructured 2026-09-28** (`playwright/vms-durable-fixtures`): the install and uninstall loops
> and the catalog-add FMA install (SWH-01/02/04, now retired stubs) became one test per durable VMs-fleet
> fixture, SWH-14 in `software-lifecycle-on-host.spec.ts` — 6 spec files, 18 runtime tests in the area.

> **Batch E added 2026-09-29** (`playwright/qawolf-round2-batch-e`): label targeting — which hosts a profile,
> declaration, software title, policy or report reaches — is audited in the new area **22** (LT-01…09), and
> profile delivery, OS updates and the free delivery spec in area **11** (CTL-27…34). The profile lifecycle
> entries (CTL-01…05, 15…18) moved onto inert fixtures: on free, those uploads reach the real VMs.

> **Batch F added 2026-09-29** (`playwright/qawolf-round2-batch-f`): a host's IdP username (area **03** HOSTP-13…15,
> free **02** HOST-24, free API refusal **14** API-31); Recovery Lock on the real Mac (**03** HOSTP-16); a team admin's own-fleet scope and the Fleet MFA form rules (**08** USRP-32…34, free API refusal **14** API-32).
> Updated: HOSTP-04 (technician), USRF-05/09 (no MFA checkbox on free), MISC-20 (card headings, Host names row).

> **Batch G (retries half) added 2026-10-01** (`playwright/qawolf-round2-batch-g`): a policy's own automations modal
> — Install software, Run script and Continuous saved from the row, and free's webhook-only twin (area **04**
> POL-25…26); patch policies for Fleet-maintained apps, every option's stored flags (area **06** SWL-33…34); on the
> Ubuntu VM, a policy's failing script tried 3 times and re-run by continuous automations (**04** POL-27), and a
> Deploy whose install fails, tried 3 times (**21** SWH-15).

> **Round 3 batch B added 2026-10-02** (`playwright/qawolf-round3-batch-b`): area **04** POL-09/10 rewritten
> as the failing-policies webhook's whole life (enabled, sent for one policy, turned off), and POL-19/20 as a policy with
> a syntax error saved and reopened. Added POL-28…32: Ticket with no integration on both tiers, a fleet's own webhook on
> a throwaway fleet, fleet isolation, and AI Autofill's live call to fleetdm.com on both tiers.
> Area **05**: the Reports CRUD turns automations on at create and off at edit (RPT-01/03/14/16); RPT-06 saves its
> broken SQL and reopens it, RPT-07 reads the Save report modal's defaults, and RPT-08/19 turn automations on and off
> again with the list's cell read in between. Added RPT-23…28: free twins of RPT-06/07, Save as new into another fleet,
> the edit form's "Save changes?" warnings on both tiers, and stored results from the real macOS VM, for the
> long-standing gitops report and a new one (the org-wide *Store report results* toggle stays untested by decision).
> Area **06**: SWL-31 adds its package with a pre-install query and post-install script from the add form; SWL-36 edits
> all four Advanced options and reads them back. Area **07**: SWV-08/15 turn the vulnerability automation off again.
> Area **11**: CTL-13/14 move to `shared/` (free gains them), and CTL-35/36 add a script refused until its variable
> exists and a variable refused deletion while a script uses it.

> **Round 3 batch C added 2026-10-03** (`playwright/qawolf-round3-batch-c`): what Fleet decides server-side, over
> simulations. Area **04**: POL-33 (a policy saved for macOS only runs on macOS hosts, both tiers), POL-34 (a host's
> policy → the hosts that gave the same answer, both answers, both tiers) and POL-35 (the policies list's Pass / Fail
> links on premium).

## The area files

| # | Area | Entries | Project(s) |
|---|---|---|---|
| 01 | [Auth & account](01-auth-and-account.md) | 19 | premium, free |
| 02 | [Hosts — shared + free](02-hosts-shared-and-free.md) | 24 | premium, free |
| 03 | [Hosts — premium](03-hosts-premium.md) | 16 | premium |
| 04 | [Policies](04-policies.md) | 35 | premium, free |
| 05 | [Reports / queries](05-reports.md) | 28 | premium, free |
| 06 | [Software library & packages](06-software-library.md) | 36 | premium, free |
| 07 | [Software vulnerabilities, versions & OS](07-software-vulnerabilities-and-os.md) | 22 | premium, free |
| 08 | [Settings › Users — premium](08-users-premium.md) | 34 | premium |
| 09 | [Settings › Users — free + shared](09-users-free-and-shared.md) | 28 | free, both |
| 10 | [Settings — org, integrations, webhooks, secrets](10-settings-org-and-integrations.md) | 15 | premium, free |
| 11 | [Controls — profiles, disk encryption, scripts, variables](11-controls-profiles-scripts-variables.md) | 36 | premium, free |
| 12 | [Controls — setup experience](12-controls-setup-experience.md) | 8 | premium |
| 13 | [Labels, packs, dashboard, paywalls](13-labels-packs-dashboard-paywalls.md) | 30 | premium, free |
| 14 | [API contract specs](14-api-contracts.md) | 32 | premium, free |
| 15 | [API role-access probes](15-api-role-access.md) | 14 | premium, free |
| 16 | [GitOps drift verification](16-gitops-verify.md) | 22 | gitops-verify |
| 17 | [Loadtest / performance](17-loadtest-performance.md) | 12 (per spec file) | loadtest + loadtest-api (local only) |
| 18 | [Locator verification vs React source](18-locator-verification.md) | 56 rows (102 locators) | code review, not tests |
| 19 | [`fleetctl` CLI](19-fleetctl-cli.md) | 43 | premium, free, gitops-nightly |
| 20 | [GitOps mode](20-gitops-mode.md) | 21 | gitops-mode, free |
| 21 | [Software on hosts](21-software-on-hosts.md) | 12 (+ 3 retired stubs) | premium |
| 22 | [Label targeting](22-label-targeting.md) | 9 | premium |

**496 entries** covering every test in the suite. An entry can expand into several
runtime tests — a parameterized loop is documented once, with its variants listed in
the entry header. The widest expansions: area 06 (36 entries → 87 executions), area 11 (36 → 92), area
17 (11 → 73), area 08 (34 → 43), area 13 (29 → 48). Specs under
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

- **Most hosts on the QA instances are osquery-perf simulations** (~300 online, random
  names, ~30% of them MDM-enrolled). Tests resolve them by platform + status, never by name.
  Simulated hosts can't install software, run scripts, or take MDM commands.
- **Three real VMs per tier — macOS, Windows 11 and Ubuntu, all ARM** — on the **VMs**
  fleet on premium and in Unassigned on free. Tests reach them with
  `findOnlineHost(…, { kind: 'real' })`, which keys on hardware model (`VirtualMac` /
  QEMU), not MDM enrollment; `liveMacosHost` is the macOS one. Entries say which kind
  they need. Don't delete these, and install nothing on them but the suite's inert
  fixtures (area 21 lists them).
- **The VMs fleet is under gitops** (`gitops/premium-fleetqa/fleets/vms.yml`, applied by the
  nightly before every premium run, in both the baseline and the min pass): it keeps Claude
  installed on the macOS and Windows VMs, holds the `pw-host-report-results` report, and
  declares the **durable install/uninstall fixtures** — an inert `.pkg`, `.msi` and `.deb`,
  7-Zip's `.exe`, and the Fleet-maintained Itsycal and DB Browser for SQLite. Leave Claude
  installed and every fixture **uninstalled**, and never delete any of their titles; a
  fixture left installed is uninstalled by the next run's preflight.
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

## Things the audit's own conclusions should absorb

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
- **Never deploy a passcode profile to a real host** — see `../../CLAUDE.md` → Test hosts. **Uploading a
  profile is delivering it**: on free, Unassigned holds the real VMs, so even the library lifecycle reaches
  them. The suite's only profile fixtures are the inert `fleet-pw-inert.{mobileconfig,xml}`.
- **`software_updated_at` only moves when a host's inventory *changes*.** It is not "last collected": after a
  failed uninstall, or any collection that finds nothing new, it stays put. A wait for a fresh inventory has to
  baseline `detail_updated_at` and refetch — what `waitForHostRefetch` / `waitForSoftwareSettled` do. Any entry
  that judges freshness by the software timestamp is judging the wrong clock.
- **A failed install is retried three times** (`MaxSoftwareInstallAttempts`), reporting `pending_install` between
  attempts, so "Failed" sticks only ~6 minutes after the click.
- **Global switches that break neighbours run alone.** Specs under `tests/e2e/*/exclusive/` run in the
  `premium-exclusive` / `free-exclusive` projects, on one worker after the main project — turning script
  execution off makes Fleet refuse and hold every script. `npm run test:<tier>` includes them.
- **`cleanup-setup` now reaches past Unassigned and Workstations**, narrowly: it clears stranded version pins on
  the QA and VMs fleets and deletes the host-execution specs' per-run `fleet-pw-*` / `pw-*` leftovers from VMs.
  Deleting a title never uninstalls it, so the sweep also purges any `fleet-pw-*` package the Ubuntu VM still
  lists (one ad-hoc `dpkg --purge` script, queued only when there is one). The install/uninstall fixtures are
  **durable** — declared in `vms.yml`, re-applied every night, never deleted by a test — and a separate
  **resting-state preflight** (both tiers, start and end of every run) puts the real VMs back: script execution
  on, no `script_execution_timeout` override, the suite's own queued items cancelled, and on premium every
  durable fixture uninstalled. An entry that assumes a dead run leaves a fixture installed for the next run is
  judging a hazard the preflight now removes.
- **The premium nightly is ~40 min** at CI's two workers (from ~15 before batch D), against a 120-min job limit.
  In CI Playwright stops the run at 100 min (`globalTimeout`) and still writes the report. An entry whose verdict is "expand" on a VM-bound spec should price the minutes.
