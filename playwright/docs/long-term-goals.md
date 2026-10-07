# Long-term goals

Coverage the suite should have but can't build yet, because it needs infrastructure the QA instances don't
have. Each row says what it would unblock, so whoever provisions the infrastructure knows which tests to write
next.

Skipped and deferred *tests* live in [`../TODO.md`](../TODO.md); skips owed to a Fleet bug live in
[`blocked-by-product-bugs.md`](blocked-by-product-bugs.md). This file holds what has no test yet.

## Host types

The instances have one real VM per platform: macOS 26.6, Windows 11 and Ubuntu 26.04. Everything else Fleet
manages is untested on a real device.

| host | what it would unblock |
|---|---|
| **Fedora** (RPM-based) | `.rpm` custom packages end to end: upload, install, uninstall, delete, and an `.rpm` installed by a policy automation. Fleet's default install and uninstall scripts differ per package type, and no `.rpm` is exercised anywhere today |
| **RHEL** (RPM-based) | the same `.rpm` path on the enterprise distribution; RHEL's OS version and vulnerability matching (OVAL) |
| **Omarchy** (Arch-based) | `pkg.tar.zst` agent packages and Arch software inventory |
| **iOS / iPadOS** | device-side MDM: profile delivery, Lost Mode lock/unlock, VPP and `.ipa` installs on the device. The catalog halves (adding an App Store app, a VPP token) already run without one |
| **Android** | enrollment, profile delivery to a device, Managed Google Play installs. Adding a Play app already runs without one |
| **A sacrificial macOS VM**, MDM-enrolled and rebuildable | firing **Lock** and **Wipe** on a real device. Today their availability is asserted on every platform (`premium/hosts/mdm-actions-availability.spec.ts`) but they never run on a real VM, because a locked or wiped VM can't be recovered from here. Unlocking a locked Mac needs the PIN Fleet shows, entered on the device |

Each new VM also needs a place in the suite's host plumbing: `findOnlineHost` keys a real VM on its
hardware model, `helpers/vm-fixtures.ts` lists durable software per platform, and the resting-state step in
`setup/cleanup.steps.ts` returns each VM to rest before and after a run.

## A readable mailbox

Fleet's email flows need SMTP configured on the instance **and** a mailbox the suite can read: Mailpit, or a
catch-all domain with an API. `smtp_settings.configured` is false on both QA instances.

| what it would unblock |
|---|
| Fleet MFA: a 2FA user signs in through the emailed magic link; the link can't be reused; an invited user with 2FA enabled accepts the invite, registers, then signs in through the link |
| invites: the invite email, **Accept invitation**, registration |
| password reset by email ("Forgot password?") |

Configuring SMTP changes what the suite can assert today: with it unset, Fleet refuses to turn MFA on
(*"Email must be set up to enable Fleet MFA"*), and turning SMTP on removes that refusal.

## Elsewhere

- **Certificate authorities (SCEP/EST), VPP token renewal and expiry, maintenance windows** — untested. With
  a CA integration on the instance, Controls › OS settings › Certificates' add / validate / delete is
  config-only and needs no device.
- **`fleetctl package` across types and architectures** (`rpm`, `pkg.tar.zst`, `--arch arm64`) — a weekly
  matrix, not the nightly: [`test-plans/fleetctl.md` §5](test-plans/fleetctl.md).
