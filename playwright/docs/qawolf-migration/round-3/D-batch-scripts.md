# Batch D — Batch scripts

**9 gaps → 1 new spec and 2 augments.** `Schedule for later` · `Cancel` · `Cancel-on-edit` · `Batch progress`

**Status: built 2026-10-03; ships with batch C in [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86)**
(planned 2026-10-01). The review's outcome is [Review decisions](#review-decisions-2026-10-03): 9 gaps → 4 built,
3 folded, 2 cut; what was built is [What landed](#what-landed).

> ## ▶ Start here
>
> **Branch from `main` at or after da2aceb** ([PR #82](https://github.com/AndreyKizimenko/qa-automation-poc/pull/82),
> batches A and B). **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md](README.md) §4–§5, round 2's [README §9](../round-2/README.md#9-working-a-batch-since-d) and
> [D → What landed](../round-2/D-host-execution.md#what-landed-and-what-changed-from-the-plan) (where
> `batch-run.spec.ts` came from), `playwright/CLAUDE.md` (**Test hosts**), then this file.
>
> **What this batch is.** The batch-script features round 2 didn't reach: scheduling a run for later,
> cancelling a batch, editing a script under a running batch, the progress pages' tabs and counts. On
> **simulations on premium's Unassigned**, never the VMs: a script uploaded to Unassigned can't reach a VM,
> because every targeted host must be on the script's fleet (`server/service/scripts.go:1201-1203`).
>
> **The fact that shapes it** (§2): simulations **do** run scripts, within about 35 s. So "pending" is a race,
> and the deterministic route to *Canceled* is a batch **scheduled for later, then cancelled**.
>
> **Since batches A and B (2026-10-03).** The full list is in
> [README §5](README.md#since-batches-a-and-b-2026-10-03). These apply here:
>
> - **Re-checking against Fleet's source settled two facts the plan left open and corrected a third.** A
>   cancelled scheduled batch lists its hosts under Canceled (§2). Deleting a script deletes its batches (§3), so
>   the cleanup projects' wipe of Unassigned's scripts removes a scheduled batch a dead run left (Traps). For the
>   same reason, the plan's "batches can't be deleted" was wrong: they go with their script.
> - **Two runs in a row can share one toast.** A success toast lingers, so a second `runNow` can pass on the first
>   run's "Successfully ran script." card, and `showScriptActivity` then finds two "Show script activity" links.
>   Call `toast.dismissAll()` between actions that raise the same kind of toast (C8 #11's two runs) and confirm
>   each batch through the API (`findBatchId`, `getBatchSummary`), not the toast.
> - **Write an Ace editor through Ace's API.** `ScriptsLibraryPage.editScript` types the new content
>   (`replaceEditorContent`), and Ace auto-indents and closes quotes. For C8 #8, write it with `setAceValue`
>   (`pages/components/aceEditor.ts`), or keep it to one line.
> - **Remove every per-run thing in an `afterEach`**, not only a `finally`: a timed-out test skips its `finally`,
>   and a scheduled batch still fires at its time.
> - **Nothing here writes global config.** C8 #8's flow flips "Disable scripts"; that stays with
>   `shared/exclusive/script-execution-disabled.spec.ts`.
> - **Slices already claimed** (`helpers/api/hosts.ts`): `findSimulations` linux 0–2 (2 is batch A's
>   `labels.spec.ts`), darwin 0–5, windows 0–1; `findSimulatedHostIds` darwin 0–2, 10–11, 20, 30 and windows 0–2,
>   10.
> - **Run cost:** the premium main project is worker-bound (~42 of the branch run's ~58 min, 3 workers,
>   run 37077445852), so this batch's waits on the 2- and 5-minute workers add to it directly.
> - **If another batch is built at the same time**, announce each run to its session. A run with dependencies
>   waits for its "go": `cleanup-setup` deletes Unassigned's scripts, and with them every batch on them.
>
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`
> (`cmd/osquery-perf/agent.go` at the same commit), the build both instances run, and again on 2026-10-03 against
> `main` (da2aceb) and the RC branch's head (ac3c0d6).

## The gaps

| Gap | What's untested today | Proposed target | Kind | Source flow |
|---|---|---|---|---|
| round 1 C8 #16 | Schedule for later: date / time chosen, the batch listed as scheduled | `premium/controls/scripts/batch-schedule.spec.ts` | new | `flows-Premium/scripts-schedule-for-later-allows-the-user-to-customize-the-time-for-the-script-to-run.flow.js` |
| round 1 C8 #19 | the Run script modal's Schedule radio, Date / Time fields and their validation (the flow never runs anything) | fold into C8 #16 | augment | `flows-Premium/secrets-run-script-modal-now-contains-two-options-run-now-and-schedule-for-later-ui-updates-accordingly-when-toggling-between-the-options.flow.js` |
| round 1 C8 #17 | cancelling a batch: the batch reads Canceled under Finished (the flow asserts that, not per-host Canceled) | `premium/controls/scripts/batch-schedule.spec.ts` | new | `flows-Premium/scripts-script-execution-can-be-canceled-and-the-script-moves-to-the-correct-status.flow.js` |
| round 1 C8 #8 | editing a script cancels its queued batch runs | `premium/controls/scripts/batch-schedule.spec.ts` | new | `flows-Premium/controls-batch-run-scripts-on-hundreds-of-hosts-cancel-all-queued-scripts-if-they-were-modified.flow.js` |
| round 1 C8 #15 | a running, scheduled or finished batch's script preview | `premium/controls/scripts/batch-run.spec.ts` | augment | `flows-Premium/scripts-running-scheduled-and-finished-scripts-can-be-previewed.flow.js` |
| round 1 C8 #9 | the batch progress page: empty state, Scheduled tab, sub-nav | `premium/controls/scripts/batch-run.spec.ts` | augment | `flows-Premium/scripts-batch-script-progress-page-is-accessible-from-the-controls-greater-scripts-page.flow.js` |
| round 1 C8 #11 | two batches under Started, an unrun script absent | `premium/controls/scripts/batch-run.spec.ts` | augment | `flows-Premium/scripts-correct-currently-running-scripts-are-displayed-on-the-started-tab-of-the-batch-script-progress.flow.js` |
| round 1 C8 #12 | a pending host cancelled moves to the Canceled tab | `premium/controls/scripts/batch-schedule.spec.ts` | new | `flows-Premium/scripts-correct-hosts-are-displayed-under-each-tab-run-errored-pending-incompatible-canceled.flow.js` |
| round 1 C8 #18 | tab counts during a run and after a cancel (after finishing only today) | `premium/controls/scripts/batch-run.spec.ts` | augment | `flows-Premium/scripts-status-counts-on-batch-script-details-page-tabs.flow.js` |

## Review decisions (2026-10-03)

Every flow body read; facts checked against Fleet `rc-minor-fleet-v4.93.0` (ac3c0d6; the instances run bc215a4,
three dependency bumps later) and **probed live on premium** (a `pw-probe-*` script scheduled on three Unassigned
simulations, cancelled, read back, deleted).

| Gap | Decision | What gets built, and why |
|---|---|---|
| C8 #16 | **build** | Hosts → one claimed simulation → Run script → *Schedule for later* → Date / Time → Run; the toast and its *Show schedule* link; the Scheduled tab's row ("Will start …"); the stored `not_before` equals the UTC date and time typed (API), in place of the flow's tooltip, which renders in the browser's locale; then the batch **starts** (API poll, ≤ ~4 min: a time 1–2 min ahead plus the 2-minute worker) and the Started tab lists it. Waiting for the start is Q2 |
| C8 #19 | **fold into #16** | The flow only toggles the radios and sees Date / Time appear, so that's what #16 asserts on the way. **The planned validation messages are dropped**: the flow never checks them (round 3 adds no scope), and Fleet is moving form validation to submit-only, so "Run disabled while incomplete" is the assertion most likely to go stale |
| C8 #17 | **build** | Schedule for tomorrow on three claimed simulations → details → Cancel → "Cancel script?" → *Cancel script* → toast → the Finished row reads **Canceled**. Deterministic, and nothing runs |
| C8 #12 | **fold into #17**, now deterministic | Probed: a scheduled batch lists **every** host under Pending, even one without orbit (incompatibility is decided at start). After the cancel, Canceled lists exactly those hosts and Pending is empty. That is the flow's own assertion ("the hosts Pending before the cancel are now under Canceled") without the race. Its first test duplicates `batch-run` test 1: cut |
| C8 #18 | **fold the after-cancel half into #17; cut "during a run"** | After the cancel: the tab reads "Canceled 3", its header "3 hosts", Pending has no count and its empty state. The during-run half compares a tab's live count with the header's, which are two separate fetches of a moving number, polled up to 200 times until "Started 2 minutes ago": no stable assertion |
| C8 #15 | **fold into #17** | *Show script* on the scheduled batch, then again once it's cancelled (Finished): name and content. It is the same button and modal in every state (`ScriptBatchDetailsPage.tsx:271-299`), so the Started state adds nothing. Screenshots dropped |
| C8 #8 | **build, near-deterministic** (Q3) | Start the batch through the API on the claimed Linux orbit simulations with the Library already open, edit the script at once through the UI (the "Save changes?" modal and its copy), then: Canceled ≥ 1 in the UI and the API, canceled ⊆ targeted, the counts add up. **"The batch ends Completed" is dropped**: a 5-minute cron wait that `batch-run` already proves |
| C8 #9 | **build, premium only** | Controls → Scripts → *Batch progress* sub-nav (`batch-run` enters only from the toast), and each tab's empty state on Workstations, which nothing runs a batch on. Free has no fleet that's empty for sure: its Unassigned holds this batch's own batches while the spec runs |
| C8 #11 | **cut** | The Started tab listing a running batch is `batch-run` test 1's assertion; a second row exercises nothing new in the list; "the unrun script is absent" is vacuous, because only batches are listed; and it races the 5-minute completion cron |

**Where it lands.** #16/#19, #17/#12/#18/#15 and #8 go in one new spec; #9 is a small read-only describe in
`premium/controls/scripts/batch-run.spec.ts`, outside its VM timeout and retries. The new spec is
`shared/controls/scripts/batch-schedule-cancel.spec.ts` if Q1 is "both tiers", else
`premium/controls/scripts/batch-schedule-cancel.spec.ts`.

**Facts the review corrected or added** (§2–§3 are otherwise accurate):

- **A scheduled batch's hosts are all Pending** until it starts, whatever their orbit or platform, and a cancel
  moves every one of them to Canceled (`canceled_host_count` = targeted, `status: finished`, `canceled: true`).
- **Free has batch scripts.** No license check on the batch endpoints or in the batch UI; `GET /scripts/batch`
  needs `fleet_id` (`fleet_id=0` for Unassigned) or answers 400 "Param team_id is required".
- **The pool:** premium has 9 online Linux orbit simulations on Unassigned (of 28 Linux); free has 48.
- **"Show script" opens Fleet's `ScriptDetailsModal`** (`pages/hosts/components/ScriptDetailsModal`,
  `.script-details-modal`, `suppressSecondaryActions`). Its title is the script's **name** ("Script details" only while
  loading), and its content sits under "Script content:". The suite has no page object for it.
- **A batch fails outright if any targeted host has left the script's fleet** (`scripts.go:1197-1202`), so the spec
  claims its simulations in the registry: one moved by another spec mid-test would fail the POST.
- **Upload to Unassigned omits `fleet_id`** (`uploadScript` already does): `fleet_id=0` is refused.
- **The slices (agreed with batch C, 2026-10-03):** `findSimulations` **linux 10–19** and **darwin 10–39** on both
  tiers, filtered to orbit hosts on Unassigned; never moved, only scripted. Linux 10–12 take the cancelled scheduled
  batch and the first orbit host in 13–19 the batch that fires. The edit-cancel batch takes the orbit hosts in
  darwin 10–39 (about 15 per tier), not Linux ones. On these instances the built-in macOS label holds the *Ubuntu*
  simulations, and `batch-run`'s scale test runs a batch on every online member on Unassigned, so a Linux host may
  have a scale run queued ahead (#54732). Batch C holds linux 2–7 (with `labels.spec`'s 2), darwin 6 and windows 2, all below 10.
  Registered in `helpers/api/hosts.ts`.

**A Fleet bug, filed as [fleetdm/fleet#54732](https://github.com/fleetdm/fleet/issues/54732) (2026-10-03).**
Reproduced on both QA instances, released since 4.74.0, and cancelling the stuck batch is the workaround. Editing a script cancels a host's batch run
through `cancelHostUpcomingActivity`, which marks `host_script_results` canceled only if the run was already
*activated*. A run still queued behind another activity on that host has no result row, and the batch isn't
canceled, so `hosts.go`'s Pending filter (`hsr.host_id IS NULL AND ba.canceled = 0`) keeps counting that host
Pending. **Repro on premium:** batch A, then batch B, on one Linux orbit simulation (B queued behind A), then
`PATCH /scripts/{B}` at once. B's run left the host's upcoming queue, but batch B read `started`, Pending 1,
Canceled 0, and the host listed under Pending, for 11 minutes and through two `batch_activity_completion_checker`
ticks after A finished: **the batch never finishes**. No "canceled" activity was logged for the host either. On a
real host the trigger is ordinary: any install or script queued ahead of the batch when the script is edited.
No existing issue found (searched 2026-10-03; nearest is #54116, a different defect). It doesn't block this batch:
#8's simulations have empty queues, so their runs are activated at once (see Traps).

## 1. Review first

Read every flow body. Known so far:

- **C8 #19 folds into C8 #16.** Same modal; the flow toggles the radios on a VM and never clicks Run. Add the
  date and time validation to C8 #16, on a simulation.
- **C8 #17 is narrower than its row**: the flow asserts the batch reads "Canceled" under Finished, not per-host
  Canceled. Schedule far ahead, then cancel: deterministic, and nothing runs.
- **C8 #12's first test duplicates `batch-run` test 1.** Its second test (the pending hosts move to Canceled)
  is the gap.
- **C8 #8 is a race on simulations** (§2): a decision.
- **C8 #11 races the completion checker**: a batch moves from Started to Finished at the next 5-minute tick
  after its hosts finish. Assert right after the toast.
- **C8 #15**: drop the flow's screenshots.
- **Premium only.** Batch scripts aren't license-gated, but on free the real VMs sit in Unassigned, so a
  "Select all matching" there would reach them. The free check is the paywall, if any.

## 2. What simulations do with a script

- **About half of them run it.** `-orbit_prob` is 0.5 (`agent.go:4603`) and script execution isn't disabled
  (`:4632`); the daemons' plist sets neither. An orbit simulation polls every 30 s (`:1285`), "runs" for 0–4 s and
  exits 0 or 1 at random (`:2160-2173`). Hosts without orbit go straight to *Incompatible*
  (`server/datastore/mysql/scripts.go:2876-2885`).
- **So a run's pending window is ≤ 35 s**, and C8 #8, #12 and "#18 during a run" race it. Offline orbit
  simulations would stay pending, but they only exist for up to a day after a daemon restart
  (`tools/perf-hosts/README.md:20-22`).
- **A batch reads Finished** only after `batch_activity_completion_checker` runs, every 5 minutes
  (`cmd/fleet/cron.go:2436-2470`). `POST /trigger?name=batch_activity_completion_checker` exists but is global;
  don't call it from a test.
- **Cancelling a scheduled batch** finishes it at once, with every host canceled (`scripts.go:3058-3067`). The
  Canceled tab lists those hosts: its host query counts a host with no run as canceled once its batch is
  (`server/datastore/mysql/hosts.go:1676-1679`), and the batch's cached count is every host (`scripts.go:3065`).
  C8 #12 and #18's deterministic halves stand on that. It's read from source, so confirm it on the page in the
  first build step.

## 3. Facts for the build

- **Schedule for later (C8 #16, #19).** `ManageHostsPage/components/RunScriptBatchModal/RunScriptBatchModal.tsx`:
  radios "Run now" (`:280`) and "Schedule for later" (`:289`); fields "Date (UTC)" (`YYYY-MM-DD format (e.g.,
  "2024-07-01").`) and "Time (UTC)" (`HH:MM 24-hour format (e.g., "13:37").`, `:303-315`). Errors include "Date
  (UTC) cannot be in the past" and "Time (UTC) must have valid format" (`helpers.ts:52-108`); while incomplete,
  Run is disabled with "Enter a date and time to schedule this script." Toast "Successfully scheduled script."
  with a "Show schedule" link. API `POST /scripts/run/batch {script_id, host_ids | filters, not_before}`; host
  ids are resolved when the request is made (`server/service/scripts.go:1196-1206`). It logs
  `scheduled_script_batch`. The `scheduled_batch_activities` worker (every 2 min) starts it
  (`cron.go:2804-2838`), so a batch scheduled a minute ahead starts within ~3. Listed by `GET
  /scripts/batch?fleet_id=&status=scheduled`; the row reads "Will start …".
- **Cancel (C8 #17, #12).** A "Cancel" button on the batch's details page, hidden once it's finished; modal
  "Cancel script?" with "Cancel script" / "Back"; toast "Successfully canceled script."; `POST
  /scripts/batch/{id}/cancel`, logs `canceled_script_batch`. A started batch cancels every run without a result.
- **Editing cancels queued runs (C8 #8).** `UpdateScriptContents` → `cancelUpcomingScriptActivities`
  (`scripts.go:547,592,610-643`) cancels runs queued and sent without a result. **A scheduled batch is untouched**
  and runs the new content later. Only `updated_script` is logged. Modal "Save changes?": "…will cancel any
  pending script runs for {name}." and "If this script is currently running on a host, it will complete, but
  results won't appear in Fleet." The batch still ends "Completed". In the UI, `ScriptsLibraryPage.editScript`
  saves through that modal; it types the content, so set multi-line content with `setAceValue`. The flow also
  flips the global "Disable scripts" setting: leave that to the exclusive spec that owns it.
- **The progress pages (C8 #9, #11, #15, #18).** `/controls/scripts/progress?fleet_id=&status=`, tabs "Started",
  "Scheduled", "Finished"; empty state "No batch scripts {started | scheduled | finished}" with "Scripts running on
  multiple hosts will appear here." Details `/controls/scripts/progress/{id}`: "N hosts targeted (X% responded)",
  "Show script", "Cancel"; tabs Ran / Errored / Pending / Incompatible / Canceled, whose counts are live until the
  batch finishes, then cached; the tab's accessible name carries the count ("Ran 3"). Host table
  `host_results?status=`, columns "Host name", "Time", "Script output". "Show script" opens "Script details" with
  "Script content:". **The suite's `ScriptDetailsModal` is the host output modal** (`.run-script-details-modal`),
  so the batch preview needs its own component. C8 #9's empty state needs a fleet with no batch history:
  Workstations. No spec runs a batch there, and `cleanup-setup` deletes its scripts, which takes any batch with
  them (below). Confirm it on the page.
- **Deleting a script deletes its batches.** `batch_activities.script_id` is `ON DELETE CASCADE`
  (`server/datastore/mysql/schema.sql:298`), and the batch list joins `scripts` (`scripts.go:3335-3337`). A
  scheduled batch's job then finds no batch and runs nothing (`server/worker/batch_activities.go`). A batch has
  no delete of its own.
- **`batch-run.spec.ts` today:** test 1 runs on the three VMs (VMs fleet) and asserts one host each in Ran /
  Errored / Incompatible with output; test 2 runs on every online macOS simulation on Unassigned through
  *Select all matching* and checks the counts add up. Cleanup is `deleteScript` in a `finally`, which removes
  the batch with it.

## 4. How to make each one deterministic

| gap | route |
|---|---|
| C8 #16, #19 | schedule a minute or two ahead on one or a few simulations; assert the toast, the Scheduled row, then (polling ≤ 5 min) the move to Started. The validation messages need no run |
| C8 #17 | schedule far ahead (tomorrow), cancel, assert *Canceled* under Finished |
| C8 #12 | the scheduled cancel, whose Canceled tab lists its hosts (§2); if the page disagrees, run on 10+ orbit simulations, read Pending at once, cancel, assert Canceled ⊆ the hosts read and non-empty |
| C8 #18 | the after-cancel counts via the scheduled cancel; drop the "during a run" half, or accept it as ⊆ / ≥ assertions |
| C8 #8 | run on 10+ orbit simulations, edit the script at once, assert Canceled ≥ 1 and the batch ends Completed. A race by nature: put it to Andrey |
| C8 #9, #11, #15 | read-only; #11 right after the toasts, #15 on a scheduled batch (Scheduled), then the same batch after cancelling (Finished) |

Pick orbit simulations the way `findSimulatedHostForMdm({ withOrbit })` does (`ListedHost.orbitVersion` /
`scriptsEnabled`); `findSimulations` has no orbit option yet. Claim a slice in the registry in
`helpers/api/hosts.ts`, and leave the macOS simulations where `batch-run`'s scale test needs them (50+ online on
Unassigned).

## Reusable pieces

`RunScriptBatchModal` (`summary`, `runNow`, `showScriptActivity`; add schedule, date and time),
`ScriptsBatchProgressPage` (the three tabs, `goto({ fleetId })`, `batch(name)`), `ScriptBatchDetailsPage`
(`heading`, `summary`, `tab`, `openTab`, `hostNames`, `emptyTab`, `backButton`; add Show script, Cancel and the
cancel modal); `helpers/api/scripts.ts` (`uploadScript`, `deleteScript`, `getBatchSummary`, `findBatchId`,
`waitForBatchFinished`, 480 s); `activityCopy.script.ranBatch`; `cancelUpcomingActivity`;
`ScriptsLibraryPage.editScript` (C8 #8); `setAceValue` (`pages/components/aceEditor.ts`); `Toast.dismissAll`.

## Decisions to put to Andrey

**Answered 2026-10-03: every recommendation taken.** Both tiers (`shared/`), so the "never run this batch on free"
trap below is lifted for claimed simulations picked by id. #16 waits for the start. #8 is built. All five cuts
are approved. The pending-forever lead was reproduced and filed as [fleetdm/fleet#54732](https://github.com/fleetdm/fleet/issues/54732).

Asked 2026-10-03, after the review above:

1. **Tiers: both, or premium only?** The plan said premium only because free's VMs sit in Unassigned. But every
   test here targets claimed **simulations by id** (never *Select all matching*), the picker refuses a
   `kind: 'real'` host, and the scheduled-cancel test runs nothing. Free has the feature and 48 Linux orbit
   simulations. Recommended: `shared/`, both tiers (free coverage is a standing goal).
2. **C8 #16: wait for the scheduled batch to start** (~4 min of one worker per tier), or stop at Scheduled?
   Recommended: wait. That the batch actually fires is the feature, and nothing else covers the 2-minute worker.
3. **C8 #8: build or cut?** Built as above, it fails only if every claimed orbit simulation reports before the
   edit lands. Each polls every 30 s and "runs" 0–4 s, so with an edit 10 s after the start that's about
   (10/30)ⁿ: 1 in 60,000 on premium's ~10 hosts, 1 in 2,200 on free's ~7. Recommended: build.
4. **The pending-forever lead:** check it now with a simulation repro (~10 min, no spec), or leave it?
5. **Confirm the cuts:** C8 #11 entirely, C8 #18's during-run half, C8 #12's first test, #19's validation messages,
   and #8's "ends Completed".

## Traps this batch will hit

- **A scheduled batch outlives a dead run.** Cancel it, or delete its script, in an `afterEach`. Deleting the
  script deletes the batch (§3), so the cleanup projects' wipe of Unassigned's scripts already removes one a dead
  run left, and no batch sweep is needed. Only a run killed before its teardown leaves one that can fire at its
  time, on simulations only, before the next run's `cleanup-setup`.
- **Never upload a batch script to the VMs fleet**, and on free never target hosts by filter (*Select all
  matching*): one queue per VM, and the free VMs sit in Unassigned. Claimed simulations picked by id are safe on
  both tiers (Andrey, 2026-10-03).
- **A batch goes only with its script.** Use unique `pw-*` script names, assert over your own batch, never the
  list's first row, and delete the script only after the last assertion on its batch.
- **#8's hosts must have nothing queued ahead of its batch.** A run still queued behind another activity when the
  script is edited stays Pending forever (the bug above), and the batch never finishes. Keep #16's and #8's hosts
  in disjoint parts of the slice, and assert Canceled ≥ 1 rather than "nothing left Pending".
- **The Hosts table rewrites its URL with the default sort just after it loads** (batch C, 2026-10-03), so a
  filter or search applied at once can be undone. #16 searches for its simulation there: wait for the table to
  settle, then confirm it narrowed to exactly that host before checking it.
- **Moving Linux simulations off Unassigned** shifts `batch-run`'s scale test: it batches the built-in macOS label's
  online members, which on these instances are the *Ubuntu* simulations (found while building, 2026-10-03). Use
  your own slice.

## Done when

- Every row has a written review decision; the questions above have Andrey's answer.
- `batch-schedule.spec.ts` and the `batch-run.spec.ts` augments built on premium, deterministic where §4 says they
  can be, each cancelling what it scheduled and deleting its scripts.
- `npm run check` clean; each changed spec run with dependencies, once headed, `--repeat-each=5` (these wait on
  2- and 5-minute workers, so budget the timeouts accordingly).
- `playwright-test-reviewer` run on the branch's diff, findings fixed or answered.
- Docs in the same commits: this file's *What landed*, a [DELIVERY-LOG](../DELIVERY-LOG.md) line, a
  [test-audit](../../test-audit/README.md) entry per `test()`, `pages/README.md` / `helpers/README.md`, and this
  round's [README](README.md) batch table and [INDEX](INDEX.md).
- PR open, Andrey told it's ready for its branch run. **D ships in batch C's [PR #86](https://github.com/AndreyKizimenko/qa-automation-poc/pull/86)**
  (Andrey, 2026-10-03): this branch is built on C's `e29c4fc`, and its commits go onto
  `playwright/qawolf-round3-batch-c` at the end. C won't rebase or force-push, and messages the SHA of any fix it
  pushes; merge it in before pushing. Then extend #86's title and body to cover D, point D's row in this round's
  README at #86, and **recount the test-audit totals from the area files** (C left them at 504), not by adding to C's.

## What landed

| target | gaps | notes |
|---|---|---|
| `shared/controls/scripts/batch-schedule-cancel.spec.ts` (new, both tiers) | C8 #17, #12, #18, #15 | a batch scheduled for tomorrow on 3 claimed simulations: Pending 3 → **Cancel** → finished and canceled, all 3 under Canceled, "Canceled" under Finished; previewed before and after (CTL-37) |
| same | C8 #16, #19 | Schedule for later from the Hosts list on one orbit simulation: the stored `not_before` is the UTC time typed, and the worker starts the batch (CTL-38; ~4 min of a worker) |
| same | C8 #8 | an edit mid-run, through "Save changes?", cancels the runs not yet reported: ≥ 1 canceled, ⊆ targeted, counts add up, the Canceled tab lists them (CTL-39) |
| `premium/controls/scripts/batch-run.spec.ts` (new describe) | C8 #9 | Controls → Scripts → **Batch progress** on Workstations: each tab's empty state (CTL-40) |
| `premium/controls/scripts/batch-run.spec.ts` (scale test) | — | its filters go through `HostsListPage.filterTo`: a URL rewrite had dropped both, and *Select all matching* took all 200 hosts on Unassigned (caught by the modal's count check) |
| cut | C8 #11; #18 during a run; #12's first test; #19's validation; #8's "ends Completed" | see [Review decisions](#review-decisions-2026-10-03) |

**Changed from the plan:**
- **One spec, `shared/`, not `premium/batch-schedule.spec.ts`:** free has the feature, and simulations picked by
  id never reach its VMs.
- **The preview modal isn't what §3 said.** From a batch, **Show script** opens Fleet's `ScriptDetailsModal`
  titled "Script details" (never the script's name), with no footer: the header's ✕ closes it
  (`ScriptPreviewModal`).
- **Cancelling returns to Batch progress** on the tab the batch was listed under, with no `fleet_id` for an
  Unassigned batch, so the spec reselects Unassigned there.
- **The batch is started through the API in #8,** with the Library already open: the edit has to land within the
  hosts' 30-second poll window.
- **Filed [fleetdm/fleet#54732](https://github.com/fleetdm/fleet/issues/54732)** (released since 4.74.0): an edit
  while a host's run is still queued behind another activity leaves that host Pending, and the batch never
  finishes.
- **Filed [fleetdm/fleet#54734](https://github.com/fleetdm/fleet/issues/54734)** after the branch run (released): a
  run cancelled while a host is running it still records its result, and the host then shows under no tab. It made
  the edit test flaky (failed twice in run 37149323584); the test now compares the Canceled tab with a live API
  read. Both bugs have a row under *Worked around in the suite* in `docs/blocked-by-product-bugs.md`.
