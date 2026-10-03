# Round 3 — the gaps

The last round of the QA Wolf migration. Rounds 1 and 2 ported the flows. A flow-by-flow audit on 2026-10-01
found **154 behaviours those flows verified that no test here asserts**, in full or in part: 141 from round 1
(whose "250 portable, 250 covered" didn't hold) and 13 from round 2. Round 3 closes them, or cuts them with a
reason. **141 gaps go to 8 batches; 13 were triaged out.**

| | |
|---|---|
| **what we're building** | the batch files, [A](A-settings-users-labels.md) → [H](H-gitops-mode-v2.md) |
| **what happens to one specific gap** | [INDEX.md](INDEX.md) |
| **why 13 gaps aren't being built** | [TRIAGE.md](TRIAGE.md) |
| **how the gaps were found, and the numbers** | [INTAKE-AUDIT.md](INTAKE-AUDIT.md) |
| **the rules every batch inherits** | [`../round-2/README.md`](../round-2/README.md) §5, §6, §9 — still current — and `playwright/CLAUDE.md` |

---

## 1. The goal

Same as rounds 1 and 2: **don't lose coverage when QA Wolf goes away.** Every behaviour their suite verified
must still be verified here — or be cut on purpose, with the reason written down. Round 3 adds no new scope:
each row of the [INDEX](INDEX.md) is a QA Wolf flow's behaviour that the earlier rounds meant to cover and didn't.

**Not every gap deserves a test.** The audit was strict — a missing "Learn more" link check counts as *partial*.
So every batch starts with a **review** ([§4](#4-how-a-batch-runs)): read the flow's body, decide **build / fold
into an existing spec / cut / long-term**, and write the decision down. Round 2's reviews turned several plans
around (a "platform policy" flow that never set a platform; a retry plan that would have made 1 + 3 attempts);
round 3's gaps are older and less examined, so expect more of that.

## 2. Where the gaps come from

Three read-only audits checked every row of round 1's disposition tables (`../audit/C1`–`C10`, 267 flows) and
round 2's index (127 flows) against the tests on 2026-10-01, and the findings were spot-checked by hand. The
pattern behind round 1's gaps:

- **Planned specs that were never written** — the audit tables name proposed paths (`free/policies/role-permissions.spec.ts`,
  `…/os-specific-policy.spec.ts`, `…/links-to-hosts.spec.ts`, `policy-automation-run-script.spec.ts`) that don't
  exist, and their behaviours went nowhere.
- **Role variants collapsed into API probes.** `tests/api/role-access/**` proves allow and deny at the API; what
  each role is *shown* in the UI was never asserted for policies, reports, host details or the Hosts list. That's
  batch E's whole job.
- **Depth dropped on the way in** — a save that's never saved, a toggle never flipped back, a filter whose
  results are never read.

Round 2 came through well: no flow missing, ten partial. Seven are mostly hand-offs between batches that the
receiving batch never picked up; three were accepted as partial at the time.

## 3. The batches

Ordered by setup, as in round 2: no hosts first, real VMs and gitops mode last. Each batch file has a **▶ Start
here** block, the gap table, the review to do first, facts for the build, the decisions to put to Andrey, and
*Done when*.

| batch | theme | hosts | gaps | status |
|---|---|---|---:|---|
| **[A](A-settings-users-labels.md)** | Settings, users, labels, account — forms with nothing behind them | none | 19 | **merged** 2026-10-03: 16 built, 3 cut; [PR #81](https://github.com/AndreyKizimenko/qa-automation-poc/pull/81), shipped in [PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82) |
| **[B](B-policy-report-software-forms.md)** | Policy, report and software forms: automations, saves, report settings, Advanced options, secrets in scripts | none (one macOS VM check) | 24 | **merged** 2026-10-03: 22 built, 2 cut; [PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82) (with batch A); branch run [37077445852](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37077445852) green, 0 flaky |
| **[C](C-simulations.md)** | What Fleet decides server-side, over simulations: policy ↔ hosts links, transfers, label membership, vulnerability filters, Unassigned views | simulations | 23 | **built** 2026-10-03: 19 kept, 4 cut; [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86), ready for its branch run |
| **[D](D-batch-scripts.md)** | Batch scripts: schedule, cancel, cancel-on-edit, preview, counts | simulations | 9 | ready for review |
| **[E](E-role-visibility.md)** | Role-based UI visibility — one role matrix per area instead of ~40 role flows | static users | 41 | ready for review |
| **[F](F-mdm-setup-android.md)** | MDM, setup experience and Android settings, saved and read back | Workstations | 10 | ready for review |
| **[G](G-real-vms.md)** | Real VMs: live policies and reports, CSV export, side effects of installs and MDM commands, a host's Library | real VMs | 10 | ready for review |
| **[H](H-gitops-mode-v2.md)** | gitops mode V2 — round 2's parked list | own project | 5 | ready for review |

A–D need nothing that doesn't exist; E's per-role source read is done, so it's a design job; F works on
Workstations, so nothing is delivered; G is the only batch that costs VM minutes, and H runs in its own project.
Every batch file lists the decisions to put to Andrey **before** building: 25 across the round, most of them "cut,
or build it this narrow way". Batches touch different surfaces and can run in any order. **Two can be built at once**, each
in its own worktree, **only if their instance runs are coordinated** (§5, "Since batches A and B"): every run
announced, and no run with dependencies while the other session is mid-run.

## 4. How a batch runs

Round 2's process ([`../round-2/README.md`](../round-2/README.md) §7 and §9) unchanged, with the review made
explicit:

1. **Invoke the skills — don't wait for them to trigger.** `playwright-test-author` before writing anything;
   `playwright-test-reviewer` on your own work before the PR; `playwright-run-reviewer` on a red run;
   `/fleet-bug-file` only once Andrey has said a finding is a Fleet bug (search first).
2. **Review before building.** For every gap: open the flow body (`qa-wolf/flows-{Free,Premium}/<file>` for round 1;
   `qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` for round 2), open the existing spec the INDEX
   names, read the React component and the server code the behaviour rests on, and probe the live page. Write the
   decision into the batch file's review table (*build / fold / cut / long-term*, with the reason), and put the
   batch's open questions to Andrey **before** building. This is where most of round 2's value came from.
3. **Build in slices** — page objects first, one concern per commit, docs in the same commit (round 2 §9's
   table: the batch's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, the
   [test-audit](../../test-audit/README.md) entry per `test()`, helper and page-object READMEs).
4. **Verify scoped**: each spec you change, on every tier it targets — once with dependencies, once headed,
   `--repeat-each=5` for anything timing-sensitive, `--workers=2` on anything touching the real VMs,
   `--output=<scratchpad>/<run>`. `gh run list --limit 5` first; never overlap the nightly.
5. **Open the PR and tell Andrey it's ready.** He dispatches `QA — Branch run` himself. If your PR changes a
   workflow file, ask him to dispatch with `--ref <your branch>`: without it the run uses `main`'s workflow YAML
   (only the tests come from `-f branch=`).
6. **Update this README's batch table and the [INDEX](INDEX.md)** when the batch lands (status, and any gap
   whose kind changed at the review).

## 5. Rules that changed since round 2

Round 2's §5 (never lock a VM; uploading a profile is delivering it), §6 (standing rules) and §9 (how much to
run, which docs move, the VMs as they are) still hold. New since round 2's README was written. The first
three arrived with batch G ([PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78)), and
`CLAUDE.md` carries them; **branch from `main` at or after da2aceb** (batches A and B, below):

- **A failed install *script* stalls orbit on that VM for up to 5 minutes** — its config loop backs off 1, 2, 4,
  then 5 min, delaying every install and script queued there (filed as
  [fleetdm/fleet#54607](https://github.com/fleetdm/fleet/issues/54607)). Make an install fail with a **pre-install
  query that returns no rows** (`preInstallQuery` on `uploadSoftwarePackageBuffer`), which stops before the script
  and doesn't trigger it. A spec whose point is the script failure goes in `exclusive/`.
- **Fleet runs a policy automation's scripts and installs at priority 0**, below every user-requested activity,
  and picks a host's next activity by priority before age. Beside the install specs, an automation's retries
  starve — so `policy-automation-runs` and `deploy-install-retries` run in `premium-exclusive`.
- **`exclusive/` also holds specs that need a real VM's queue to themselves**, not only ones that flip a global
  switch. Its CI step has a 60-min global timeout; keep it under that.
- **A timed-out test skips its `finally`.** Anything whose leftover would keep acting — a continuous automation, a
  setting on the VMs fleet — is removed in an **`afterEach`**, which still runs.
- **`findOnlineHost(…, { kind: 'real' })` takes the first VM of a platform**, by name. There is one per platform;
  a second would sit idle until specs are spread across VMs (deferred, 2026-10-01).
- **Another session may share your checkout.** Stage by file — or by hunk, building the index blob from `HEAD` —
  never `git add -A`; or work in a `git worktree`.
- **Probe the UI with a local script** that loads `.auth/<tier>-admin.json` into Playwright, not the MCP browser's
  `browser_run_code_unsafe`, which echoes the code it runs — a session cookie included.
- **The round-1 source flows are in `qa-wolf/flows-Free/` (52) and `qa-wolf/flows-Premium/` (217)**, untracked,
  not at the repo root as older docs say.
- **What a simulation answers** (corrected in `playwright/CLAUDE.md` with PR #78; it used to say "no rows ~20% of
  runs" and "never install anything"). Our perf daemons run with `--live_query_no_results_prob 0`, so a simulation
  always answers a live query, with the same canned row whatever the SQL (checked live 2026-10-02: 12 of 12
  answered a `WHERE 1 = 0` query with a row), and every simulation **passes** a live policy. The ~half that
  simulate orbit **do** report script runs and installs (exit 0 or 1 at random, within ~35 s), though nothing lands
  on a disk. Simulations also pass every scheduled policy except `SELECT 0;`. Batches C, D and G spell out what
  that means for them.

### Since batches A and B (2026-10-03)

A and B were built in parallel by two sessions and shipped together in
[PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82). **Branch from `main` at or after da2aceb.**
Their suite-wide rules are in `playwright/CLAUDE.md` and the `playwright-test-author` skill. Each later batch's
▶ Start here block names the ones that apply to it. In short:

- **Verify the plan's facts before building on them.** B's plan proposed a confirmation for *Store report
  results* that doesn't exist, said a helper took a file path when it took content, and pointed at a page anchor
  4.93 had renamed. Each batch file's facts were checked on 2026-10-03, but the review step is where the rest are
  caught.
- **Parallel batches coordinate their instance runs.**
  - Each session works in its own `git worktree` (`.claude/worktrees/<batch>`).
  - Before each run it messages the other session (`SendMessage`): "about to run <specs> on <tier>, ~N min", then
    "done". Reply "busy" if you're mid-run.
  - A run **with dependencies** waits for an explicit "go": its `cleanup-setup` wipes every global report and policy
    and Unassigned's scripts, packages and profiles.
- **One branch run for two PRs:** merge one batch's branch into the other's. The conflicts are only in shared
  docs (DELIVERY-LOG, the test-audit README totals, this README and the INDEX). Recount the audit totals from the
  area files, and renumber an audit ID both batches claimed. Have the other batch's session diff its files in the
  merge against its last commit before the run.
- **Global config written from two files races.** A serial describe serialises only within its file. Org settings
  › Advanced's Save posts several subtrees as loaded (listed in the author skill); no main-project spec writes them.
- **Restore in an `afterEach`, keyed to the test that changed something.** A timed-out test skips its `finally`.
- **Logins are throttled** (10 a minute, one bucket): `withStaticUser`'s cached sessions in the browser, `apiLogin`
  for API logins.
- **Throwaway fleets are allowed** when named `pw-*`, deleted in the test and in an `afterEach` that finds the
  fleet by name. Cleanup sweeps them on premium. `pw-*` labels are swept on premium only; on free a spec deletes
  its own.
- **UI traps that cost a run:**
  - A second save's toast can be the first one's, so poll the API instead.
  - The report edit form refills itself after *Edit report*.
  - A column index read from a re-rendered header points at the wrong cell.
  - An absence check on a menu that never opened passes.
- **Decisions Andrey made in A and B that later batches inherit:**
  - The org-wide *Store report results* setting is never toggled.
  - Throwaway `pw-*` fleets are approved.
  - AI Autofill is tested against the live service.

## 6. Decisions round 3 already carries

- **Infrastructure-gated coverage is not round 3's.** Fedora / RHEL / Arch hosts, iOS / Android devices, a
  readable mailbox, a certificate authority: [`../../long-term-goals.md`](../../long-term-goals.md). (Premium's
  ABM connection works, so setup-assistant validation is in batch F.)
- **A second VM per platform is deferred** (Andrey, 2026-10-01): batches use the one real VM per platform.
- **Six Fleet bugs were filed from the planning** (2026-10-02):
  [#54619](https://github.com/fleetdm/fleet/issues/54619) (a fleet's webhook saves wipe each other, batch B),
  [#54620](https://github.com/fleetdm/fleet/issues/54620) ("Various", A),
  [#54621](https://github.com/fleetdm/fleet/issues/54621) ("No team" copy, B), and
  [#54622](https://github.com/fleetdm/fleet/issues/54622), [#54623](https://github.com/fleetdm/fleet/issues/54623),
  [#54624](https://github.com/fleetdm/fleet/issues/54624) (role gating, E). A test that hits one asserts the
  intended behaviour and skips with the bug's `TODO`, plus a `blocked-by-product-bugs.md` row.
- **Role coverage is a matrix, not a flow per role** (batch E): one spec per area with the role as a dimension,
  the way `host-delete` and `manage-automations-access` already do it.
