# Long-term goals

Coverage the suite should have but can't build yet, because it needs infrastructure the QA instances don't
have. Each row says what it would unblock, so whoever provisions the infrastructure knows which tests to write
next.

Skipped and deferred *tests* live in [`../TODO.md`](../TODO.md); skips owed to a Fleet bug live in
[`blocked-by-product-bugs.md`](blocked-by-product-bugs.md). This file holds what has no test yet.

## Host types

The suite runs on the device lab's pool VMs ([`lab-hosts.json`](../lab-hosts.json), role `pool`): Ubuntu
24.04, Windows 11 and macOS, four, two and two of them on premium (macOS 15 and 26) and one of each on free
(macOS 26), with each worker handed its own. Everything else Fleet manages is untested on a real device.

The lab's other hosts, one per OS flavour on premium's OS matrix fleet (role `matrix`: Fedora, RHEL 9 and 10,
Omarchy, openSUSE, Debian, Amazon Linux, Windows 10 and Server, and more), get a smoke each every night, as
does every OS version of the pool (`premium/matrix/os-smokes.spec.ts`, the `premium-matrix` project): the OS
and agent versions Fleet shows, the inventory by package type, a script, an `.rpm`, `.deb`, `.msi` or tarball
installed and uninstalled, an install by a policy automation, Fleet Desktop, and the OS's vulnerabilities.
A smoke is one pass of each on one host: what a flavour would need beyond it is in
[`../TODO.md`](../TODO.md) › *Coverage backlog*, and disk encryption on those hosts is
[`device-lab-plan.md`](device-lab-plan.md)'s step E.

| host | what it would unblock |
|---|---|
| **iOS / iPadOS** | device-side MDM: profile delivery, Lost Mode lock/unlock, VPP and `.ipa` installs on the device. The catalog halves (adding an App Store app, a VPP token) already run without one |
| **Android** | enrollment, profile delivery to a device, Managed Google Play installs. Adding a Play app already runs without one |
| **A sacrificial macOS VM**, MDM-enrolled and rebuildable | firing **Lock** and **Wipe** on a real device. Today their availability is asserted on every platform (`premium/hosts/mdm-actions-availability.spec.ts`) but they never run on a real VM, because a locked or wiped VM can't be recovered from here. Unlocking a locked Mac needs the PIN Fleet shows, entered on the device |

A new host's place in the suite's plumbing is its entry in the lab's manifest: the role says what it is for
(`pool`: a worker's target; `matrix`: one OS flavour's; `special`: one purpose's; `physical`: a bare-metal
machine nothing destructive touches), and the cleanup puts it on its role's fleet. A new pool VM needs nothing
more: `gitops/premium-fleetqa/fleets/vms.yml` gives it the durable software `helpers/vm-fixtures.ts` lists,
and the resting-state step in `setup/cleanup.steps.ts` returns every pool VM to rest before and after a run.
A new *platform* still needs its durable fixtures and a `platform` the pickers know.

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
