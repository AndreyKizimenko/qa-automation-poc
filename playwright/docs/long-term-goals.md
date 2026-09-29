# Long-term goals

Coverage the suite should have but can't build yet, because it needs infrastructure the QA instances don't
have. None of this is migration work: the QA Wolf migration finishes without it. Each row says what it would
unblock, so whoever provisions the infrastructure knows which tests to write next.

Skipped and deferred *tests* live in [`../TODO.md`](../TODO.md); skips owed to a Fleet bug live in
[`blocked-by-product-bugs.md`](blocked-by-product-bugs.md). This file holds what has no test yet.

## Host types

The instances have one real VM per platform: macOS 26.6, Windows 11 and Ubuntu 26.04. Everything else Fleet
manages is untested on a real device.

| host | what it would unblock | source |
|---|---|---|
| **Fedora** (RPM-based) | `.rpm` custom packages end to end: upload, install, uninstall, delete. Fleet's default install and uninstall scripts differ per package type, and no `.rpm` is exercised anywhere today | QA Wolf `software/install-and-delete-rpm-files-on-rpm-based-linux-hosts-fedora` (round 2, [batch F](qawolf-migration/round-2/F-provisioning.md)) |
| **RHEL** (RPM-based) | the same `.rpm` path on the enterprise distribution; RHEL's OS version and vulnerability matching (OVAL) | — |
| **Omarchy** (Arch-based) | `pkg.tar.zst` agent packages and Arch software inventory | — |
| **iOS / iPadOS** | device-side MDM: profile delivery, Lost Mode lock/unlock, VPP and `.ipa` installs on the device. The catalog halves (adding an App Store app, a VPP token) already run without one | QA Wolf round-2 shells in [TRIAGE group A](qawolf-migration/round-2/TRIAGE.md#group-a--empty-shells-and-broken-source-20) (`ipad-ios/lost-mode-…`, `software/install-vpp-apps-…`) |
| **Android** | enrollment, profile delivery to a device, Managed Google Play installs. Adding a Play app already runs without one | TRIAGE group A (`configuration-profiles/upload-configuration-profiles-to-android-host`) |

Each new VM also needs a place in the suite's host plumbing: `findOnlineHost` keys a real VM on its
hardware model, `helpers/vm-fixtures.ts` lists durable software per platform, and the resting-state step in
`setup/cleanup.steps.ts` returns each VM to rest before and after a run.

## A readable mailbox

Fleet's email flows need SMTP configured on the instance **and** a mailbox the suite can read: Mailpit, or a
catch-all domain with an API. `smtp_settings.configured` is false on both QA instances.

| what it would unblock | source |
|---|---|
| Fleet MFA: a 2FA user signs in through the emailed magic link; the link can't be reused; an invited user with 2FA enabled accepts the invite, registers, then signs in through the link | QA Wolf `uncategorized/created-2fa-enabled-user-cannot-re-use-sign-in-magic-link`, `…/global-admin-is-able-to-edit-user-to-use-2fa`, `…/invite-2fa-enabled-user-and-log-in-as-the-user` (round 2, [batch F](qawolf-migration/round-2/F-provisioning.md)) |
| invites: the invite email, **Accept invitation**, registration | the same invite flow |
| password reset by email ("Forgot password?") | — |

Configuring SMTP changes what the suite can assert today: with it unset, Fleet refuses to turn MFA on
(*"Email must be set up to enable Fleet MFA"*), and turning SMTP on removes that refusal.

## Elsewhere

- **Certificate authorities (SCEP/EST), VPP token renewal and expiry, maintenance windows** — QA Wolf titles
  with no body, kept as a named backlog in [TRIAGE group A](qawolf-migration/round-2/TRIAGE.md#group-a--empty-shells-and-broken-source-20).
- **`fleetctl package` across types and architectures** (`rpm`, `pkg.tar.zst`, `--arch arm64`) — a weekly
  matrix, not the nightly: [`test-plans/fleetctl.md` §5](test-plans/fleetctl.md).
