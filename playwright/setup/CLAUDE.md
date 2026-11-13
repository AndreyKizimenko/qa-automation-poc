# setup/ — login and the cleanup projects

This file loads when work happens under `setup/`. Everything in `playwright/CLAUDE.md` still applies: its
*Project pipeline* section says, in short, what the cleanup projects wipe and what they leave, which is what
a spec author needs. This is the detail, for whoever changes `cleanup.steps.ts` or a setup spec.

## What `cleanup-setup` and `cleanup-teardown` do

Both run `setup/cleanup.steps.ts`, as a dependency of each main project and as its teardown.

Wipes unassigned state (queries, policies — global ones and Unassigned's own, deleted before its software and scripts, since Fleet refuses to delete a title or script a policy automation uses — packs, installable software, profiles, scripts on `fleet_id=0`, and the test users a dead run left: `qa-test-*` addresses and `QA API <label> <stamp>` API-only users) plus MDM setup-experience entities, and on Workstations its policies, installable software, profiles, scripts, setup experience and OS-update settings, returning to Unassigned any simulation a dead run left staged there — but **not its reports**, which gitops declares, beyond the copies specs save there by exact prefix (`pw-role-`, `Copy of playwright-saveasnew-`): a spec that puts a report on Workstations deletes it itself, and adds its prefix to that sweep. On premium it also removes throwaway `pw-*` fleets, and on both tiers any test-added (`pw-enroll-`) global enroll secret and any `PW_VAR_*` custom variable (after the scripts, since Fleet refuses to delete a variable a script references). `pw-*` labels are swept on premium only, inside the VMs-fleet step, so a free spec deletes its own. Self-heals the instance regardless of how state got there (Playwright leftovers, manual UI uploads, gitops-blind items). It does **not** reset disk encryption or the BitLocker PIN, `end_user_local_account_type`, the global macOS migration settings or the global end-user authentication (IdP) settings: no spec saves the IdP settings (Test hosts → *Ask before any of these, too*), and a spec that writes one of the others restores it in an `afterEach`, or works on a throwaway `pw-*` fleet.

The `free` project runs the **same cleanup chain as premium** — `dependencies: ['free-setup', 'cleanup-setup']` and `teardown: 'cleanup-teardown'`. Only the fleet steps inside `cleanup.steps.ts` are missing on free (fleets are premium-only): Workstations, the `pw-*` fleet sweep, the version-pin clear and the VMs-fleet sweep with its `pw-*` labels. They are declared with `premiumStep`, which declares nothing on free, so a free report's skipped count is tests only. `wipe unassigned state`, the enroll-secret sweep and the VM resting state run on both, and `deleteAllQueries` is global. **Do not plan a free spec around "nothing wipes this on free"** — global reports, policies, packs, installable software, profiles and scripts are all wiped on free too.

`cleanup-setup` also turns script execution back on: the exclusive projects turn it off, a teardown project
doesn't run on a `SIGKILL`, and a run killed mid-spec would otherwise leave every script spec of the next run
failing.

On premium it sweeps the VMs fleet for what the host-execution specs leave there when a test dies: `fleet-pw-*` titles and `pw-*` policies, scripts, profiles and labels by prefix, but reports only by exact prefix (`pw-run-script-`, `pw-rl-`, `pw-stored-results-`), because gitops declares `pw-host-report-results` on that fleet. A spec that leaves a new kind of per-run report there adds its prefix to that sweep. Deleting a software title cancels its pending installs and script runs, so a per-run package deleted in an `afterEach` also clears that VM's queue. Deleting a title never uninstalls it, though, so when the Ubuntu VM's inventory lists a `fleet-pw-*` package the sweep queues a `dpkg --purge` for it.

On premium it also clears any version pin on the QA and VMs fleets' Fleet-maintained apps, never deleting them: an exact pin a timed-out test leaves behind stops Fleet's hourly auto-update for that title, and with it the version history the pinning and update specs read.

It also brings the real VMs to their resting state before the first test and after the last: it cancels the
suite's own queued installs and scripts, resets the script timeout to Fleet's default, and on premium
returns every durable fixture to rest — uninstalled, with no failed install or uninstall on record, which
Fleet otherwise keeps as the title's status and which the Library then offers as Retry or Reinstall instead of
Install. A VM that's offline is only logged — its specs fail on it with their own message.

`cleanup-setup` also turns gitops mode off: a teardown project doesn't run on a `SIGKILL`, and a stuck flag
disables the next run's entire suite (`tests/e2e/premium/gitops-mode/CLAUDE.md`).

The `loadtest` project depends only on `loadtest-setup`; `loadtest-api` depends on nothing (it sends the bearer token from `FLEET_API_TOKEN`, logging in with the admin credentials when that token is stale). Each project's setup chain is otherwise independent — no cross-project sharing.

## Changing a sweep

- The sweeps find the suite's own things by name. `ownName(kind)` opens every name with `pw-<kind>-`, so a
  sweep by the `pw-` prefix takes them, and one by an exact prefix takes that kind. A new name shape and the
  sweep that has to find it change in one commit.
- A sweep throws when it can't list or delete (`deleteEach`); only the fleet and enroll-secret marker sweeps
  log instead, because failing `cleanup-setup` over a stray one would skip the whole run.
- Every step is self-healing: it removes what it finds however it got there, a person's hand-added leftover
  included. A step that fails on such a leftover is a cleanup bug to fix here, not an instance to clean by hand.
