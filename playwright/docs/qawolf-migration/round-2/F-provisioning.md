# Batch F — Provisioning-gated

**13 source flows → 9 specs.** `Provisioning-gated`

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
| `tests/e2e/premium/software/install-on-host.spec.ts` | **new** | `software/install-and-delete-rpm-files-on-rpm-based-linux-hosts-fedora` |
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
