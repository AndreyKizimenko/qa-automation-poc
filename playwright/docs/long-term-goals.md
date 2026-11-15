# Long-term goals

Coverage the suite should have but can't build yet, because it needs infrastructure the QA instances don't
have. Each row says what it would unblock, so whoever provisions the infrastructure knows which tests to write
next.

Skipped and deferred *tests* live in [`../TODO.md`](../TODO.md); skips owed to a Fleet bug live in
[`blocked-by-product-bugs.md`](blocked-by-product-bugs.md). This file holds what has no test yet.

## What to provision next

In the order it would pay (Andrey, 2026-11-15), now that the device lab's pool and its OS matrix are in the
suite. Each item points at the section that says what it unblocks. Mobile hosts (iOS, iPadOS, Android) are
being set up, outside this list.

1. **A way for a run to reset a host** (*Host types*). The lab rolls a Linux or Windows VM back to its
   baseline in seconds, by hand. A hook CI can call turns Lock, Wipe, OS-update enforcement and disk
   encryption into nightly tests, and it is the one item here that needs no new machine.
2. **A third pool Mac, and macOS 27** (*Host types*). macOS is the pool's tight platform: at three workers
   about 20 test-minutes of premium's main project wait on two Macs, which are also two OS versions, while one
   of the four Ubuntu VMs sits idle all run (branch run 43667531465). A fourth worker would meet this first.
   Both wait for the lab's January Macs.
3. **A Mac that enrolls through ADE** (*Host types*). The setup experience is the largest desktop flow with no
   real device behind it.
4. **A readable mailbox, and a certificate authority** (*A readable mailbox*, *Elsewhere*). Neither needs a
   host: MFA, invites and password reset, and the Certificates page.
5. **The oldest supported release of the big Linux families** (*Host types*): RHEL 8 and Debian 12 first, as
   the old releases still widely run. The server the lab's Linux and Windows VMs run on is full by memory, so
   each needs a VM retired or shrunk first, and a flavour isn't worth adding for its own sake.

## Host types

The suite runs on the device lab's pool VMs ([`lab-hosts.json`](../lab-hosts.json), role `pool`): Ubuntu
24.04, Windows 11 and macOS, four, two and two of them on premium (macOS 15 and 26) and one of each on free
(macOS 26), with each worker handed its own. Everything else Fleet manages is untested on a real device.

The lab's other hosts, one per OS flavour on premium's OS matrix fleet (role `matrix`: Fedora, RHEL 9 and 10,
Omarchy, openSUSE, Debian, Amazon Linux, Windows 10 and Server, and more), get a smoke each every night, as
does every OS version of the pool (`premium/matrix/os-smokes.spec.ts`, the `premium-matrix` project): the OS
and agent versions Fleet shows, the machine's vitals and users, its platform's built-in label, the inventory
by package type, a live report answered with the host's own data, a script, an `.rpm`, `.deb`, `.msi` or
tarball installed and uninstalled with the inventory following both, an install by a policy automation, Fleet
Desktop, and the OS's vulnerabilities.
A smoke is one pass of each on one host: what a flavour would need beyond it is in
[`../TODO.md`](../TODO.md) › *Coverage backlog*, and disk encryption on those hosts is
[`device-lab-plan.md`](device-lab-plan.md)'s step E.

What is left. *What to provision next* has the order for the rows worth provisioning for; the last two are
gaps to know about, not requests. The lab's own README (*Capacity*, *January plan*, *Known gaps*) says what
fits where: the server its Linux and Windows VMs run on is full by memory, and a Mac holds two macOS VMs.

| host | what it would unblock |
|---|---|
| **iOS / iPadOS** | device-side MDM: profile delivery, Lost Mode lock/unlock, VPP and `.ipa` installs on the device. The catalog halves (adding an App Store app, a VPP token) already run without one |
| **Android** | enrollment, profile delivery to a device, Managed Google Play installs. Adding a Play app already runs without one |
| **A host a run can reset by itself**, one per platform | firing **Lock** and **Wipe** on a real device, and whatever else a test can't undo: an OS-update deadline, a lock or passcode profile, disk encryption from a clean start every night. Today the availability of Lock and Wipe is asserted on every platform (`premium/hosts/mdm-actions-availability.spec.ts`) but they never run, because a locked or wiped VM can't be recovered from here. The lab has the reset already: a Linux or Windows VM rolls back to its baseline in seconds and is back online, as the same host in Fleet, about 2.5 minutes later, and a macOS VM is a clone of its baseline. What is missing is a way for a run to ask for it: only the lab's owner can, and CI doesn't reach the lab's network |
| **A Mac that enrolls automatically (ADE)** | the setup experience on a device: end-user authentication, the bootstrap package, software and a script during setup, the setup assistant. Their settings are covered without a device (`premium/controls/setup-experience/`). The lab's Macs enroll by hand: ADE isn't possible at MacStadium |
| **A third pool Mac** | a Mac per worker at three workers, and room for a fourth worker: the pool's two Macs serve three workers today, on two macOS versions, so which version a macOS test met is chance and the busiest platform's waits are shared. The Mac that holds them is at Apple's limit of two macOS VMs |
| **macOS 27** | the newest macOS in the pool, and its DDM-focused smoke ([`device-lab-plan.md`](device-lab-plan.md), step D). A VM can't be newer than the Mac it runs on, so it waits for the lab's January Macs |
| **A Mac kept for FileVault** | disk encryption on macOS: FileVault ends auto-login on a VM, so it needs a VM of its own and a way to unlock it at boot ([`device-lab-plan.md`](device-lab-plan.md), step E) |
| **The oldest release Fleet supports of a Linux or Windows Server family** | a per-OS smoke at the floor, where an older package manager or osquery table is most likely to differ: RHEL 8 and Debian 12 first. The lab's flavours are each family's current release, while Fleet supports back to Ubuntu 20.04, Debian 11, RHEL 7, Amazon Linux 2, openSUSE 15.6 and Windows Server 2012 (Fleet's `docs/Get started/FAQ.md`). macOS and Windows desktop are already at their floor (macOS 15, Windows 10). A new flavour is a manifest entry and a row in the smokes' `REPORTED_OS` |
| **CentOS, plain Arch or CachyOS, ChromeOS** | the flavours Fleet lists that the lab has no host of. Omarchy stands in for the pacman family. ChromeOS has no test of any kind, and needs a managed Chromebook |
| **Linux or Windows on ARM**, on the QA instances | arm64 packages and installers on a host: the lab's Linux and Windows VMs here are x86_64 (the UTM VMs they replaced were the suite's only ARM ones, and the lab's two Windows ARM VMs serve another instance). `fleetctl package --arch arm64`, below, would have somewhere to install |

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
