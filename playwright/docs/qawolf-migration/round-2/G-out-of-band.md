# Batch G — Out-of-band

**14 source flows.** gitops mode V1 shipped (5 flows, #61). **The retries half: 9 flows → 3 new specs + 2
augments, 2 cut as DUPs**, reviewed against the flow bodies and Fleet's 4.93 RC source on 2026-09-29 and
re-reviewed against the specs beside them on 2026-10-01 (decisions 3–5).

> **Built 2026-10-01** on `playwright/qawolf-round2-batch-g` — [PR #78](https://github.com/AndreyKizimenko/qa-automation-poc/pull/78),
> awaiting its branch run. What shipped is in [What landed](#what-landed-retries-half); the block below is
> the handoff it was built from.
>
> ## ▶ Start here — refreshed 2026-09-29, after F and #73
>
> A–F, gitops mode V1 and #73 (fleet-scoped CVE probe; exclusive specs as their own CI step) are on `main`.
> **Branch from `main`**, and check nothing else is running (`gh run list --limit 5`) before any run that
> touches the instances.
>
> **1. Invoke the skills — don't wait for them to trigger.** **`playwright-test-author`** before writing
> anything; **`playwright-test-reviewer`** on your own specs before the PR; **`playwright-run-reviewer`** on a
> red run; **`/fleet-bug-file`** only once Andrey has said a finding is a Fleet bug (search first).
>
> **2. Read, in order:** [README §9](README.md#9-working-a-batch-since-d) (how a batch runs, which docs move
> with the code), [§5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out),
> `playwright/CLAUDE.md` (**Test hosts**, the cleanup pipeline, the exclusive projects, **Skips**),
> [D → What landed](D-host-execution.md#what-landed-and-what-changed-from-the-plan) (scripts and installs on
> the VMs, per-run `fleet-pw-*` packages; `install-on-host.spec.ts` is the passing twin of this batch's install
> retries), [E → What landed](E-label-targeting.md#what-landed) (policies scoped by label, simulations borrowed
> onto VMs), [F → What landed](F-provisioning.md#what-landed) (`assertActivityAfter`), then this file.
>
> **3. The process, in one breath.** Run only the specs you change, on every tier they target: with
> dependencies once, headed once, `--repeat-each=5` for anything timing-sensitive, `--workers=2` on VM specs,
> `--output=<scratchpad>/<run>`. Ship in slices with the docs in the same commit. **At the end, open the PR and
> tell Andrey it's ready; he dispatches `QA — Branch run` himself.** Never overlap the nightly.
>
> **4. Free is a standing goal.** §4 lists what free can check. `shared/` when identical, a `free/` sibling when
> not, never `if (isPremium)`.
>
> **5. Ask Andrey before** anything that makes a real VM run something on a schedule, and any gitops change. The
> review's two decisions are made (below); the batch is ready to build.

---

## The review — what each flow turned out to be

Every flow body was read, not just its title (F's plan had two rows built on titles that turned out wrong).

| flow | what it actually does | decision |
|---|---|---|
| `activity-feed/individual-activity-items-for-all-attempts-for-failed-software-scripts` | a failing policy with a failing `run_script` automation on an Ubuntu VM; counts the recent *"Fleet ran errorscipt.sh"* items in Past: **3** | merged with the next row — the same behaviour |
| `policies/script-run-retries-up-to-3-times-when-triggered-by-a-policy-automation` | the same, on a Mac, with a **stateful** script that logs its attempt number on the host (and a reset script): output *"Intentional failure on attempt 3"*, 3 upcoming timestamps | **new** `policy-automation-runs` — 3 attempts, asserted as three `ran_script` activities through the API; no stateful script or reset needed. The same test goes on into the continuous case (decision 3) |
| `policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` | an `install_software` automation whose install fails: 3 upcoming *"Fleet will install"*, then *"Fleet failed to install"*, Library status *Failed* | **new** `premium/exclusive/software/deploy-install-retries.spec.ts` (decision 5) — the failure twin of `install-on-host`'s Deploy test: a per-run `fleet-pw-*` `.deb` built for amd64, which the aarch64 VM's dpkg refuses, so nothing installs, and Fleet's own `[Install software] …` policy keeps failing |
| `fleet-maintained-filters/failing-policies/confirm-script-ran-in-ui-on-failing-host-policy` | the passing counterpart: a script that succeeds runs **once** (*"attempt 1"*, one timestamp) | **cut · DUP** (decision 4) — the failing case shows the automation firing, *"Fleet ran …"* and the card; all this adds is "a success isn't retried", which is the one `scriptFailed` branch in `orbit.go` |
| `python/run-python-script-with-policy-automation-on-macos-host` | a `.py` policy automation on a Mac; ends on a screenshot of the details modal | **folded into the failing script, on the Ubuntu VM** (decisions 2 and 4): the premium Macs have no Command Line Tools, so their `python3` is Apple's install stub (D found the same; `host-run-script` runs Python on Linux). `policy-automation-runs`' script *is* a Python script |
| `policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour` | reads the Activity history QA Wolf's util accumulated over hours: bursts of 3 attempts, 30–90 min apart. Its assertion (`≥ 3` timestamps) passes after a single burst, so it never proved a re-fire | **new** `policy-automation-runs`, **refetch-driven** (decision 1): testable in minutes, and one test with the 3-attempt case (decision 3) |
| `policies/global-admin-able-to-create-and-delete-an-os-specific-policy-premium` | despite the title, **never sets a platform**: it saves the default `SELECT 1` policy named *"Mac OS Query…"*, and its check on the macOS host's Policies tab finds only the host's own name. Then deletes it | **cut · DUP** (decision 4) of round 1's policy CRUD. A platform-targeting spec would be new coverage, not migrated coverage; if it's ever wanted, it's one more policy in `policy-label-targets` (plus a free twin) |
| `policies/manage-all-automations-for-a-given-policy-at-once` | `install_software` + `run_script` + continuous saved together in the policy row's automations modal, all persisting, and the row reads *"2 automations"* | **augment** `premium/policies/policy-automations.spec.ts`, on **Workstations** with a per-run script and package (no hosts, so nothing runs), in its own describe — the existing one is serial over the global webhook config; free twin asserts what free's modal offers (§4) |
| `policies/patch-policy-fleet-maintained-apps` | adds 7-Zip (FMA) to *their* VM team, Deploy → *patch*, the "…up to date" policy exists, deletes it and the software | **new** `premium/software/patch-policy.spec.ts`, on **Workstations**, with Fleet-maintained apps **no other spec adds** — not 7-Zip, which `library.spec.ts` adds and deletes on Workstations, side by side under `fullyParallel` (one slug per spec, as `display-name` and `custom-icons` do). The Deploy selector changed since the flow was written (`SoftwareDeploySelector.tsx`); assert what each patch option stores (§ Patch policies below), not only that a policy exists |

### What the handoff had wrong

- **Retries make 3 attempts in total, not 1 + 3.** `shouldRetryPolicyAutomation{Script,SoftwareInstall}`
  (`server/service/orbit.go`) stops once `attempt_number >= MaxPolicyAutomationRetries` (3), and attempts
  number from 1: first try, then two retries — as QA Wolf's own comment says. Retrying also needs the policy
  still failing for that host (`IsPolicyFailing`), so use SQL that can't pass (`SELECT 1 WHERE 0 > 1;`).
- **The continuous script flow doesn't need an hour.** For scripts, `continuous_automations_enabled` re-fires on
  *every* failing policy result (`processScriptsForNewlyFailingPolicies`, `server/service/osquery.go`), with no
  cooldown. Results arrive hourly only because that's osquery's policy update interval, and **a refetch delivers
  one immediately**. The hourly throttle (`continuousAutomationOnCooldown`) applies only to **installs that
  succeeded**, to break an install → refetch → re-run loop.
- **The Python flow can't run on our Macs** as written (no Command Line Tools).
- **The patch flow would delete a durable VM fixture** if ported onto the VMs fleet.

### Decisions (Andrey, 2026-09-29)

1. **The continuous flow: refetch-driven, in the nightly.** On a still-failing policy with a failing script, a
   refetch queues **nothing** while continuous is off and **a new 3-attempt run** once it's on. The ~1-hour gap
   between runs is osquery's policy update interval, a config value, and isn't asserted. (Rejected: a durable
   always-failing policy in `vms.yml`, a separate ≥ 2 h project, parking it.)
2. **The Python flow: on the Ubuntu VM**, as the automation's script. No Command Line Tools go on the Mac.

### Decisions (Andrey, 2026-10-01) — the re-review against the specs beside these

3. **The failing script and the continuous case are one test.** The continuous case needs a policy that has
   already made its 3 attempts and is still failing, which is exactly the failing case; as two tests the
   3-attempt run happens twice. One test: 3 attempts → a refetch with continuous off queues nothing → on → a
   refetch → 3 new attempts.
4. **Two flows cut as DUPs.** The passing-script flow (subsumed by the failing case) and the OS-specific policy
   flow (it never sets a platform; its CRUD is round 1's). No `policy-platform-targets` spec.
5. **The failing install is its own spec, `deploy-install-retries`, in `premium-exclusive`**, the failure twin
   of `install-on-host`'s Deploy test, not a case in `policy-automation-runs`. It started as `install-on-host`'s
   second test and moved after the second branch run: a policy's installs queue at priority 0, and a failed
   install script backs orbit off for up to 5 minutes (fleetdm/fleet#54607), stalling the VM for everything else. It isn't a DUP of `inventory-reflects-install`: an install a policy queued
   retries through `shouldRetryPolicyAutomationSoftwareInstall`, a direct one through `shouldRetrySoftwareInstall`.

Net: Ubuntu VM time goes from 10 script runs + 3 installs to 6 + 3. The script test also closes round 1's
unbuilt C9 #17 (`python-run-python-script-with-policy-automation-on-linux-host`, audited as NEW,
`policy-automation-run-script.spec.ts` never written).

---

## Facts for the build

### Hosts, fixtures and cleanup

- **Scripts and installs run only on real VMs**; simulations only report runs and installs they never performed. Everything that executes here
  runs on the **Ubuntu VM** (`requireRealHost(request, 'linux')`): fastest round trip, and it has `python3`.
- **Two VM tests in all**: `policy-automation-runs`' one script test (6 script runs, 3 refetches) and
  `deploy-install-retries`' failing Deploy (3 installs), both in `premium-exclusive`. Each VM works one queue of upcoming activities, so they
  interleave with each other and with D's and E's work there; count by policy, script and title, never by
  position in the feed.
- **Scope the script policy to the Ubuntu VM.** A policy on the VMs fleet runs on all three VMs and on any
  simulation a label-targeting spec has borrowed there. Simulations pass every policy except `SELECT 0;`, but the
  Mac and Windows VMs would fail it too, and queue attempts of their own. `platform: linux` plus a manual label holding only the
  VM (`createManualLabel`). Name the policy, label, script and package `pw-*` / `fleet-pw-*`: the VMs sweep
  removes them after a dead run, and the resting-state step cancels the suite's queued scripts and installs.
  The failing Deploy's policy is Fleet's own `[Install software] …` one, scoped as the passing Deploy's is.
- **Trigger the policy with a refetch**, not the hourly run: `waitForNoPendingRefetch`, then
  `requestHostRefetch`. A refetch also re-runs policies, which is exactly what the continuous case uses.
- **A failing install** = `inertDeb(name, '1.0.0', 'amd64')`, which the aarch64 VM's dpkg refuses, so nothing is
  installed and the VM is untouched. A failed install *script* stalls orbit (#54607), which is why this one runs
  exclusive; elsewhere, fail an install with a pre-install query that returns no rows. Never use the durable fixtures in `helpers/vm-fixtures.ts`.
- **A per-run package is required, not just tidy.** Fleet caps failed policy installs at
  `MaxPolicyAutomationInstallAttempts` (10) per host and installer, in a Redis counter whose 24-hour expiry
  restarts on every failure (`installFailureLimitReached`, fleetdm/fleet#51746). A fixed package failing 3 times a
  night would stop being installed on the fourth night.
- **Script execution must be on.** `shared/exclusive/script-execution-disabled.spec.ts` turns it off, but it
  runs in the same one-worker exclusive project as `policy-automation-runs`, so never beside it, and restores it
  in the test; `cleanup-setup` turns it back on after a dead run.
- **Budget, measured:** `policy-automation-runs` 12.7 min and the failing Deploy 6.9 min, side by side on 2
  workers with `install-on-host`'s passing Deploy (2026-10-01). A script attempt is about a minute; a refetch is
  1–2 min, more when another spec's is outstanding, which is why only the first refetch waits one out. Price it
  against premium's ~56-min nightly, where D's and E's specs already queue on the same VM.
- **Continuous on leaves a policy that fires on every refetch.** Its cleanup is an `afterEach`, which runs after
  a timeout, not a `finally`, which doesn't.
- **Continuous on, and the hourly policy run.** Once continuous is on, the VM's own scheduled policy run can
  land inside the test and start one more 3-attempt run (`IsExecutionPendingForHost` stops it only while an
  attempt is pending). Assert the run the refetch started, not that nothing else ever runs.

### Asserting attempts

- **Count attempts through the API, then check the card.** Fleet's activities for these are Fleet's own
  (`ran_script` / `installed_software` with `actor_email: ""`): match by type, host and script or title, newer
  than the log's last entry before the step (`latestActivityId` → `assertActivityAfter(..., { actor: null })`).
  Identical activities from earlier runs are in the log, and the host's Activity card shows 8 per page while
  other VM specs add their own.
- **The upcoming-timestamp count** QA Wolf used is the right idea but polls the UI; the API count of finished
  attempts, plus the last attempt's status (*Script failed* / *Failed* in the Library), says the same thing
  deterministically.
- New activity copy goes in `helpers/activity-copy.ts`, with a case in `tests/api/activity-copy.spec.ts`.

### What free can check (§4)

- **Script and software automations are premium** (they need a fleet policy; `continuous_automations_enabled`,
  label targets and the patch fields are `premium:"true"` in `server/fleet/api_policies.go`). Free's automations
  are *Webhooks or tickets*.
- **The automations surface on free:** the Policies page's automation filter doesn't render
  (`ManagePoliciesPage.tsx` → `renderAutomationFilter = isPremiumTier ? …`) and the manage-automations menu offers
  no Scripts / Software / Calendar. Assert what free shows in free's `policy-automations.spec.ts`; probe the
  live page first.
- **Patch policies** are premium-only; free gets no row.

### Traps

- **Names change under state**: *Upcoming 3*, *Policies 3*, *Controls 1*. Match with a regex.
- **A missing locator waits forever**; the timed-out test's `finally` runs on a closed context. `runAction` and
  `clickVersion` now assert before clicking — keep new page-object methods that way.
- **Fleet-scoped software lists lag** (#73): the per-fleet software list refreshes hourly, so a version whose
  hosts only passed through a fleet can still be listed there. Follow a host's own software, not a fleet list's
  first row.
- **Nothing else may be using the VMs** when you run: `gh run list --limit 5` first.

### Done when

The batch's own **Done when** below, plus:

- the continuous flow is built refetch-driven (decision 1);
- every augment's free twin is checked, and the free checks above are built or their absence explained;
- anything a test creates on the VMs fleet is removed in the same test *and* covered by the cleanup;
- `playwright-test-reviewer` has been run and its findings fixed or answered; the docs in README §9's table are
  current;
- the PR is open with a *Needs you* list; Andrey runs `QA — Branch run` on it, and anything red is triaged.

---

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

## Policy automations and retries

*9 source flows → 3 new specs + 2 augments; 2 cut as DUPs.*

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/exclusive/policies/policy-automation-runs.spec.ts` | **new** — one test, in `premium-exclusive` | `policies/script-run-retries-up-to-3-times-when-triggered-by-a-policy-automation`<br>`activity-feed/individual-activity-items-for-all-attempts-for-failed-software-scripts` (a failing script: 3 attempts)<br>`policies/enabling-continuous-software-and-script-automations-on-a-policy-retries-every-hour` (refetch-driven: continuous off → no new run; on → a new 3-attempt run)<br>`python/run-python-script-with-policy-automation-on-macos-host` (the script is Python, on the Ubuntu VM) |
| `tests/e2e/premium/exclusive/software/deploy-install-retries.spec.ts` | **new**, in `premium-exclusive` | `policies/software-installs-retry-up-to-3-times-when-triggered-by-a-policy-automation` (a Deploy whose install fails: 3 attempts, then *Failed*) |
| `tests/e2e/premium/policies/policy-automations.spec.ts` | augment (+ free twin) | `policies/manage-all-automations-for-a-given-policy-at-once` |
| `tests/e2e/premium/software/patch-policy.spec.ts` | **new** | `policies/patch-policy-fleet-maintained-apps` (on Workstations, apps no other spec adds) |
| — | **cut · DUP** | `fleet-maintained-filters/failing-policies/confirm-script-ran-in-ui-on-failing-host-policy` (decision 4)<br>`policies/global-admin-able-to-create-and-delete-an-os-specific-policy-premium` (decision 4) |

**POM work:** the policies list's per-policy automations modal — `run_script`, `install_software` and the
continuous checkbox (probe the live modal: QA Wolf reached it two ways, the row's Automations cell and the
*Manage automations → Script* bulk modal); the Deploy selector's patch options for `patch-policy`.

### Patch policies

`SoftwareDeploySelector.tsx` → `getPatchPolicyFlags` is what each patch option stores on the policy, and
`DeployModal.tsx` leaves the install automation (`software_title_id`) off for manual:

| option | installs on failure | `patch_when_closed` | `notify_before_patching` | `continuous_automations_enabled` |
|---|---|---|---|---|
| *Patch when app is closed* | ✓ | ✓ | | ✓ |
| *Force patch* | ✓ | | | |
| *Force patch* + *Notify before patching* (macOS only) | ✓ | | ✓ | ✓ |
| *End user initiated (manual)* | | | | |

The server refuses the two patch flags together and `notify_before_patching` outside macOS Fleet-maintained apps
(`server/fleet/policies.go`). All of it is decided server-side, so Workstations — no hosts — answers it.

## gitops mode

*5 source flows → 2 specs.*

Runs only after every other batch is green. Its own Playwright project, one worker, with a teardown that
disables gitops mode whatever happened — an aborted run that leaves it on disables the next run's entire suite.

```ts
{
  name: 'gitops-mode',
  testDir: './tests/e2e/premium/gitops-mode',
  workers: 1,
  // Its own invocation after the exclusive step; a dependency on 'premium' would skip it whenever one
  // main-project test is red.
  dependencies: ['premium-setup'],
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

**Parked for V2, deliberately** (built in round 3's batch H, 2026-10-07, except the breadth row, cut to one
Reports pair: [GITOPS-PLAN §12](GITOPS-PLAN.md#12-v2--round-3-batch-h-2026-10-07)):

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

| target | status | notes |
|---|---|---|
| `premium/policies/policy-automations.spec.ts` | ✅ augment | a row's Automations cell → *Manage automations* on Workstations: Install software (a per-run `.deb`), Run script (a per-run script) and Continuous saved together; the API stores all three, the cell reads *Edit automations* / *2 automations*, the modal reopens on them. Its own describe, outside the serial webhook one. Green with dependencies |
| `premium/exclusive/policies/policy-automation-runs.spec.ts` | ✅ **new** — one test, **moved to `exclusive/`** after its branch run (8.5 min alone there, the exclusive step 9.2 min, green) | on the Ubuntu VM: a Python script that exits 3, run by a `SELECT 1 WHERE 0 > 1;` policy scoped by a manual label to the VM — 3 attempts (each `ran_script` with the policy's id, an empty actor and exit 3), the last opened from the host's Activity card; a refetch with continuous off queues nothing; Continuous ticked in the row's modal, the next refetch brings exactly 3 more. Cleanup in an `afterEach` (a timed-out `finally` would leave a continuous failing policy firing on every refetch). 20-min timeout. Green with dependencies and headed; 5× on 2 workers beside the failing Deploy, 10/10, 10.2–11.2 min each (12.7 min before the later refetches stopped waiting out other specs') |
| `premium/exclusive/software/deploy-install-retries.spec.ts` | ✅ **new** — started as `install-on-host`'s second test, **moved to `exclusive/`** after the second branch run | the failure twin of `install-on-host`'s Deploy test: a per-run amd64 `.deb` (the aarch64 VM refuses it) uploaded with Deploy — 3 `failed_install` attempts, each the install policy's and Fleet's, then *Failed* in the Library and *"Fleet failed to install …"* in the Activity card. Green with dependencies and headed; 5×, 5.5–7.6 min each |
| `premium/software/patch-policy.spec.ts` | ✅ **new** | Workstations, apps no other spec adds — LocalSend (macOS) and KeePassXC (Windows). macOS: Actions → Deploy → Patch walked through every option and back off, each save read back (the table above) and each reopen showing what was saved; the policy is `macOS - <title> up to date`. Windows: no *End user experience* under Force patch, and the server refuses Notify (*only available for macOS Fleet-maintained apps*) and both flags at once (*Only one of …*), 400 each. Green with dependencies, headed, 5× (one worker: copies would add the same app) |
| `free/policies/policy-automations.spec.ts` | ✅ augment (free twin) | the same modal on a free policy lists only *Send webhook or create ticket* — no install, script, profile, calendar or conditional-access rows, no Continuous; the *Filter by automation* dropdown is absent. Green with dependencies |

### Built for the batch

- `PolicyAutomationsFields` (`pages/components/`) — Fleet's shared automations fields, by their checkbox
  names (`install_software`, `run_script`, …: Fleet's `Checkbox` uses its `name` as the accessible name), the
  two react-select pickers and the Continuous checkbox. `PoliciesListPage` gains the per-policy modal:
  `automationsCell`, `openPolicyAutomations`, `savePolicyAutomations`.
- `helpers/api/policies.ts` — `createFleetPolicy` / `updateFleetPolicy` / `getFleetPolicy`, with the
  automation and patch fields; `findPatchPolicy`.
- `SoftwareDeploySelector` (`pages/components/`) — Force install, Patch, the Patch options radios and the
  macOS-only End user experience dropdown; `SoftwareTitleDetailPage.openDeploy` / `saveDeploy`.
- `playwright.config.ts` refuses projects of two tiers in one invocation: it reads only the first
  `--project`, so `--project=premium-setup --project=free-setup` had written a premium session into
  `.auth/free-admin.json`.

### Found on the way

- **A failed install script puts orbit's config loop into backoff** — 1, 2, 4, then 5 min — delaying every
  install and script queued on the host: filed as [fleetdm/fleet#54607](https://github.com/fleetdm/fleet/issues/54607)
  (released; orbit ≥ 1.58.0). Found triaging the second PR #78 branch run, where the Ubuntu VM's installs sat
  `pending` 5–10 min (three Linux specs failed); reproduced in isolation — three failed installs held a normal
  one 8.7 min. Scripts that exit non-zero don't trigger it, and nor does a failed pre-install query. So the
  failing Deploy moved to `exclusive/` too, and `inventory-reflects-install` now fails its install with a
  pre-install query instead of an amd64 package (row in `docs/blocked-by-product-bugs.md`).

- **A policy automation's runs queue below everything a user asks for.** Fleet gives fleet-initiated scripts and
  installs priority 0 and picks a host's next activity by priority before age
  (`HostScriptRequestPayload.Priority()`, `activateNextUpcomingActivity` ORDER BY `priority DESC, created_at`).
  In the PR #78 branch run, `policy-automation-runs`' continuous-run retry was queued at 20:28:19 and the VM then
  ran five later-requested installs and uninstalls first; the test gave up at its 6-min settle and passed on the
  CI retry, and the run took 53.5 min against the nightly's 43.4 (Linux VM test-minutes 36.9 → 73.3). By design,
  so the spec moved to `premium/exclusive/`: alone after the main project, on idle VMs. With the failing Deploy
  there too, the exclusive step measures 13.2 min; its CI global timeout went 15 → 60 min (each VM spec retried
  once), the job's limit 135 → 185.

- **`findFmaIdBySlug` read one page of 500**, and the 4.93 catalog holds 1,424 entries: any slug past the first
  page threw "No Fleet-maintained app found". Every spec so far had used apps early in the alphabet. It pages now.

- **Free's per-policy modal says "…policy on All fleets"** (and *Not enabled for All fleets*), copy from
  premium; free has no fleets. Cosmetic; not filed.
