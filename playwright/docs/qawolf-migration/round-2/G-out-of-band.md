# Batch G — Out-of-band

**14 source flows → 7 specs.** `Policy automations and retries` · `gitops mode`

> ## ▶ Start here — handoff, 2026-09-29 after E
>
> **gitops mode V1 shipped** (#61: `tests/e2e/premium/gitops-mode/`, its own project, runs last; see the end of
> this file). **This handoff is the other half: policy automations and retries, 9 flows → 5 specs.** gitops
> mode V2 (the parked list at the end) isn't part of it unless Andrey says so. A–E are on `main`
> (#61, #63, #65). **Branch from `main`**, and check nothing else is running (`gh run list --limit 5`) before
> any run that touches the instances.
>
> **1. Invoke the skills — don't wait for them to trigger.**
>
> | when | skill |
> |---|---|
> | before writing anything | **`playwright-test-author`** (Skill tool): the rules, the Fleet traps, the verification bar |
> | before the PR, on your own specs and page objects | **`playwright-test-reviewer`**: fix what it finds, or write down why not |
> | a run went red and you need a verdict | **`playwright-run-reviewer`** |
> | Andrey has said a finding is a Fleet bug | **`/fleet-bug-file`**, only then, and search first |
>
> **2. Read, in order:** [README §9](README.md#9-working-a-batch-since-d) (how a batch runs, which docs move
> with the code, the patterns E added), [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out),
> `playwright/CLAUDE.md` (**Test hosts**, the cleanup pipeline, the exclusive projects, **Skips**),
> [D-host-execution.md → What landed](D-host-execution.md#what-landed-and-what-changed-from-the-plan) (scripts
> and installs on the real VMs, the durable fixtures, per-run `fleet-pw-*` packages),
> [E-label-targeting.md → What landed](E-label-targeting.md#what-landed) (policies targeted by label, simulations
> borrowed onto a fleet), then this file.
>
> **3. The process, in one breath.** Run only the specs you change, on every tier they target: with
> dependencies once, headed once, `--repeat-each=5` for anything timing-sensitive, `--workers=2` on VM specs,
> `--output=<scratchpad>/<run>`. Ship in slices with the docs in the same commit (README §9's table). **At
> the end, open the PR and tell Andrey it's ready. He dispatches the full `QA — Branch run` himself**; don't
> start one, and never overlap the nightly.
>
> **4. Free is a standing goal.** Free already has `policies.spec.ts` and `policy-automations.spec.ts`, so every
> augment row has a free twin to check, and §3 lists what free can assert that QA Wolf never did. `shared/`
> when identical, an explicit `free/` sibling when not, never `if (isPremium)`.
>
> **5. Ask Andrey before** the hourly-flow decision (§1), anything that makes a real VM run something on a
> schedule, and any gitops change.

---

### 1. What the retries really cost — from Fleet's source (4.93 RC)

The plan below says none of this belongs in the nightly. **Only one flow doesn't.**

- **Retries are immediate.** When a policy automation's script or install comes back failed, orbit's result
  handler queues the next attempt straight away, while `attempt_number < MaxPolicyAutomationRetries` (3) and
  the policy still fails for that host (`server/service/orbit.go`, `shouldRetryPolicyAutomation…`;
  `server/fleet/policies.go`). So 1 + 3 attempts take minutes on a VM: QA Wolf's flow waits about 2.5 min for
  three upcoming timestamps. **The attempt-retry flows (scripts, installs, the all-attempts activity) belong in
  the nightly**, on a real VM.
- **Continuous automations are the slow one.** `continuous_automations_enabled` (team policies, premium)
  re-fires on every failing result, but **throttled to once per policy update interval** (~1 h):
  `continuousAutomationOnCooldown` in `server/service/osquery.go`. A refetch does not get around it.
- **QA Wolf didn't wait for it live.** `util/createFailingPolicyThatRetriesEveryHour` set up a durable,
  always-failing policy (`SELECT 1 FROM osquery_info WHERE start_time < 1;`) with a failing `run_script`
  automation and continuous on, on their VM team's Ubuntu host. The test only reads the accumulated Activity:
  the first retries at most 5 min apart, then hourly gaps of 30–90 min.

**Decision for Andrey, before building the hourly flow:**

| option | how | cost |
|---|---|---|
| **A. durable precondition** (QA Wolf's approach) | declare the always-failing policy and its failing script on the VMs fleet in `vms.yml`, scoped to the Ubuntu VM only; a read-only spec in the nightly asserts the history | the Ubuntu VM, already the busiest in the suite, runs the script up to 4× an hour (one re-fire plus its retries), permanently. A Linux simulation borrowed onto VMs would get the policy too, so scope it by a label holding only the VM. The names mustn't start `pw-` (the VMs sweep deletes those) |
| **B. out-of-band project** | its own project and workflow: creates the policy, then waits ≥ 2 h | 2+ h of one VM per run, clear of the nightly and daytime runs; GitHub's schedule lag applies |
| **C. park it** | build the attempt retries; record that the hourly cadence is Fleet's throttle, covered by its unit tests | no end-to-end check of continuous automations |

A is the cheapest per run and the closest to the source flow. Its cost is permanent hourly activity on a real
VM, which is why it's Andrey's call.

### 2. Hosts, fixtures and cleanup

- **Scripts and installs run only on real VMs.** Simulations never run anything. Use the Ubuntu VM for a failing
  bash script (`exit 1`; fastest round trip). For the Python row, check the interpreter first: D's interpreter rows
  run Python on the Linux VM (`host-run-script.spec.ts`), so confirm the Mac has `python3` before using it there.
- **A failing install** is a per-run `fleet-pw-*` `.deb` whose install script exits non-zero (`helpers/deb.ts`;
  D built a failing-uninstall variant). Never touch the durable fixtures in `helpers/vm-fixtures.ts`.
- **A policy on the VMs fleet runs on all three VMs**, and on any simulation borrowed there. Scope it to one VM
  (a `platform` plus a manual label holding only that VM, E's `createManualLabel`). Simulations answer
  policies at random, so an unscoped policy queues automations on hosts that never run them.
- **Run policies now, not in an hour:** a refetch re-runs them immediately. Wait out an outstanding refetch
  first (`waitForNoPendingRefetch`), then request yours.
- **Script execution must be on.** The exclusive projects turn it off and `cleanup-setup` turns it back on, so
  it's on inside the main project; don't flip it from a main-project spec.
- **Cleanup homes exist** for what a timed-out test leaves: the VMs sweep deletes `pw-*` policies, `pw-*`
  labels, `fleet-pw-*` titles and their `[Install software] fleet-pw-*` policies, and the resting-state step
  cancels the suite's queued scripts and installs. Name everything accordingly.
- **Budget:** a script attempt on Linux is well under a minute, an install 1–2 min, so 1 + 3 attempts is a few minutes.
  Price what the batch adds to premium's ~56-min nightly.

### 3. What free can check

- **Policies exist on free; most automation types don't.** Premium-only on the server (`premium:"true"` in
  `server/fleet/api_policies.go`): `critical`, label targets, `continuous_automations_enabled`, the patch
  fields; and script/install automations need a fleet policy, which free doesn't have. Free's automations are
  *Webhooks or tickets*.
- **The OS-specific row is a free check.** Round 1's policy CRUD already sets platforms on both tiers, so the
  "create and delete an OS-specific policy" flow is mostly a DUP. The part nothing covers is **platform
  targeting**: a macOS-only policy is listed for a macOS host and not a Windows one. That's server-side, so
  simulations answer it, and it's not premium. Build it as set membership (`listHostPolicyIds`) on **both**
  tiers. Round 1's audit had planned it as `os-specific-policy.spec` on each (`audit/C3-policies.md` rows 16, 19).
- **The automations surface on free:** the Policies page's automation filter doesn't render
  (`ManagePoliciesPage.tsx` → `renderAutomationFilter = isPremiumTier ? …`), and the manage-automations menu
  offers no Scripts / Software / Calendar. Assert what free shows, in the free twin of
  `policy-automations.spec.ts`; probe the live page first.
- **Patch policies** are premium-only; free gets no row.

### Traps this batch will hit

- **The Activity card counts in its tab names** (*Upcoming 3*), and host tabs do too (*Policies 3*,
  *Controls 1*). Match with a regex.
- **Assert attempts by count through the API**, then the newest one in the card: the card pages its feed, and
  other specs run the same VM's scripts at the same time. Add any new activity copy to `helpers/activity-copy.ts`
  with a case in `tests/api/activity-copy.spec.ts`.
- **A missing locator waits forever** (`click`, `fill`, `innerText`, `getAttribute` have no timeout), and the
  timed-out test's `finally` then runs on a closed context: the cleanup homes above are what catch it.
- **Nothing else may be using the VMs** when you run: `gh run list --limit 5` first. The nightly
  (`QA — Nightly`, ~1.5 h) is scheduled for 03:00 UTC, but GitHub starts it 4–6.5 h late.

### Done when

The batch's own **Done when** below, plus:

- the hourly flow is built the way Andrey chose, or parked with the reasoning here;
- every augment row's free twin is checked, and the free checks in §3 are built or their absence explained;
- anything a test creates on the VMs fleet is removed in the same test *and* covered by the cleanup;
- if option A, `vms.yml`'s header and `gitops/premium-fleetqa/README.md` say what the durable policy is for,
  the config is applied, and the PR says so;
- `playwright-test-reviewer` has been run and its findings fixed or answered; the docs in README §9's table are
  current;
- the PR is open with a *Needs you* list; Andrey runs `QA — Branch run` on it, and anything red is triaged.

---

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

Two clusters, planned together because both looked like scheduling problems. gitops mode is one: it has its
own Playwright project and runs last. The retries mostly aren't: only the continuous (hourly) flow needs more
than minutes (Start here §1).

## Policy automations and retries

*9 source flows → 5 specs.*

A failing policy triggers a script or an install; Fleet retries up to three times, or hourly for continuous
automations. Asserting this means waiting through real retry intervals — the hourly flow asserts gaps between
30 and 90 minutes.

**Only the continuous (hourly) flow is out-of-band**, and how to build it is a decision (Start here §1). The
attempt retries take minutes and belong in the nightly.

**The precondition is already written down.** `util/createFailingPolicyThatRetriesEveryHour` (cut in triage,
group B) carries the reliably-failing SQL, the `continuous-automations-enabled` toggle and the exact activity
string. Read it before building.

**Assert attempt counts, not screenshots.** `expect(upcomingTimestamps.size).toEqual(3)` is the right idea and
one of the few QA Wolf assertions worth keeping close to as-is.

**POM work:** `PolicyEditPage` — automations panel (run_script / install_software / continuous toggles);
`HostDetailsPage` — upcoming-vs-past activity filtering by script name.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/policies/automation-retries.spec.ts` | **new** | `activity-feed/individual-activity-items-for-all-attempts-for-failed-software-scripts`<br>`policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour`<br>`policies/script-run-retries-up-to-3-times-when-triggered-by-a-policy-automation`<br>`policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` |
| `tests/e2e/premium/policies/automation-run-script.spec.ts` | **new** | `fleet-maintained-filters/failing-policies/confirm-script-ran-in-ui-on-failing-host-policy`<br>`python/run-python-script-with-policy-automation-on-macos-host` |
| `tests/e2e/premium/policies/policies.spec.ts` | augment · check DUP | `policies/global-admin-able-to-create-and-delete-an-os-specific-policy-premium` |
| `tests/e2e/premium/policies/policy-automations.spec.ts` | augment | `policies/manage-all-automations-for-a-given-policy-at-once` |
| `tests/e2e/premium/policies/patch-policy.spec.ts` | **new** | `policies/patch-policy-fleet-maintained-apps` |

## gitops mode

*5 source flows → 2 specs.*

Runs only after every other batch is green. Its own Playwright project, one worker, with a teardown that
disables gitops mode whatever happened — an aborted run that leaves it on disables the next run's entire suite.

```ts
{
  name: 'gitops-mode',
  testDir: './tests/e2e/premium/gitops-mode',
  workers: 1,
  dependencies: ['premium'],
  teardown: 'gitops-mode-teardown',
}
```

**The five source flows are the floor, not the ceiling.** Gating is one component,
`GitOpsModeTooltipWrapper`, driven by `hooks/useGitOpsMode` — and **93 frontend files render it** across ten
areas we already have page objects for. QA Wolf covered three of those areas at surface level.

**The untested axis is exceptions.** `config.gitops.exceptions = { labels, software, secrets }`; when an
entity is excepted, gitops mode is treated as *disabled* for it, at 23 call sites. QA Wolf asserts none of
them. A change that stops honouring `exceptions.software` locks customers out of software management while
gitops mode is on, and nothing today would catch it.

**Over-gating matters as much as under-gating.** "Add hosts" must stay *enabled* in gitops mode — enrolling a
host is not a config change. Their own settings flow asserts this; keep it.

Full scope and the breadth-vs-depth question: [DECISIONS §5](DECISIONS.md#5-gitops-mode-scope).

**POM work:** new `helpers/api/gitops-mode.ts` to flip the flag and its exceptions; a shared assertion helper
for "control is disabled and shows the gitops tooltip".

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/gitops-mode/navbar-and-links.spec.ts` | **new** | `gitops/gitops-gitops-mode-in-navbar-and-learn-more-url`<br>`gitops/gitops-mode-yaml-links-lead-to-repository-url` |
| `tests/e2e/premium/gitops-mode/gated-surface.spec.ts` | **new** | `gitops/gitops-mode-gated-areas-of-the-ui-controls`<br>`gitops/gitops-mode-gated-areas-of-the-ui-hosts`<br>`gitops/gitops-mode-gated-areas-of-the-ui-settings` |

**V1 shipped (2026-09-27).** Four specs rather than two, because the design in
[GITOPS-PLAN.md](GITOPS-PLAN.md) found that the right unit is one control per *gating pattern*, not per area:
`01-indicator-and-links` (the two source flows in the table above), `02-gated-surfaces` (all four disabled signatures plus
the over-gating half and the Change-management escape hatch), `03-exceptions` (the `labels` and `secrets`
axes), and `zz-everything-is-back`. Plus a free-tier premium-gate spec, which the plan had ruled out — the
paywall on Change management is assertable as *replacing* the form, not merely sitting above it.

**Parked for V2, deliberately:**

- **The `software` exception.** Both surfaces the plan probed are blocked by product bugs (setup-experience
  Install-software is unsavable while excepted; the Software-title Library accordion needs a seeded installer),
  and the one zero-seed surface that *does* honour it — the Fleet-maintained app details form — needs an API
  resolver for an app not yet added to the fleet. Encoding the broken behaviour as a passing assertion was
  rejected: a test that is green *because* the product is broken inverts the meaning of green.
- **Controls › Variables' split gating** (`Add variable` disabled, `Delete <name>` enabled) — the single best
  over-gating detector in the plan, but it needs a seeded variable and there is no create helper yet.
- **The Change-management UI write flow** (tick an exception, Save, assert the toast and the activity copy).
  V1 asserts the card is fully interactive; it drives the flag over the API.
- **Policies, Reports, Software-title details and Controls › OS settings** gated surfaces — same patterns as
  the five areas V1 covers, so they add breadth rather than signal.

Three product bugs came out of the design work; see
[`../../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md) for the two the suite already bends
around, and GITOPS-PLAN §8 for all three.

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.

## What landed (retries half)

*Nothing yet. Add a row per target spec as it lands (status, and what changed from the plan), the way
[E](E-label-targeting.md#what-landed) does.*
