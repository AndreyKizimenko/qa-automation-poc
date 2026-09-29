# Batch F — Provisioning-gated

**13 source flows → 9 specs.** `Provisioning-gated`

> ## ▶ Start here — handoff, 2026-09-29
>
> A–D and gitops-mode V1 are all on `main` (#61, #62, #63). **Branch from `main`.** F can run before, after or
> beside E — they touch different surfaces — but not *at the same time as another run on the same instance*
> (README §9).
>
> **Invoke the `playwright-test-author` skill first** (Skill tool) and follow it. Then read, in order:
> [README.md §9](README.md#9-working-a-batch-since-d) — **how batches run since D: which skills, how much to
> run, which docs move with the code** — then README §5 (never lock a VM), `playwright/CLAUDE.md` (**Test
> hosts**, the cleanup pipeline), then this file.
>
> **The three rules this handoff adds most to:** run only the specs you changed until the end (§9); keep this
> file, DELIVERY-LOG and the test-audit entries current in the same commits; run `playwright-test-reviewer` on
> your own work before the PR, and the full suite once, on CI, at the end.

---

### 1. What's actually blocked — checked live, 2026-09-29

The batch's premise is "waiting on something to exist". Most of it isn't:

| rows | status | evidence |
|---|---|---|
| technician transfer (augment `host-transfer-permissions.spec.ts`) | **ready** | static user `global-technician@fleetdm.com` exists, global role technician |
| team-admin edits a member · edits the team name | **ready — one decision (§2)** | static user `team-admin@fleetdm.com` is admin on **Workstations** and **VMs** |
| host IdP username, UI + API (`host-idp-username.spec.ts`) | **ready** | the host's User card has *Update end user* (`UpdateEndUserModal`); the API is `PUT /api/v1/fleet/hosts/:id/device_mapping` |
| manual MDM enrollment profile, premium + free | **ready — confirm the path** | the download lives in the Add hosts modal (`AddHostsModal/PlatformWrapper`); a download only — never install it anywhere |
| MFA ×3 (`mfa.spec.ts`) | **blocked** | `smtp_settings.configured` is **false** on both tiers; the magic link needs SMTP *and* a mailbox the suite can read (Mailpit or a catch-all) |
| `.rpm` install on Fedora | **blocked** | no Fedora / RHEL host is online on either tier |
| recovery lock ×2 | **decision** | the UI exists — host actions, `RecoveryLockPasswordModal`, Controls → OS settings → *Passwords* — the question is the act, §3 |

**Ask Andrey the three open questions before building those rows** — the team-rename approach (§2), whether
SMTP + a mailbox get provisioned or the MFA flows park, and the recovery-lock act (§3). Build the ready rows
meanwhile. A parked row gets a reasoned note in this file (and a `TODO.md` row if it's env-gated) — never a
silent skip.

### 2. The team-admin flows edit a gitops-provisioned fleet

`team-admin` is admin on Workstations and VMs, and both are **declared by name in gitops**. Renaming one is not
self-healing: the next apply finds no fleet by the declared name and **creates a new, empty one**, leaving the
renamed fleet — with its hosts, fixtures and every spec's `workstationsFleetId` / `vmsFleetId` — orphaned.
A timed-out test never reaches its `finally`.

- **Never rename VMs.** Its real hosts and durable fixtures are what D's specs stand on.
- For the rename flow, pick one with Andrey: rename Workstations and restore it in the same test **plus** a
  restore step in `cleanup-setup` (find the fleet by id, rename it back); or a dedicated throwaway fleet,
  declared in gitops for this spec only. The second is cleaner; it's his call because it adds a fleet.
- "Edit a team member" should edit a user the test creates on Workstations, not a static user — the static
  users' credentials are shared with CI and can't be re-minted (`playwright/CLAUDE.md` → Env vars).

### 3. Recovery lock: build the permission surface, park the act

Same call as Lock / Wipe in round 1 ([PARITY §6](../PARITY.md#6-lock-and-wipe-gated-not-ignored)): assert who
can see and reach the action across roles and platforms, and write down why the act is parked — unless Andrey
decides otherwise.

**Never turn on Recovery Lock password enforcement for the VMs fleet.** The *Passwords* card sets it per
fleet, and on the VMs fleet it would set a Recovery Lock password on the real macOS VM — the class of thing
README §5 forbids. The settings UI can be exercised on Workstations, restored in the same test.

### 4. Hosts for the ready rows

- **IdP username is server-side data** — Fleet stores it; the host isn't involved. A simulation is the right
  host for it (README §9 → *Server-side vs host-side*), so a real VM's end-user mapping is never touched.
  Remove what the test sets, in the same test.
- **Host transfer** moves a host between fleets: use a simulation, never a real VM — the VMs fleet's fixtures
  and policies are what its hosts are there for. Round 1's transfer specs show the pattern.

### Traps this batch will hit

- **Don't run the full suite while you build** — README §9. Your specs, every tier they target, with deps
  once; the full suite once, at the end, via `QA — Branch run`.
- **Nothing else may be using the instance** when you run: `gh run list --limit 5` first; stay clear of the
  nightly (05:00–~06:30 UTC).
- **Role specs multiply.** One spec with the role as a dimension, not a file per role (README §1).
- **A missing locator's `click()` has no action timeout** — probe it first; the `finally` runs on a closed
  context when it hangs.

### Done when

The batch's own **Done when** below, plus:

- every ready row is green on each tier it targets; every blocked or decided-to-park row has its reasoning here;
- nothing a test renames or edits is left changed — the cleanup restores what a dead test couldn't;
- `playwright-test-reviewer` has been run on the batch's specs and page objects, and its findings fixed or
  answered;
- the docs in README §9's table are current — this file's *What landed*, DELIVERY-LOG, and a test-audit entry
  for every new test (the audit README's counts too);
- the full suite ran once via `QA — Branch run` on the branch, and anything red is triaged
  (`playwright-run-reviewer`) and fixed, skipped behind a filed bug, or explained in the PR.

---

Read [README.md](README.md) first for the standing rules and how a batch runs. Source flows live in
`qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>` — the paths below are relative to that.

---

Everything whose blocker is an instance fact rather than a test-design problem. Nothing here is hard to write
— it is waiting on something to exist.

**Check before you assume.** Three of these are probably not blocked at all: we already have
`global-technician` and `team-admin` static users. Round 1's most expensive lesson was a plan document
asserting infrastructure that no longer existed, when one API call would have settled it.

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

## Provisioning-gated

*13 source flows → 9 specs.*

Split by what unblocks each one:

| needs | specs |
|---|---|
| a readable mailbox (Mailpit or a catch-all domain) | the 3 MFA flows |
| a Fedora host online | the RPM install case |
| `Username (IdP)` control confirmed present | the 2 IdP specs |
| a decision on destructive rotation | the 2 recovery-lock specs |
| **nothing — the static user already exists** | technician transfer, the 2 team-admin flows |

**Recovery lock: build the permission surface, park the act.** Rotating the recovery lock on a real
MDM-enrolled mac is a one-way door on a VM we have three of and no re-provisioning automation. Same call as
Lock/Wipe in round 1 ([PARITY §6](../PARITY.md#6-lock-and-wipe-gated-not-ignored)): assert who can see and
reach the action across roles and platforms, and write down why the act itself is parked.

**POM work:** new `helpers/mailbox.ts` for magic links; `HostDetailsPage` — end-user / IdP card.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/hosts/host-idp-username.spec.ts` | **new** | `api/update-mac-host-idp-username-via-api`<br>`idp/update-and-remove-host-idp-username-via-ui` |
| `tests/e2e/premium/hosts/recovery-lock.spec.ts` | **new** | `mac-os-accounts/automatically-rotate-recovery-lock-password`<br>`mac-os-accounts/set-plus-manually-rotate-macos-recovery-lock-passwords` |
| `tests/e2e/premium/hosts/manual-mdm-enrollment.spec.ts` | **new** | `mdm/manual-mdm-enrollment-mac-enrollment-profile` |
| `tests/e2e/free/hosts/manual-mdm-enrollment.spec.ts` | **new** | `mdm/manual-mdm-enrollment-mac-enrollment-profile [FREE]` |
| `tests/e2e/premium/software/install-on-host.spec.ts` | **new** | `software/install-and-delete-rpm-files-on-rpm-based-linux-hosts-fedora` — *since D's follow-up (2026-09-28) install/uninstall on a VM lives in `software-lifecycle-on-host.spec.ts`, on durable `vms.yml` fixtures; an `.rpm` would be a new fixture there, with a Fedora VM* |
| `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` | augment | `technician-user/technician-role-can-transfer-hosts-between-fleets` |
| `tests/e2e/premium/settings/users/mfa.spec.ts` | **new** | `uncategorized/created-2fa-enabled-user-cannot-re-use-sign-in-magic-link`<br>`uncategorized/global-admin-is-able-to-edit-user-to-use-2fa`<br>`uncategorized/invite-2fa-enabled-user-and-log-in-as-the-user` |
| `tests/e2e/premium/settings/users/team-admin-scope.spec.ts` | **new** | `user-profiles/team-admin-able-to-edit-a-team-member-premium` |
| `tests/e2e/premium/settings/team-settings.spec.ts` | **new** | `user-profiles/team-admin-able-to-edit-team-name-premium` |

---

## Done when

- every target spec above exists and is green on each tier it targets;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md)
  or a reasoned note in this file — never a silent skip.
