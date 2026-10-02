# Batch D — Batch scripts

**9 gaps → 1 new spec and 2 augments.** `Schedule for later` · `Cancel` · `Cancel-on-edit` · `Batch progress`

**Status: ready for review** (planned 2026-10-01).

> ## ▶ Start here
>
> **Branch from `main` after [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78) has merged.**
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
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
> Facts below were checked on 2026-10-01 against `main` (d55846a) and Fleet `rc-minor-fleet-v4.93.0`
> (`cmd/osquery-perf/agent.go` at the same commit), the build both instances run.

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
- **Cancelling a scheduled batch** finishes it at once, with every host canceled (`scripts.go:3047`). Whether
  the Canceled tab lists host rows for a batch that never started is unverified. Check it first, because C8 #12
  and #18's deterministic halves depend on it.

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
  results won't appear in Fleet." The batch still ends "Completed". The flow also flips the global "Disable
  scripts" setting: leave that to the exclusive spec that owns it.
- **The progress pages (C8 #9, #11, #15, #18).** `/controls/scripts/progress?fleet_id=&status=`, tabs "Started",
  "Scheduled", "Finished"; empty state "No batch scripts {started | scheduled | finished}" with "Scripts running on
  multiple hosts will appear here." Details `/controls/scripts/progress/{id}`: "N hosts targeted (X% responded)",
  "Show script", "Cancel"; tabs Ran / Errored / Pending / Incompatible / Canceled, whose counts are live until the
  batch finishes, then cached; the tab's accessible name carries the count ("Ran 3"). Host table
  `host_results?status=`, columns "Host name", "Time", "Script output". "Show script" opens "Script details" with
  "Script content:". **The suite's `ScriptDetailsModal` is the host output modal** (`.run-script-details-modal`),
  so the batch preview needs its own component. C8 #9's empty state needs a fleet with no batch history:
  Workstations probably, unverified.
- **`batch-run.spec.ts` today:** test 1 runs on the three VMs (VMs fleet) and asserts one host each in Ran /
  Errored / Incompatible with output; test 2 runs on every online macOS simulation on Unassigned through
  *Select all matching* and checks the counts add up. Cleanup is `deleteScript` in a `finally`; batches stay
  listed under Finished (they can't be deleted).

## 4. How to make each one deterministic

| gap | route |
|---|---|
| C8 #16, #19 | schedule a minute or two ahead on one or a few simulations; assert the toast, the Scheduled row, then (polling ≤ 5 min) the move to Started. The validation messages need no run |
| C8 #17 | schedule far ahead (tomorrow), cancel, assert *Canceled* under Finished |
| C8 #12 | the scheduled cancel, if its Canceled tab lists hosts (§2); otherwise run on 10+ orbit simulations, read Pending at once, cancel, assert Canceled ⊆ the hosts read and non-empty |
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
`waitForBatchFinished`, 480 s); `activityCopy.script.ranBatch`; `cancelUpcomingActivity`.

## Decisions to put to Andrey

1. **C8 #8 (edit cancels queued runs):** accept a ⊆ / ≥ 1 assertion over a ≤ 35 s window, or cut it.
2. **C8 #18's "during a run" half:** drop it, or the same loose assertion.

## Traps this batch will hit

- **A scheduled batch outlives a dead run.** Cancel it in an `afterEach`, and give `cleanup.steps.ts` a sweep for
  scheduled `pw-*` batches if a timed-out test could strand one. What a scheduled batch does when cleanup
  deletes its script is unverified.
- **Never upload a batch script to the VMs fleet**, and never run this batch on free: one queue per VM, and the
  free VMs sit in Unassigned.
- **Batches can't be deleted.** Use unique `pw-*` script names, and assert over your own batch, never the list's
  first row.
- **Moving or selecting macOS simulations** shifts `batch-run`'s scale test. Use your own slice, other platforms
  where you can.

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
- PR open, Andrey told it's ready for its branch run.

## What landed

*Nothing yet.*
