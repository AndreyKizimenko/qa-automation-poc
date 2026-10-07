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
| **[C](C-simulations.md)** | What Fleet decides server-side, over simulations: policy ↔ hosts links, transfers, label membership, vulnerability filters, Unassigned views | simulations | 23 | **merged** 2026-10-04: 19 kept, 4 cut; [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86) (with batch D); branch run [37149323584](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37149323584) green, C's tests all first-time passes |
| **[D](D-batch-scripts.md)** | Batch scripts: schedule, cancel, cancel-on-edit, preview, counts | simulations | 9 | **merged** 2026-10-04: 4 built, 3 folded, 2 cut; [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86) (with batch C); its 2 flaky retries in the branch run fixed; filed [fleetdm/fleet#54732](https://github.com/fleetdm/fleet/issues/54732) and [#54734](https://github.com/fleetdm/fleet/issues/54734) |
| **[E](E-role-visibility.md)** | Role-based UI visibility — one role matrix per area instead of ~40 role flows | static users | 41 | **merged** 2026-10-07: 23 built, 11 folded, 7 cut, all recommendations accepted; shipped with batch F in [PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89); branch run [37395809242](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37395809242) green, no E or F test retried |
| **[F](F-mdm-setup-android.md)** | MDM, setup experience and Android settings, saved and read back | Workstations, throwaway `pw-*` fleets | 10 | **merged** 2026-10-07: 8 built or folded, 2 cut; filed [fleetdm/fleet#54845](https://github.com/fleetdm/fleet/issues/54845); [PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89) (with batch E); branch run [37395809242](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37395809242) green, no E or F test retried |
| **[G](G-real-vms.md)** | Real VMs: live policies and reports, CSV export, side effects of installs and MDM commands, a host's Library | real VMs | 10 | **built** 2026-10-07: 6 built, 3 folded, 1 cut (C4 #P14), all recommendations accepted; ships with batch H in one PR |
| **[H](H-gitops-mode-v2.md)** | gitops mode V2 — round 2's parked list | own project | 5 | **built** 2026-10-07: 7 tests, every recommendation accepted (the BitLocker PIN and most of the breadth row cut); the gitops-mode exceptions pinned before every premium apply; ships with batch G in one PR |

A–D need nothing that doesn't exist; E's per-role source read is done, so it's a design job; F works on
Workstations, so nothing is delivered; G is the only batch that costs VM minutes, and H runs in its own project.
Every batch file lists the decisions to put to Andrey **before** building: 25 across the round, most of them "cut,
or build it this narrow way". Batches touch different surfaces and can run in any order. **Two can be built at once**, each
in its own worktree, **only if their instance runs are coordinated** (§5, "Since batches A and B"; C and D, then E
and F, built that way, are the model): every run announced, and no run with dependencies while the other session is
mid-run. They ship in one PR with one branch run (§5, "Since batch F").

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

### Since batches C and D (2026-10-05)

C and D were built in parallel and shipped together in
[PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86) (D built on C's branch, so one branch run
covered both); [PR #87](https://github.com/AndreyKizimenko/qa-automation-poc/pull/87) followed. **Branch from
`main` at or after 61db6b0.** Each later batch's ▶ Start here block names the ones that apply to it. In short:

- **The Hosts page rewrites its own URL.** It replaces the URL from the filters its table last queried with, so a
  filter or search chosen just after the page loads can be silently undone (C lost a label filter; D's scale test
  lost both its filters, and *Select all matching* took all 200 hosts on Unassigned). Use
  `HostsListPage.searchFor`, `HostsListPage.filterTo` and `LabelFilter.selectLabel`, which remake a choice until
  the settled table's URL still carries it, never a bare `search.fill` or filter click.
- **Built-in platform labels hold the wrong hosts.** osquery-perf answers their queries, and on both instances the
  built-in **macOS** label holds the *Ubuntu* simulations. Pick hosts by their `platform` field, never by
  built-in-label membership. `batch-run`'s scale test batches every online macOS-label member on Unassigned:
  moving Linux simulations off Unassigned shrinks its pool (it needs 50+), and a script or install run now on a
  Linux simulation there can queue behind its batch.
- **Offline simulations are a pool of their own.** Each tier holds ~300, yesterday's set, deleted by host expiry a
  day later; no picker reads them. `findOfflineSimulations` stages dozens of hosts to *move* (not to answer
  anything), as `bulk-transfer` does.
- **More slices are claimed** (`findSimulations`, registry in `helpers/api/hosts.ts`): linux 2–7 (C) and 10–19
  (D), darwin 6 (C) and 10–39 (D), windows 2 (C). The darwin pool past the 40-host skip ends around offset 35.
- **Two script-queue bugs, both reachable on real hosts** (filed by D):
  [fleetdm/fleet#54732](https://github.com/fleetdm/fleet/issues/54732): an edit while a host's run is still
  *queued* behind another activity leaves that host Pending forever, and the batch never finishes;
  [fleetdm/fleet#54734](https://github.com/fleetdm/fleet/issues/54734): a run cancelled or edited while a host is
  *running* it still records its result, and the host then shows under no tab. A test that edits or cancels
  scripts needs hosts with nothing queued, and must not compare counts read before a running host reports.
- **Simulations really "run" scripts**, about half of them (orbit): a random exit code within ~35 s. Batch scripts
  have no license check, so free has them too.
- **A dashboard activity check at the end of a long test can be buried** under the other workers' activity past
  the feed walk's 15 pages (D's VM test flaked on it). Check the feed right after the action, or through the API
  (`assertActivity`).
- **Real-VM pickers say why a VM is missing** (PR #87): offline since when, or not MDM-enrolled;
  `listOnlineHosts` throws on an API error instead of returning nothing. The real Macs went offline on both tiers
  in the 2026-10-05 nightly (32 failures, infra): read that message before blaming a spec.
- **Run cost:** the C+D branch run took premium 61.8 min (main project 45.6) against 58.8 for A+B, and free 15.8
  against 12.8. Premium is worker-bound; every new wait adds to it.
- **Decisions Andrey made in C and D that later batches inherit:**
  - Free coverage on simulations is fine wherever hosts are picked by id: on free the real VMs sit in Unassigned,
    so never select by filter there.
  - A confirmed Fleet bug a test steers around gets a `TODO(fleetdm/fleet#N)` and a row under *Worked around in
    the suite* in `docs/blocked-by-product-bugs.md`.

### Since batch E (2026-10-05)

E was built beside F and ships with it. What later batches inherit:

- **A static user's cached session can be signed out in the browser** while Fleet still accepts its token: the
  cookie expires first. `withStaticUser` now treats an expired cookie as a dead session. If role specs land on
  `/login` locally, an old `.auth/static-*` cache was the cause.
- **`LabelFilter.selectLabel` types a label's name only up to its first space.** A space in an open react-select
  menu chooses the focused option, so a gitops label like "Debian-based Linux hosts" picked another label.
- **An empty fleet's Hosts page repeats "Add hosts"** in its empty-state card; `HostsListPage.goto({ mayBeEmpty })`
  anchors on Export hosts, which renders either way.
- **`cleanup-setup` sweeps spec-saved Workstations reports by exact prefix** (`pw-role-`,
  `Copy of playwright-saveasnew-`); gitops's reports there stay. A new per-run report on Workstations adds its prefix.
- **Workstations holds three of its five gitops reports between runs, by design.** Every gitops chain (nightly and
  branch run) ends on the **min** config, which declares "3 of 5" and drops "Collect XProtect reports" and "Detect if
  Apple Intelligence is enabled" (`gitops/premium-fleetqa-min/fleets/workstations.yml:55`). Read "Collect default
  browser on macOS", which both configs declare and the role specs check for first.
- **A skipped check on a filed bug is run un-skipped once** to see it fail for the filed reason before it's skipped
  (E's #54622, #54623, #54624).

### Since batch F (2026-10-07)

F was built beside E, and the two shipped together in
[PR #89](https://github.com/AndreyKizimenko/qa-automation-poc/pull/89) (branch run
[37395809242](https://github.com/AndreyKizimenko/qa-automation-poc/actions/runs/37395809242) green);
[PR #90](https://github.com/AndreyKizimenko/qa-automation-poc/pull/90) followed. **Branch from `main` at or after
68c8846.** What later batches inherit:

- **The instances run `4.93.0-rc` 8d05209 (built 2026-10-06)**, five commits past c87f85c. None touches a file G or H
  cites; two change what the suite can read:
  - A stored report result that hasn't changed is no longer rewritten: its `last_fetched` moves only once it's 50
    minutes old (fleetdm/fleet#54897; PR #90 widened `stored-results.spec.ts`' bound). Requests over
    `osquery_max_concurrent_query_report_writes` (20) skip storing altogether.
  - `fleetctl gitops` skips unchanged scripts and software, and no longer blocks queued script runs and installs.
- **An uncaught page error owed to a filed, cosmetic Fleet defect** goes in `DEFAULT_IGNORED_PAGE_ERRORS`
  (`helpers/console.ts`) with its `TODO(fleetdm/fleet#N)` and a row under *Ignored console errors* in
  `blocked-by-product-bugs.md`, never `pageHealth.disable()`. Its one entry, `worker-json.js`, is
  [fleetdm/fleet#54845](https://github.com/fleetdm/fleet/issues/54845): Fleet doesn't serve Ace's JSON or XML
  worker, so an app's Edit configuration modal throws in its worker.
- **A throwaway `pw-*` fleet is scoped by URL** (`<page>.goto({ fleetId })`, then check the dropdown reads its
  name), not picked with `TeamDropdown.selectByLabel`. `deleteFleet` deletes the fleet's bootstrap package first:
  a fleet delete leaves it behind.
- **Root a `filter({ has })` locator at the page.** One built from a scoped locator (`section.getByRole(…)`) looks
  for that scope inside each candidate, matches nothing, and the click waits out the test's timeout.
- **Key an activity check to what this test did** when the other scope's copy of the test, another spec or an
  earlier run can log the same type: `latestActivityId` before the action, then `assertActivityAfter` matching the
  fleet (`fleet_id`) and the content. Fleet records a JSON detail with its keys in its own order, so compare fields,
  never `JSON.stringify`.
- **`organization-info.spec.ts` renames the organization for a few seconds** on both tiers. A spec that compares
  the page's org name with the config re-reads both until they agree, as `shared/settings/apple-mdm.spec.ts` does.
- **Run cost after E and F** (37395809242): the premium job 63.5 min, its main project 47.3 at 3 workers (+1.7 on C
  and D), still worker-bound to the last minute; free 14.5. Four retries, none in E or F: an FMA installer
  download that 504'd (`apparency`) and a Users list slow for ~20 s.
- **Two batches, one PR**, as E and F did it: the batch that finishes last merges the other's branch into its own
  and resolves the shared-doc conflicts (recount the audit totals from the area files' Contents tables); the other
  session diffs its own files in the merge before the push; fixes after the merge come as a branch off the merge
  commit, so the PR branch keeps one writer.
- **Triaging a branch run:** if `gh run download` or `gh run watch` stalls (both did on 2026-10-06, while the API
  answered instantly), fetch each report's zip with `curl -L -H "Authorization: Bearer $(gh auth token)"` from
  `https://api.github.com/repos/<repo>/actions/artifacts/<id>/zip`, and poll `gh run view <id> --json status`.
- **Decisions Andrey made in F that later batches inherit:** a gap whose action Fleet can't undo (an Android web
  app is created and never deleted) is cut, not pinned as a durable fixture; tooltip copy alone isn't worth a test.

### Since batch G (2026-10-07)

G was built beside H, and the two ship in one PR. What later work inherits:

- **The three real VMs' names mix case on both tiers** (`WIN-…`, `macos-…`, `ubuntu-…`), so a table sorted on them
  tells a case-insensitive sort from a case-sensitive one without simulations. A spec that relies on it checks the
  two orders differ first, so a renamed VM fails loudly.
- **Target live runs by host search** (`ReportLivePage.targetHost`): the three VMs answer, nothing is moved, and
  nothing is left to clean up. A run started in the UI has no timeout; it ends when every online target answers.
- **A policy's live run** has its own page object, `PolicyLivePage` (a `ReportLivePage` of the policy kind, plus the
  Yes / No summary); both export their results, read with `helpers/csv.ts`.
- **`assertActivity` expects the browser's admin.** A `fleetctl` or API action is attributed to the API token's user:
  use `findActivity` and match the content.
- **`refetch_requested` is one bit any refetch clears.** Read it within a second of the result, on as few hosts as
  the point needs (`waitForHostSoftwareStatus`'s `interval`).
- **A script-only package runs as an install**: Run / Rerun / Retry in the Library, `installed_software` from
  `sh_packages`, "Script details" with its output only if the script printed some. Keep the script's exit 0
  (fleetdm/fleet#54607).
- **Decisions Andrey made in G:** live runs on the three VMs rather than All hosts or the Unassigned chip; a host's
  Library is read for its count and Add software's routing, not its static copy; the script-only package runs on the
  Mac, whose queue is lighter than Linux's.

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
