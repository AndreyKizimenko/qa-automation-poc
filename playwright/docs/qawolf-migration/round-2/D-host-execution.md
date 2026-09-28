# Batch D — Execution on hosts

**31 source flows → 9 specs.** `Script execution and MDM commands` · `Software install / uninstall`

> ## ▶ Start here — handoff, 2026-09-28
>
> Batches A, B, C and gitops-mode V1 are **merged** (PRs #61, #62); `main` is at the #62 merge. D is next and
> is **not blocked on anything** — the real VMs are up and the Fleet-maintained app shelf is provisioned.
>
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it — it carries the locator
> priority, POM rules, Fleet-specific traps and the verification bar. `CLAUDE.md` calls it auto-invoked; do
> not rely on that.
>
> Then read, in order: [README.md](README.md) (standing rules, the real-VM rules, the batch table),
> `playwright/CLAUDE.md` (suite contract, especially **Test hosts**), then this file.
>
> Andrey has asked for three things to be designed, not just ported. They are the substance of this batch —
> the source-flow table below is the floor.

---

### 1. A durable FMA fixture set — design this before writing install tests

`gitops/premium-fleetqa/fleets/qa.yml` parks **10 apps × macOS/Windows on the QA fleet (id 102)**, permanently,
because Fleet's catalog publishes exactly one version per app and only the hourly
`maintained_apps_auto_update` cron accumulates an n-1 build. `cleanup.steps.ts` wipes Unassigned and
Workstations and touches no other fleet, which is what makes the shelf durable.

**Andrey wants this extended into a fleet that holds FMAs in deliberately different states** — some pinned,
some tracking latest, some already installed on a host, some deliberately behind — so update/pin/install
behaviour has stable subjects instead of whatever a previous run left behind. Design that: which states, on
which fleet, provisioned how, and what keeps them in those states over weeks.

Two hard constraints, both verified:

- **A literal pin freezes that title's auto-update.** `ee/server/service/maintained_apps_auto_update.go`
  early-returns when `pin != "" && !strings.HasPrefix(pin, "^")`. A caret pin (`^major`) keeps updating; an
  exact pin does not. So "a permanently pinned app" and "an app that accumulates versions" cannot be the same
  title.
- **A stranded pin is a live hazard.** `version-pinning.spec.ts` clears its pin in a `finally` and asserts on
  entry that it inherited an unpinned title — but **Playwright aborts a timed-out test before its `finally`
  runs** (found empirically this session; it stranded a fleet). The robust home for the restore is
  `setup/cleanup.steps.ts`, which already self-heals state however it got there — as a narrow, commented
  exception that **unpins only, never deletes**, since that project deliberately touches nothing on QA today.

### 2. Scripts — prove the script *did* something

Asserting exit status and the activity feed is not enough. Andrey wants a script whose effect is
**independently observable**, then verified through a saved report against the same host. That gives one flow
covering script execution + the activity feed + host report results, and it deepens report coverage at the
same time.

File creation is the obvious lever but not the only one, and it may not be the best — pick something a report
can read cleanly and that leaves the VM no worse off. Whatever it is, it must be **idempotent and reversible**:
these are the three real VMs per tier and there is no re-provisioning automation.

**Failing scripts need covering too** — an intentionally failing script, asserting the activity is correct and
that the script list and details modal render the failure properly. Check whether QA Wolf covered this before
designing from scratch; `controls/error-script-fails-in-ui-*` and `controls/script-timeout-*` are in the
source table below.

### 3. Software — the update path, not just install/uninstall

Beyond install → verify → uninstall, Andrey wants the **Update** button exercised against an app that is
*always installed* on the VM. **Claude is the suggested subject because the shelf carries it on both macOS and
Windows.** The contract to assert:

- the Update button is offered **only** when the available version is higher than the installed one;
- when installed == available, **no** Update button;
- after updating and a refetch, installed and available **match**.

That is a real product contract and nothing covers it today.

### 4. A wait-for-refetch helper

Host actions depend on refetch, and a software install triggers one automatically — the tests just have to
wait for it. That is the same wait in several specs across this batch, so build it once: a helper (or fixture)
that waits for a host's vitals to be re-collected. `getHostDetailUpdatedAt` already exists and
`host-details-smoke` proves the refresh through `detail_updated_at` rather than a relative-time string —
start there rather than polling UI copy.

### Traps this batch will hit

- **`>1 GB installer` needs a decision before it is built** (2 source flows). Generating a gigabyte and pushing
  it through the browser upload path is not the same problem as `Buffer.alloc` against an API endpoint, and the
  assertion is about a progress affordance, not the limit. Raise it rather than guessing.
- **Deleted simulations never come back.** osquery-perf enrols once at startup; the pool is only repopulated by
  the daily refresh in `tools/perf-hosts/`. Budget deletions.
- **premium-fleetqa is a 2 GB Render box.** Large software batches have 502'd it three times. Stage uploads;
  a batch is all-or-nothing.
- **Never assert an absolute count on a shared list.** Two specs were fixed for this in one day; sibling specs
  delete and transfer hosts while yours runs.
- **Never deploy a passcode profile to a real host** — permanent lockout, no re-provisioning. See
  [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).
- **Free coverage is a standing goal.** Ask per flow whether free has the same surface; `shared/` when
  identical, an explicit `free/` sibling when not, never `if (isPremium)`.
- **The nightly runs at 05:00 (gitops) and 05:30 UTC (Playwright).** Don't let a long verification run overlap.
- **`fleetctl` must match the server's minor version.** The suite ran 4.85.1 against 4.93 for two months and it
  silently no-op'd a whole gitops `software:` section.

### Done when

The batch file's own **Done when** applies, plus: the FMA fixture design is written down where the next person
finds it (a section in this file or a sibling doc), and anything it provisions is in `gitops/`, not seeded per
run.

---

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

Real round-trips to real hosts: run a script and read the result, send an MDM command, install a package and
watch it land in inventory, then uninstall it. The slowest UI flows we have, and the ones most likely to flake
if written naively.

**This batch contains the single biggest consolidation in round 2.** Eight script-execution files — four
behaviours × free and premium, differing only in which host they target — become one `shared/` spec with the
behaviour as a dimension.

### Hosts for this batch

Use the **real VMs**, not the simulations. Resolve them at run time —
`findOnlineHost(request, platform, { kind: 'real' })`, the `vmsFleetId` worker fixture for the premium VMs
fleet, `liveMacosHost` for a macOS one — never by stored name or id. Simulations ignore live-query SQL, return
no rows ~20% of runs and never install anything, so a green assertion against one proves nothing about the
feature.

> **⚠️ Never deploy a passcode profile to a real host.** It blocks access permanently, there is no recovery,
> and there are only a few VMs per tier. No `com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
> `maxInactivity` or `allowSimple` — nor screen lock, inactivity timeout, FileVault, login-window restrictions,
> or anything disabling SSH / remote management / the MDM channel. `fleet-test-passcode.mobileconfig` is one of
> these: safe in the library lifecycle where round 1 uses it, never safe to deliver. See
> [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).

## Script execution and MDM commands

*17 source flows → 5 specs.*

Run a script on a host and assert what comes back — success, failure, timeout, the details modal, the
activity feed — plus MDM commands, which are the same shape over a different transport.

**The tier collapse is the win.** Fleet's run-script flow is identical on free and premium, so eight source
files land in one `shared/` spec with the behaviour as the dimension.

**Drop every `toHaveScreenshot`.** Five of these snapshot the run-script details modal. Assert the status text
and the script output instead — a snapshot tells you something changed, never what, and it fails on font
rendering.

**Budget the runs.** Each execution is a real round-trip. Keep the interpreter cases (`.sh`, `.zsh`, `.py`) as
a parameterised list over one flow, not three specs.

**POM work:** new `RunScriptModal`, `ScriptDetailsModal`, `MdmCommandDetailsModal` component objects;
`HostDetailsPage` — Actions → Run script entry, Upcoming/Past activity tabs filtered by name;
`ScriptsLibraryPage` — batch-run entry and target selection.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/controls/scripts/batch-run.spec.ts` | **new** | `controls/batch-script-execution-on-hosts`<br>`controls/batch-script-on-hundreds-of-hosts` |
| `tests/e2e/shared/controls/scripts/script-execution-disabled.spec.ts` | **new** | `controls/disable-script-execution-free [FREE]`<br>`controls/disable-script-execution-premium` |
| `tests/e2e/shared/hosts/host-run-script.spec.ts` | **new** | `controls/error-script-fails-in-ui-free [FREE]`<br>`controls/error-script-fails-in-ui-premium`<br>`controls/script-timeout-free [FREE]`<br>`controls/script-timeout-premium`<br>`controls/scripts-execution-free [FREE]`<br>`controls/scripts-execution-premium`<br>`python/run-python-script-on-macos-host`<br>`software/run-zsh-scripts`<br>`uncategorized/succeeded-ran-script-on-host-does-not-show-pending-when-modal-is-closed` |
| `tests/e2e/premium/hosts/mdm-commands.spec.ts` | **new** | `mdm/mdm-command-details-show-on-global-and-host-activity`<br>`mdm/past-and-upcoming-host-activities-add-mdm-commands-macos-ios-ipados`<br>`mdm/run-mdm-command-macos-premium` |
| `tests/e2e/free/hosts/mdm-commands.spec.ts` | **new** | `uncategorized/run-mdm-command-macos-free [FREE]` |

## Software install / uninstall

*14 source flows → 4 specs.*

Upload an installer, install it on a host, verify it lands in inventory, uninstall it, verify it is gone.

**Platform is a dimension, not a spec.** QA Wolf wrote macOS / Windows / Linux as three files and the four
uninstall types as four more. One `install-on-host` spec with a platform × package-type case list and one
`uninstall-from-host` spec replace seven files, and a new package type becomes a one-line change.

**The >1 GB case needs a decision before it is built.** Generating a gigabyte at run time and pushing it
through the browser upload path is not the same problem as `Buffer.alloc` against an API endpoint — it is slow,
memory-hungry, and the assertion (a progress indicator appears and does not time out) is about the UI, not the
limit. Options: generate to a temp file and upload once per run, assert the progress affordance against a much
smaller file and cover the true size limit via API, or park it. **Raise this in review rather than guessing.**

**This batch flakes if written naively.** Install-status polling, host-vitals refetch lag and the
`file-progress-modal` all need web-first assertions with generous but bounded timeouts — never
`waitForTimeout`.

**POM work:** `SoftwareInstallerCard` — install/uninstall status accessors; new `UninstallDetailsModal`;
`HostDetailsPage` software tab — install and uninstall actions.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/software/install-on-host.spec.ts` | **new** | `policies/global-activity-item-is-shown-when-a-policy-is-automatically-created-during-software-installer-add`<br>`software/install-software-through-fleet-maintained-page`<br>`software/software-installers-add-software-installers-linux`<br>`software/software-installers-add-software-installers-macos`<br>`software/software-installers-add-software-installers-windows` |
| `tests/e2e/premium/software/uninstall-from-host.spec.ts` | **new** | `software/failing-uninstall-keeps-installed-files-and-statuses`<br>`software/uninstall-software-packages-debs`<br>`software/uninstall-software-packages-exe`<br>`software/uninstall-software-packages-msi`<br>`software/uninstall-software-packages-pkgs` |
| `tests/e2e/premium/software/inventory-reflects-install.spec.ts` | **new** | `software/pending-and-failed-software-should-not-show-in-inventory-tab`<br>`software/software-newly-installed-software-is-available-on-the-inventory-tab` |
| `tests/e2e/premium/software/large-upload.spec.ts` | **new** | `software/progress-indicator-appears-without-timeout-during-upload-of-large-software`<br>`software/software-installer-file-over-1gb` |

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
