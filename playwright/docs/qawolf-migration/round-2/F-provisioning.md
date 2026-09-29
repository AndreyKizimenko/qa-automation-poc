# Batch F — Provisioning-gated

**13 source flows → 9 specs.** `Provisioning-gated`

> ## ▶ Start here — handoff, refreshed 2026-09-29 after E
>
> A–E and gitops-mode V1 are on `main` (#61, #63, #65). **Branch from `main`**, and check nothing else is
> running on the instances (`gh run list --limit 5`) before any run that touches them.
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
> **2. Read, in order:** [README §9](README.md#9-working-a-batch-since-d) (how a batch runs: how much to run,
> which docs move with the code, the patterns E added), [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out)
> (never lock a VM), `playwright/CLAUDE.md` (**Test hosts**, the cleanup pipeline, the exclusive projects,
> **Skips**), [E-label-targeting.md → What landed](E-label-targeting.md#what-landed) (the newest patterns:
> simulations borrowed onto a fleet, cleanup homes for a timed-out test), then this file.
>
> **3. The process, in one breath.** Run only the specs you change, on every tier they target: with
> dependencies once, headed once, `--repeat-each=5` for anything timing-sensitive, `--workers=2` on VM specs,
> `--output=<scratchpad>/<run>`. Ship in slices, with the docs in the same commit (README §9's table:
> this file's *What landed*, DELIVERY-LOG, a test-audit entry per `test()` plus the audit README's counts,
> helpers/pages READMEs). **At the end, open the PR and tell Andrey it's ready. He dispatches the full
> `QA — Branch run` himself**; don't start one, and never overlap the nightly.
>
> **4. Free is a standing goal. QA Wolf's free export has one flow in this batch**, so the free checks are
> yours to find. §5 lists what Fleet's source says free can assert for every row. `shared/` when the
> behaviour is identical, an explicit `free/` sibling when it isn't, never `if (isPremium)`.
>
> **5. Ask Andrey before** the three decisions in §1, anything delivered to or set on a real VM, any gitops
> change, and any rename of a fleet gitops declares.
>
> Facts below were re-checked against both live instances on 2026-09-29, after E merged.

---

### 1. What's actually blocked — re-checked live, 2026-09-29

The batch's premise is "waiting on something to exist". Most of it isn't:

| rows | status | evidence |
|---|---|---|
| technician transfer (augment `host-transfer-permissions.spec.ts`) | **ready** | static user `global-technician@fleetdm.com`, global role technician (premium only: free has no technician user and no fleets) |
| team-admin edits a member · edits the team name | **ready, one decision (§2)** | static user `team-admin@fleetdm.com` is admin on **Workstations** and **VMs** |
| host IdP username, UI + API (`host-idp-username.spec.ts`) | **ready** | the host's User card has *Update end user* (`UpdateEndUserModal`), shown to admins and maintainers on either tier; the API is `PUT /api/v1/fleet/hosts/:id/device_mapping`, and `DELETE …/device_mapping/idp` removes it |
| manual MDM enrollment profile, premium + free | **ready; confirm the path** | the download lives in the Add hosts modal (`AddHostsModal/PlatformWrapper`). A download only: never install it anywhere |
| MFA ×3 (`mfa.spec.ts`) | **the magic-link half is blocked; the rest is buildable (§5)** | `smtp_settings.configured` is **false** on both tiers; the magic link needs SMTP *and* a mailbox the suite can read (Mailpit or a catch-all) |
| `.rpm` install on Fedora | **blocked** | no RPM-based host is online on either tier (303 online each; the real VMs are Ubuntu 26.04, Windows 11, macOS 26.6) |
| recovery lock ×2 | **decision** | the UI exists: host actions, `RecoveryLockPasswordModal`, Controls → OS settings → *Passwords*. The question is the act (§3) |

**Ask Andrey the three open questions before building those rows:** the team-rename approach (§2), whether
SMTP and a mailbox get provisioned or the magic-link flows park, and the recovery-lock act (§3). Build the
ready rows meanwhile. A parked row gets a reasoned note in this file (and a `TODO.md` row if it's env-gated),
never a silent skip.

### 2. The team-admin flows edit a gitops-provisioned fleet

`team-admin` is admin on Workstations and VMs, and both are **declared by name in gitops**. Renaming one doesn't
heal itself: the next apply finds no fleet by the declared name and **creates a new, empty one**, leaving the
renamed fleet (with its hosts, fixtures and every spec's `workstationsFleetId` / `vmsFleetId`) orphaned. A
timed-out test never reaches its `finally`.

- **Never rename VMs.** Its real hosts and durable fixtures are what D's and E's specs stand on.
- For the rename flow, pick one with Andrey: rename Workstations and restore it in the same test, **plus** a
  restore step in `cleanup-setup` (find the fleet by id, rename it back); or a dedicated throwaway fleet,
  declared in gitops for this spec only. The second is cleaner; it's his call because it adds a fleet.
- "Edit a team member" should edit a user the test creates on Workstations, not a static user. The static
  users' credentials are shared with CI and can't be re-minted (`playwright/CLAUDE.md` → Env vars).

### 3. Recovery lock: build the permission surface, park the act

Same call as Lock / Wipe in round 1 ([PARITY §6](../PARITY.md#6-lock-and-wipe-gated-not-ignored)): assert who
can see and reach the action across roles and platforms, and write down why the act is parked, unless Andrey
decides otherwise.

**Never turn on Recovery Lock password enforcement anywhere a real Mac can receive it:**

- **premium:** not on the VMs fleet. The *Passwords* card sets it per fleet, and on VMs it would put a
  Recovery Lock password on the real macOS VM, the class of thing README §5 forbids. Exercise the settings UI
  on Workstations (no hosts) and restore it in the same test.
- **free:** not at all. `mdm.enable_recovery_lock_password` is in free's **global** config too, and free's
  real VMs sit in Unassigned, so the global setting reaches the free Mac. On free the *Passwords* card shows
  the premium message instead (`Passwords.tsx` → `PremiumFeatureMessage`); assert that, and nothing else.

### 4. Hosts for the ready rows

- **IdP username is server-side data.** Fleet stores it; the host isn't involved. A simulation is the right host
  for it (README §9 → *Server-side vs host-side*), so a real VM's end-user mapping is never touched. Pick it
  with `findSimulations` (the non-MDM pool, on its own slice; register the slice in `helpers/api/hosts.ts`), and
  remove what the test sets in the same test.
- **Host transfer** moves a host between fleets: use a simulation, never a real VM. The VMs fleet's fixtures
  and policies are what its hosts are there for. Round 1's transfer specs show the pattern, and the VMs sweep
  in `setup/cleanup.steps.ts` returns a borrowed simulation that a dead run left behind.
- **Manual enrollment** needs no host: it's a download. Assert the file (a `.mobileconfig` with the MDM
  payload and this instance's server URL), never open or install it.

### 5. What free can check — every row, from Fleet's source

QA Wolf ran this batch on premium only, except the enrollment profile. Grounded in the source at the 4.93 RC;
**probe each on the live free instance before building** (Playwright MCP, or the page object against
`--project=free`):

| row | free has | free check |
|---|---|---|
| IdP username | the *Update end user* control on the User card (role-gated, not tier-gated); server-side, a `custom` device mapping works on free, but `source: "idp"` is **premium-only** (`SetHostDeviceMapping` → license check) | a `free/` sibling: set and clear a custom end-user email in the UI; and a free API check that an `idp` mapping is refused with the license error |
| MFA | no *Enable two-factor authentication (email)* checkbox (`UserForm.tsx` shows it on premium, or if already set); `PATCH /users/:id` with `mfa_enabled: true` returns **402** (`ErrMissingLicense`) | the checkbox is absent on create and edit; the API refuses |
| recovery lock | the *Passwords* card renders `PremiumFeatureMessage` | a row in `tests/e2e/free/paywalls.spec.ts` |
| manual enrollment | the same download | already a `free/` row in the table below |
| technician, team-admin | nothing: no technician role user, no fleets | none; say so in the audit entry |

**The MFA rows that need no SMTP** (premium), build these now: creating a 2FA user with SMTP unconfigured is
refused with *"Email must be set up to enable Fleet MFA"* (`errMailerRequiredForMFA`), and turning on 2FA for
an SSO user is refused with Fleet's conflict message. Note that the conflict message reads *"Fleet MFA is **is**
not applicable to SSO users"*: a copy bug. Assert today's copy with a `TODO`, and raise it with Andrey rather
than filing it yourself. Only the magic-link login flows wait for the mailbox.

### Traps this batch will hit

- **Don't run the full suite while you build** (README §9). Premium is now ~56 min in CI (3 workers), free ~10.
- **Nothing else may be using the instance** when you run: `gh run list --limit 5` first. The nightly,
  `QA — Nightly`, takes about 1.5 h and is scheduled for 03:00 UTC, but GitHub starts it 4–6.5 h late.
- **Role specs multiply.** One spec with the role as a dimension, not a file per role (README §1).
- **A missing locator waits forever.** `click()`, `fill()`, `innerText()` and `getAttribute()` have no timeout
  of their own, so the test hangs to its timeout and its `finally` then runs on a closed context: its cleanup
  silently doesn't happen. Probe first, and give anything a dead test leaves a cleanup home.
- **Names change under state.** A tab's accessible name gains a count (*Controls 1*, *Policies 3*,
  *Upcoming 1*), a form field's label is replaced by its error text, and row actions are hover-revealed
  (`clickHoverAction`). Match with a regex and ground it in the component.
- **Users lists page, and the static users crowd them.** Act on a row after a search that narrows to it
  (`findRowByEmail`), never by scanning page 1.
- **Settings you change are global.** Snapshot and restore inside the test (`helpers/api/config.ts`), and
  anything that flips a switch other specs rely on goes under `tests/e2e/<tier>/exclusive/`.

### Done when

The batch's own **Done when** below, plus:

- every ready row is green on each tier it targets, and its free check (§5) is built or its absence explained;
- every blocked or decided-to-park row has its reasoning here;
- nothing a test renames or edits is left changed: the cleanup restores what a dead test couldn't;
- `playwright-test-reviewer` has been run on the batch's specs and page objects, and its findings fixed or
  answered;
- the docs in README §9's table are current: this file's *What landed*, DELIVERY-LOG, a test-audit entry for
  every new test (the audit README's counts too), the helpers/pages READMEs;
- the PR is open with a *Needs you* list for Andrey's decisions; he runs `QA — Branch run` on it, and anything
  red is triaged (`playwright-run-reviewer`) and fixed, skipped behind a filed bug, or explained in the PR.

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

Resolve them at run time, never by stored name or id: `findOnlineHost(request, platform, { kind: 'real' })`,
the `vmsFleetId` worker fixture for the premium VMs fleet, `liveMacosHost` for a macOS one. **Host-side**
behaviour (installs, scripts, profiles, anything the host *does*) needs a real VM. **Server-side** data (an IdP
username, a transfer, which hosts a policy lists) is answered as well by a simulation, which is what §4 uses
so the real VMs stay untouched. Simulations ignore live-query SQL, return no rows ~20% of runs and never install
anything, so never assert host-side behaviour against one.

> **⚠️ Never deploy a passcode profile to a real host.** It blocks access permanently, there is no recovery,
> and there are only a few VMs per tier. No `com.apple.mobiledevice.passwordpolicy`, `forcePIN`, `minLength`,
> `maxInactivity` or `allowSimple` — nor screen lock, inactivity timeout, FileVault, login-window restrictions,
> or anything disabling SSH / remote management / the MDM channel. Uploading is delivering: on free, even an
> upload → delete lifecycle reaches the VMs. Only the inert `fleet-pw-inert.*` fixtures may be uploaded. See
> [README §5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out).

## Provisioning-gated

*13 source flows → 9 specs.*

Split by what unblocks each one:

| needs | specs |
|---|---|
| a readable mailbox (Mailpit or a catch-all domain) | the 3 MFA flows |
| a Fedora host online | the RPM install case |
| nothing (the *Update end user* control exists) | the 2 IdP specs |
| a decision on destructive rotation | the 2 recovery-lock specs |
| **nothing — the static user already exists** | technician transfer, the 2 team-admin flows |

**Recovery lock: build the permission surface, park the act.** Rotating the recovery lock on a real
MDM-enrolled mac is a one-way door on a VM we have three of and no re-provisioning automation. Same call as
Lock/Wipe in round 1 ([PARITY §6](../PARITY.md#6-lock-and-wipe-gated-not-ignored)): assert who can see and
reach the action across roles and platforms, and write down why the act itself is parked.

**POM work:** `HostDetailsPage`: the end-user / IdP card and `UpdateEndUserModal`; `helpers/mailbox.ts` for magic links, only once SMTP and a mailbox exist.

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

## What landed

*Nothing yet. Add a row per target spec as it lands (status, and what changed from the plan), the way
[E](E-label-targeting.md#what-landed) does.*
