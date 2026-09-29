# Batch F — Provisioning-gated

**13 source flows → 4 new specs + 5 augments. 2 flows cut as duplicates, 4 moved to the
[long-term goals](../../long-term-goals.md).** Built on `playwright/qawolf-round2-batch-f`.

> ## ▶ Start here — refreshed 2026-09-29, after the review
>
> The batch was reviewed against the 13 source flows, the suite and Fleet's 4.93 RC source before anything was
> built, and Andrey decided the open questions (below). Everything in *What landed* is built.
> **`recovery-lock.spec.ts` has not run live yet**: it's the one spec that sets something on the real Mac, and
> its first run waits for Andrey's go-ahead.
>
> If you pick this up: invoke **`playwright-test-author`** before changing anything,
> **`playwright-test-reviewer`** before the PR, **`playwright-run-reviewer`** on a red run. Read
> [README §9](README.md#9-working-a-batch-since-d) (how a batch runs) and
> [§5](README.md#5-test-hosts--use-the-real-vms-and-never-lock-yourself-out) (never lock a VM) first. Andrey
> dispatches the full `QA — Branch run`; don't start one.

---

## The review — what each row turned out to be

Read before building, 2026-09-29. The handoff's plan was right about most rows being unblocked, and wrong
about three things, each caught by reading the flow or the source rather than the title.

| row (flows) | decision | why |
|---|---|---|
| technician transfer (1) | **augment** `host-transfer-permissions.spec.ts` — one more role row | `canTransferTeam` admits `isGlobalTechnician` beside admin and maintainer (`HostActionsDropdown/helpers.tsx`) |
| team admin edits a member (1) | **new** `team-admin-scope.spec.ts` | nothing in the suite covered a team admin managing their fleet's users |
| team admin renames the fleet (1) | **folded into** `team-admin-scope.spec.ts`; **the rename is never saved** | the header offers *Rename fleet* to team admins and *Delete fleet* only to global admins (`TeamDetailsWrapper.tsx`), so both are asserted, the modal opened and cancelled; an API rename with an empty name proves the permission (422 on their fleet, 403 on another) without changing anything. Renaming Workstations would orphan it from gitops *and* break every worker resolving it by name mid-run |
| host IdP username (2) | **new** `premium/hosts/host-idp-username.spec.ts` + a free sibling | server-side data, so a simulation host. The premium instance has never received a SCIM request (`GET /scim/details` → `last_request: null`), so QA Wolf's *Full name* / *Groups* / *Department* assertions can't be reproduced; the username, the activity and the removal can |
| manual MDM enrollment (2, premium + free) | **cut — duplicate** | neither flow touches an enrollment profile. Both upload `profile_identifier.sh`, run it on a random macOS host and check exit code 0 and its output: that's `shared/hosts/host-run-script.spec.ts`, on both tiers, on the real VMs, with stronger assertions. (The Add hosts modal's macOS panel now shows an enroll *URL*, not a download.) |
| recovery lock (2) | **new** `premium/hosts/recovery-lock.spec.ts` — **full coverage on the Mac VM** (Andrey's decision) | the two flows are one flow (the second adds a rotation-time check). The handoff's "permission surface only" plan couldn't fail: *Show Recovery Lock password* renders only when enforcement is on for the host's fleet or a password already exists (`canShowRecoveryLockPassword`), so with enforcement never on, every role would see it absent and pass |
| `.rpm` on Fedora (1) | **moved to the [long-term goals](../../long-term-goals.md#host-types)** | no RPM-based host on either instance; one of several host types the suite lacks |
| MFA ×3 | **moved to the [long-term goals](../../long-term-goals.md#a-readable-mailbox)**; the parts that need no mailbox were built | all three flows are mailbox-driven end to end (magic-link sign-in, link reuse, invite + 2FA). The handoff's "no-SMTP" rows weren't in any QA Wolf flow, and one would flip the day SMTP is configured. Built instead: the 2FA checkbox's state on premium, its absence on free, and the API's 402 on free |

### Decisions (Andrey, 2026-09-29)

1. **Recovery lock: full coverage on the premium Mac VM** — enforce, verify, view, rotate, activities, clear.
2. **MFA and the RPM row aren't migration work.** They're tracked in
   [`docs/long-term-goals.md`](../../long-term-goals.md) with the other missing host types (iOS, iPadOS,
   Android, Omarchy, Fedora, RHEL).
3. **File the SSO + MFA copy bug**: [fleetdm/fleet#54381](https://github.com/fleetdm/fleet/issues/54381) —
   *"Fleet MFA is is not applicable to SSO users"*. API-only: the user form never lets the two combine. Released
   (in `fleet-v4.92.1`, since #24273), `#g-orchestration`. No spec asserts the string.
4. **The two cuts stand**, and no fleet is renamed.

### Recovery Lock on the VMs fleet — why it's allowed, and the rules

Recovery Lock only guards entry to macOS Recovery; it doesn't touch login, SSH or the MDM channel. Fleet escrows
the password (viewable, rotatable), and turning enforcement off sends `ClearRecoveryLock`, so the Mac ends as it
began. That is why it isn't in the class of payloads README §5 forbids. The rules that keep it that way:

- **Only `recovery-lock.spec.ts` turns it on for the VMs fleet**, and turns it off in an `afterEach` (which,
  unlike a `finally`, still runs after a timeout).
- **The resting-state step turns it off** (`setup/cleanup.steps.ts`) when a dead run left it on; Fleet clears
  the Mac's password on its next 30-second cron tick.
- **Viewing the password has side effects**: each view records an activity and schedules an automatic rotation
  an hour out. Read status through `GET /hosts/:id` (`mdm.os_settings.recovery_lock_password`), which does
  neither; `getHostRecoveryLockStatus` / `waitForRecoveryLockStatus` do that.
- **Never on free.** `mdm.enable_recovery_lock_password` is in free's global config too, and the free Mac sits
  in Unassigned. Fleet's server doesn't license-check the key; only the fact that the cron sending the
  commands runs on premium keeps it off the free Mac. Free asserts the paywall and nothing else.

---

## Target specs

Source flows live in `qa-wolf/Fleet_20260828 (1)/{Free,Premium}/src/tests/<path>`.

| Target spec | Kind | Source flows folded in |
|---|---|---|
| `tests/e2e/premium/hosts/host-transfer-permissions.spec.ts` | augment | `technician-user/technician-role-can-transfer-hosts-between-fleets` |
| `tests/e2e/premium/settings/users/team-admin-scope.spec.ts` | **new** | `user-profiles/team-admin-able-to-edit-a-team-member-premium`<br>`user-profiles/team-admin-able-to-edit-team-name-premium` |
| `tests/e2e/premium/hosts/host-idp-username.spec.ts` | **new** | `api/update-mac-host-idp-username-via-api`<br>`idp/update-and-remove-host-idp-username-via-ui` |
| `tests/e2e/free/hosts/host-idp-username.spec.ts` | **new** (free) | — (free coverage for the same flows) |
| `tests/e2e/premium/hosts/recovery-lock.spec.ts` | **new** | `mac-os-accounts/automatically-rotate-recovery-lock-password`<br>`mac-os-accounts/set-plus-manually-rotate-macos-recovery-lock-passwords` |
| `tests/e2e/premium/settings/users/regular-user-create.spec.ts` | augment | the 2FA checkbox half of the three MFA flows |
| `tests/e2e/free/settings/users/{regular-user-create,edit}.spec.ts` | augment (free) | — |
| `tests/api/free/license.spec.ts` | augment (free) | — |
| `tests/e2e/free/paywalls.spec.ts` | augment (free) | — (the Passwords card's paywall) |
| — cut, duplicate of `shared/hosts/host-run-script.spec.ts` | — | `mdm/manual-mdm-enrollment-mac-enrollment-profile`<br>`mdm/manual-mdm-enrollment-mac-enrollment-profile [FREE]` |
| — [long-term goals](../../long-term-goals.md) | — | `software/install-and-delete-rpm-files-on-rpm-based-linux-hosts-fedora`<br>`uncategorized/created-2fa-enabled-user-cannot-re-use-sign-in-magic-link`<br>`uncategorized/global-admin-is-able-to-edit-user-to-use-2fa`<br>`uncategorized/invite-2fa-enabled-user-and-log-in-as-the-user` |

## What landed

| target | status | notes |
|---|---|---|
| `premium/hosts/host-transfer-permissions.spec.ts` | ✅ augment | a `global-technician` row (Windows simulation slice 0–2); green with dependencies and headed |
| `premium/settings/users/team-admin-scope.spec.ts` | ✅ | the team admin creates a member from the fleet's Users tab (user menu → *Users*), renames them and makes them the fleet's admin, then removes them from the fleet — each step read back through the API, the user surviving the removal. And the header: *Rename fleet* offered, *Delete fleet* not, the rename modal prefilled and cancelled; `PATCH /fleets/:id` with an empty name as the team admin — 422 on Workstations, 403 on QA. QA Wolf's sign-in as the promoted member was dropped: a forced password reset plus two logins against Fleet's shared 10/min limit, to prove what the API already says |
| `premium/hosts/host-idp-username.spec.ts` | ✅ | the User card's *Add user* → modal → *Updated end user.* → card, API and `edited_host_idp_data` activity; *Edit user* opens on the value, clearing it removes the user (*Removed end user.*, activity with an empty username). The API case: `PUT device_mapping` (`source: idp`) → `mdm_idp_accounts`, the card follows, `DELETE …/idp`, a second delete is 422. A global observer isn't offered the button. Simulations (Windows `findSimulations` 0–1) |
| `free/hosts/host-idp-username.spec.ts` | ✅ **new** | *Add user* is offered on free (role-gated, not tier-gated) and opens the Fleet Premium message instead of the field |
| `api/free/license.spec.ts` | ✅ augment | on free, `PUT`/`DELETE` of an IdP username → 402, `mfa_enabled: true` on a user → 402; each read back to prove nothing landed |
| `premium/settings/users/regular-user-create.spec.ts` | ✅ augment | the 2FA checkbox starts unchecked; enabled only if Fleet can send email (`smtp_settings.configured` or SES — read from the config, so it holds either way); hidden while *Single sign-on* is chosen. Its own non-serial describe, so a failure can't skip the create cases |
| `free/settings/users/{regular-user-create,edit}.spec.ts` | ✅ augment | the 2FA checkbox is absent from the create and edit forms on free |
| `free/paywalls.spec.ts` | ✅ augment | the OS-settings rows now require their own card's heading: OS settings sends an unknown section to Disk encryption, whose identical paywall let the Passwords and Certificates rows pass with their card gone. Plus the missing *Host names* row |
| `premium/hosts/recovery-lock.spec.ts` | ◐ **built, not yet run live** | Controls → OS settings → Passwords on for the VMs fleet → the Mac's *Recovery Lock password* verified (API, Controls tab) → *Show Recovery Lock password* reveals it, with the auto-rotation banner → *Rotate password* → verified again with a different password → the host's Activity card shows set / viewed / rotated → enforcement off → cleared from the Mac, the Controls row and the action gone. All five activities matched by type, subject and time. The resting-state step turns enforcement off after a dead run |

### Built for the batch

- `HostDetailsPage` — the **User** card (`userCard`, `userCardData`, `updateEndUserButton`), `endUserModal`,
  `recoveryLockModal`. New components: `UpdateEndUserModal`, `RecoveryLockPasswordModal`.
- `FleetUsersPage` — a fleet's Users tab and its header, with the create / edit / remove / rename modals.
- `PasswordsPage` (Controls → OS settings → Passwords) and `OsSettingsPage.goToPasswords()`.
- `UserFormFields.mfaCheckbox`, the authentication radios' labels.
- Helpers: `putHostIdpUsername` / `deleteHostIdpUsername` / `getHostIdpUsername`;
  `getHostRecoveryLockStatus` / `waitForRecoveryLockStatus`; `getFleetRecoveryLock` / `setFleetRecoveryLock`;
  `canSendEmail`; `latestActivityId` / `assertActivityAfter` (an activity newer than the log's last entry before
  the step — for ones an earlier run left identical); `sessionBearerHeaders` (the signed-in user's own token, from Fleet's session cookie — how a
  `withStaticUser` page calls the API as that user).

### Found on the way

- **The team role dropdown's `combobox` input never takes a click**: react-select lays its control over it, and
  a click on the input waits out the test. The control's class is the click target.
- **A signed-in page's cookie doesn't authenticate the API on its own.** Fleet's UI reads the session cookie
  and sends it as a bearer token; `sessionBearerHeaders` does the same.
- **The users list carries leftover API-only users** (`QA API 1Fleet 1781640859568`, … with generated
  `admin+…@fleetdm.com` emails) on Workstations. The cleanup sweep only matches `qa-test-*` addresses, so API
  users created by `api-user-create.spec.ts` survive a dead run. Not fixed here.

---

## Facts for whoever changes these specs

- **Hosts.** The IdP username and a transfer are data Fleet stores about the host: simulations answer them, so
  no real VM's end user or fleet is touched (`findSimulations` Windows 0–1 for the IdP specs,
  `findSimulatedHostIds` Windows 0–2 for the transfer roles). Recovery Lock is something the Mac *does*: only
  the real VM answers it (`liveMacosHost`).
- **Free.** QA Wolf ran this batch on premium only; every free check here was found in Fleet's source. The IdP
  button is role-gated (`canWriteEndUser`), its modal tier-gated; `source: "idp"` is premium-only in
  `SetHostDeviceMapping` / `DeleteHostIDP`; the 2FA checkbox renders on premium or when already set
  (`UserForm.tsx`), and `ModifyUser` refuses `mfa_enabled: true` on free with 402.
- **Names change under state.** The User card's button reads *Add user* or *Edit user*, and its accessible name
  starts with the icon's alt text (*plus Add user*). The edit modal's class is `edit-user-modal__edit-user-modal`.
- **A missing locator waits forever**, and a timed-out test's `finally` runs on a closed context. Probe first.

## Done when

- every target spec above exists and is green on each tier it targets — **`recovery-lock.spec.ts` still owes its
  first live run**;
- `npm run check` is clean;
- each spec ran at least once headed and at least once **with** dependencies (no `--no-deps`);
- anything timing-sensitive survived `--repeat-each=5`;
- a line per shipped slice is appended to [DELIVERY-LOG.md](../DELIVERY-LOG.md);
- anything parked has a row in [`../blocked-by-product-bugs.md`](../../blocked-by-product-bugs.md), the
  [long-term goals](../../long-term-goals.md) or a reasoned note in this file — never a silent skip.
