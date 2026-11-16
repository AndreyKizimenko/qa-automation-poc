# Device lab step E: disk encryption on real hosts. The analysis

Written 2026-11-16 for Andrey, who asked whether disk-encryption tests on the lab's hosts can add real value
before anything is built ([`device-lab-plan.md`](device-lab-plan.md), step E). Nothing here is built. Nothing
on a host or an instance was changed to write it: Fleet's source, GitHub's issues and GETs against premium
only. It waits for his decisions, which are listed at the end.

## The answer

**Yes, it is worth building, in a different shape from the plan's, and FileVault is not part of it.**

- **The evidence is Fleet's own bug history.** Of the 41 disk-encryption bugs filed since 2026-05-01, 21 show
  only when something runs on a host, and customers found 12 of the 41, nine of those in a flow. Eleven
  were reachable on this lab with nobody at a host. The area changed in every release from 4.90 to 4.95.
- **Andrey's doubt is right.** A key that sits escrowed proves little: on Linux "Verified" means only that a key
  row exists with no error recorded. So the recommendation has no standing escrowed host in it.
- **The shape: a project of this suite on throwaway fleets.** A test moves its host from OS matrix into a
  `pw-*` fleet with one platform's setting on, drives the flow in the browser, and moves the host back.
  Moving it back deletes Fleet's key row and its "Failed" state, so every night starts clean. OS matrix stays
  declared off, and the smokes, the manifest and gitops change nothing.
- **First slice, with no host changed:** on each LUKS host, the statuses, My device's banner and *Create
  key*, then what the click does with nobody there (the prompt times out on three hosts, and fails in a
  known way on Fedora and Omarchy), and a Windows Server on an enforcing fleet. Seven of the eleven
  reachable bugs sit here.
- **Second slice: BitLocker on `prem-win10-01`, end to end,** which needs nobody: Fleet encrypts, a key is
  escrowed, the test reads it, and a script decrypts the disk again. One experiment by hand comes first.
- **A completed LUKS escrow every night waits for the lab.** Nothing in fleetd answers the passphrase prompt.
  It needs the reset hook, already first on the list to provision, to type a passphrase as well, or an
  Ubuntu 26.04 VM with TPM-backed encryption, which escrows with no prompt at all.
- **Not the pool.** FileVault enforcement can't be undone by Fleet and the pool Macs would lose auto-login.
  BitLocker would change the Windows 11 VMs for good.

## How this was checked

| Kind of claim | How it is marked |
|---|---|
| Read from premium (GETs only), 2026-11-15 and 16, build `4.95.0-rc`, `d6df44a` | "live" |
| Read in Fleet's source at that commit | a path, relative to Fleet's repository |
| Fleet's bug history | an issue number |
| Reasoned from the source, or from how the OS behaves, and not exercised on a host | "inferred", or listed under *Not exercised* |

Five parallel readers collected the source references and the issue list. I re-read every path the
recommendation rests on (they are the ones cited in *What decides it*) and spot-checked six issues against
GitHub (#53426, #54821, #55549, #55895, #58617, #58776). The remaining paths were read once, by a reader,
and are cited so they can be checked.

**Nothing was exercised on a host.** Every statement about what a host does is a reading of the code.

**fleetd was read at the server's commit, which is ahead of the 1.63.0 the hosts run.** Its unreleased
notes (`orbit/changes/`) hold at least two changes the hosts don't have yet: `XDG_RUNTIME_DIR` set for the
passphrase dialog, and the `bitlocker_key_protectors` table answering with no rows on a host without
BitLocker (fleetdm/fleet#55549's fleetd half). The server gates Omarchy's escrow on 1.64.0 for the first.

## What decides it

1. **Turning Linux key escrow on for a fleet prompts nobody.** fleetd prompts only while
   `run_disk_encryption_escrow` is set, the server sets it only for a pending request
   (`server/service/orbit.go:908-928`), and the only thing that queues one is the end user's *Create key*
   (`POST /device/{token}/mdm/linux/trigger_escrow`, `ee/server/service/devices.go:272-296`,
   `server/service/handler.go:1050`). The handoff's first finding holds.
2. **A test can reach a real host's My device page from the admin UI.** Host details has a "My device" link
   for global admins, which opens the end user's page in a new window
   (`frontend/pages/hosts/details/HostDetailsPage/HostDetailsPage.tsx:1449-1459`; `GET
   /hosts/{id}/device_url`, `server/service/hosts.go:3271-3284`). Each use logs an activity.
3. **Nothing in fleetd answers the passphrase prompt but a person**, with one exception: a disk under
   Ubuntu's TPM-backed encryption is escrowed over snapd's socket with no dialog
   (`orbit/pkg/luks/luks_linux.go:121-136`, `orbit/pkg/luks/snapd_fde.go:70-127`).
4. **Moving a host to a fleet whose setting for its platform is off deletes its key row**
   (`server/datastore/mysql/disk_encryption.go:606-659`). Live: `prem-ubu2404-luks` shows its key archived
   and not available, after the move that ended the escrow by hand on 2026-11-14.
5. **A Linux "Failed" is sticky, and a stored key blocks a new request.** Neither another click, a cancel
   nor a timeout clears the error (`disk_encryption.go:256-275`; fleetdm/fleet#54821, open), and *Create key*
   is refused while a key is stored (`devices.go:286`). So a state on a standing fleet is entered once.
6. **BitLocker needs nobody, and Windows Servers are left alone.** The server asks fleetd to encrypt only a
   host connected to Fleet's MDM that is not a server (`server/service/orbit.go:1220-1261`), and fleetd adds
   a TPM protector beside the recovery password (`orbit/pkg/bitlocker/bitlocker_management_windows.go:571-580`).
7. **On macOS, escrow and enforcement are separate settings, and Fleet cannot turn FileVault off.** The
   FileVault payload is in the profile only under enforcement (`ee/server/service/mdm_profiles.go:26-92`).

## The live state

Read on 2026-11-15 and 16. All 24 premium lab hosts were online and on their role's fleet.

| Host | Fleet reports the disk as | In MDM | Key available |
|---|---|---|---|
| `prem-ubu2404-luks` | encrypted | no | no, and one archived |
| `prem-kubuntu2404-luks`, `prem-zorin18-luks`, `prem-fedora45-luks`, `prem-omarchy-01` | encrypted | no | no |
| `prem-win10-01` | not encrypted | yes | no |
| `prem-win11-01`, `prem-win11-02` | encrypted | yes | no |
| `prem-macos15-01`, `prem-macos26-01` | not encrypted | yes, bootstrap token escrowed | no |

- Every disk-encryption setting is off on VMs and on OS matrix, and both fleets' summaries are all zero.
- **The escrow by hand, from the activity feed.** On 2026-11-14 at 18:20 UTC a throwaway fleet was created
  with Linux escrow on, and the Ubuntu, Fedora and Omarchy LUKS hosts were moved in. Fleet logged the Ubuntu
  host's key as escrowed at 18:23 and read at 18:23. At 18:35 the hosts were moved out and the fleet
  deleted. That move is what removed the key. Whether the key slot it added is still on the disk, or in the
  baseline, can't be read without asking the host (experiment 1).
- The first nightly since the merges had not started when this was written (00:25 UTC, 2026-11-16).

## How each flow works at this build

### Linux: LUKS key escrow

- **Who is eligible.** Platforms `ubuntu` (Kubuntu too), `zorin` and `omarchy`, and any host whose OS
  version says Fedora (`server/fleet/hosts.go:1265-1274`). Omarchy needs fleetd 1.64.0
  (`server/fleet/service.go:2038-2042`); the lab runs 1.63.0.
- **Status is read from the key row alone** (`server/service/linux_mdm.go:10-45`): no row or an empty key is
  "Action required", a recorded error is "Failed", a stored key is "Verified". An eligible host that is not
  encrypted is "Action required" too, and the fleet's table counts it
  (`server/datastore/mysql/linux_mdm.go:12-78`).
- **The click.** The server refuses with a reason when the fleet's setting is off, the disk reads as
  unencrypted or fleetd is too old, and records that reason as the host's error
  (`ee/server/service/devices.go:286-341`). A request already with fleetd answers 409 for five minutes,
  unless fleetd reports the prompt cancelled or timed out (`server/service/orbit.go:1932-1941`).
- **The prompt.** zenity, or kdialog when zenity is missing, as the logged-in desktop user, for one minute
  (`orbit/pkg/luks/luks_linux.go:87-97, 390-419`). A wrong passphrase prompts again, without limit.
- **What a click does with nobody at the host:**

  | Host | What happens | What Fleet records |
  |---|---|---|
  | `prem-ubu2404-luks`, `prem-zorin18-luks` (zenity), `prem-kubuntu2404-luks` (kdialog) | The prompt is up for 60 s, then a notice for up to 60 s | Nothing. The request stops being in flight, the status stays "Action required", and *Create key* works again |
  | `prem-fedora45-luks` | No prompt | "Failed", `No supported dialog tool found` (`luks_linux.go:139-141`; fleetdm/fleet#58776) |
  | `prem-omarchy-01`, on fleetd 1.63.0 | The server refuses the click | "Failed", "Your version of fleetd does not support creating disk encryption keys on Linux…" (`devices.go:332-338`). On 1.64.0 it becomes Fedora's case |
  | Any host whose dialog can't start | No prompt | "Failed", `Failed to show passphrase entry prompt…` |

  The minute is the evidence that the dialog opened. A dialog that exits at once is reported as cancelled
  within seconds, and one that can't start as "Failed". So a second click at about 45 seconds that gets
  "Fleet is already asking this device for a disk encryption key", followed by a clean return to "Action
  required", says the prompt was on screen. This is the part that differs by desktop and session, and where
  #55701, #55069 and #52717 lived.
- **What a completed escrow does to the disk.** fleetd checks the typed passphrase, adds a random
  35-character passphrase in the lowest free slot, tests it against that slot, and sends it with the slot's
  salt (`luks_linux.go:216-314`). It refuses past 8 slots (`luks_linux.go:38, 357-359`). Nothing in Fleet
  frees a slot afterwards.
- **What Fleet checks later.** On each vitals refresh the server compares the stored slot and salt with the
  host's, and deletes the key when they no longer match (`server/service/osquery_utils/queries.go:4045-4182`).
  That is the one check of a stored key that needs the real host. fleetdm/fleet#58617 (open) is this check
  deleting a key escrowed seconds earlier.
- **An open prompt holds the host's queue.** fleetd's config loop waits for the dialog, so a script or an
  install queued behind it waits up to two minutes (`client/orbit_client.go:407-429`).

### Windows: BitLocker

- **When Fleet acts.** The fleet's Windows setting is on, the host is connected to Fleet's MDM and is not a
  server, and the disk reads as not encrypted, or encrypted with no key Fleet can read, or an error is on
  record (`server/service/orbit.go:1199-1270`). MDM is only the gate: fleetd does the work over WMI as
  SYSTEM, on `C:` only, with no MDM command, no prompt and no restart.
- **From a decrypted disk** (`orbit/pkg/bitlocker/bitlocker_management_windows.go:523-588`): delete any
  protectors, add a recovery password and a TPM protector, start encrypting used space. The key is escrowed
  when encryption starts, not when it ends.
- **From an encrypted disk** (the Windows 11 VMs): fleetd adds a new recovery password, removes the old
  ones, adds a TPM protector if nothing can unlock at boot, and then turns protection on
  (`bitlocker_management_windows.go:593-628`; `orbit/pkg/update/notifications.go:782-926`). A pending
  restart defers the last step, and the host shows "Action required" asking for it. **This is one-way.**
- **Statuses wait for the host's vitals.** "Verified" needs a refetch newer than the key that reports the
  disk encrypted, protection on and a boot protector (`server/datastore/mysql/microsoft_mdm.go:2183-2294`).
  The escrow asks for no refetch, so a test has to.
- **Undo.** Turning the setting off changes nothing on the disk, and nothing in Fleet decrypts. If a script
  decrypts the disk, the next vitals report puts the host back in the first case above, and fleetd encrypts
  again and overwrites the key. So the flow repeats without a rollback.
- **The Servers.** Not in MDM, so the server sends them nothing, shows no status and leaves them out of the
  counts. fleetd refuses on a Server as well (`orbit/pkg/update/notifications.go:949-956`). fleetdm/fleet#55549
  was such a host going silent on an enforcing fleet; its server fix is in this build, and fleetd's half
  comes with 1.64.0.
- **The PIN.** With `require_bitlocker_pin`, a PIN can be set from My device with nobody at the host, and
  from then on every boot stops at the PIN prompt. Nothing in Fleet removes it. **Never on a fleet that
  holds a host.**
- **Fleet never checks a BitLocker key against the disk** (`notifications.go:856-859`). A rollback to a
  baseline that differs from what Fleet stored leaves "Verified" with a stale key.

### macOS: FileVault

- **Two settings.** Enforcement sends the FileVault payload with a deferred, unskippable enablement at the
  next login and forbids turning FileVault off. Escrow sends only the escrow payload and Fleet's certificate
  (`ee/server/service/mdm_profiles.go:26-92`). Either reaches every MDM-enrolled Mac on the fleet at the
  reconciler's next 30-second tick.
- **Enforcement on the pool Macs.** Fleet waits for a logout or a restart, which an auto-login VM never
  gives, so the Macs would sit at "Action required". At the next restart macOS would ask for the password to
  turn FileVault on, and with FileVault on, automatic login is off and the disk unlocks only at a typed
  password. No code path in Fleet disables FileVault or does an authenticated restart. Each Mac serves two
  of premium's four workers. **This stays forbidden.**
- **Escrow alone can't encrypt anything.** A Mac with FileVault off would show "Action required" with
  "Disk encryption is off, and this host's fleet doesn't enforce it". It is still a new profile payload on
  both pool Macs, which `CLAUDE.md` says to ask about, and the history holds one bug it would have met
  (#53222, caught before release).
- **Everything else needs FileVault on:** the first escrow, Fleet's hourly check that it can decrypt the
  key, and the rotation by MDM command added in 4.94.
- **A Mac kept for FileVault** needs a third macOS VM slot, which waits for January, and something on the
  lab's side that types the password at boot. Neither exists.

### The key, once Fleet holds one

- **Who can read it.** Anyone who can read the host: admin, maintainer, technician, observer and observer+,
  global or for their own fleet. Only gitops can't (`server/service/hosts.go:4427-4442`;
  `server/authz/policy.rego:318-394`). The UI lists the action for all of them.
- **What is logged.** One "viewed the disk encryption key" activity for every successful fetch, from the UI
  or the API (`hosts.go:4445-4460`). Reopening the modal on the same page load fetches nothing.
- **The suite covers none of this.** No spec reads a key, opens the modal or probes the endpoint by role.
- **The key is in the page before the eye is clicked.** The modal's masked field holds it as its value
  (`frontend/components/forms/fields/InputFieldHiddenContent/InputFieldHiddenContent.tsx:28-38`), so a
  Playwright trace or DOM snapshot of that page contains it.
- **None of the 41 bugs is in this part.** It is worth one UI test of the modal and its activity, and the
  action by role as `premium/hosts/host-actions-role-access.spec.ts` does it, as a guard on a secret. Only
  where a slice already produces a key, which slice 2 does, and not as a slice of its own.

## What has broken in Fleet here

Bugs labelled `bug` in fleetdm/fleet, created from 2026-05-01 to 2026-11-15: 41, listed in the appendix.

| Where the bug lives | Bugs | Reachable on this lab with nobody at a host |
|---|---|---|
| A settings page, gitops or copy, with no host | 7 | The premium instance could have met one (#54609), and it needs no host |
| A host in some state, with nothing done on it during the test | 11 | 5: #49059, #50069, #54131, #55549, #55895 |
| The Linux escrow flow | 9 | 3: #52717, #54821, #58776 |
| The BitLocker flow | 7 | 3: #49401, #51998, #53426 |
| The FileVault flow | 5 | None: each needs ADE or a Mac outside Fleet's MDM |
| Scale, or code only | 2 | None |

- **Flows dominate, and customers find them.** Twelve of the 41 came from the field; nine of those are flow
  bugs and none is a settings bug. The suite's coverage today is settings only.
- **Nine more are possible with extra setup.** Four need only the passphrase prompt answered (#46529,
  #46535, #52236, #58617), and two need a host prepared as well (#46227, #47589). #55701 needs zenity on
  Omarchy, which the lab keeps off on purpose; #53222 needs escrow-only on a pool Mac; #52159 needs
  protectors rearranged by script.
- **Windows bugs cluster on disks Fleet did not encrypt** (#49278, #49401, #51098, #51998, #52159). The
  plain path from a decrypted disk produced one, #53426, caught before release.
- **The lab's first escrow by hand found #58776.**

## What can be tested, per platform

| Platform | With nobody at a host | Once per baseline | Only with a lab change | Not at all |
|---|---|---|---|---|
| **Linux** | "Action required" on five LUKS hosts and on an unencrypted eligible one; the fleet's table and its link to the Hosts list; My device's banner and *Create key*; the prompt opening and timing out (zenity, kdialog); the failure on Fedora and the refusal on Omarchy; "Failed" cleared by the move back | A completed escrow with the passphrase typed by hand, which is a manual test | A completed escrow every night: the lab types the passphrase, or a TPM-backed Ubuntu 26.04 VM. A passphrase in a slot other than 0 (#46227), or a noisy login shell (#47589), needs a host prepared for it | Multi-disk LVM (#47256): no such host |
| **Windows** | On `prem-win10-01`: enforcement to "Verified", the key modal, the viewed activity, the action by role, then decryption by script. A Server on an enforcing fleet staying healthy and uncounted. Later, by script on the same host: protection suspended, a boot protector removed | What Fleet makes of the Windows 11 VMs' state (#49401, #51998): after one pass they are ordinary encrypted hosts until rolled back | Nothing more | The PIN past its creation: the next boot stops at a prompt. Migration from another MDM (#49278) |
| **macOS** | Escrow-only: profile delivery, "Action required" and its copy | Nothing | FileVault itself: a third Mac VM and a way to unlock it at boot | ADE and Setup Assistant bugs: MacStadium has no ADE |

## Answering the passphrase prompt

| Way | Is the real dialog path tested | Where a passphrase lives | Cost |
|---|---|---|---|
| **The lab types it**, on request, into the VM's console | Yes, all of it | Where it is today: on the lab's server, readable by root only | The reset hook (`long-term-goals.md`, *What to provision next*, 1), with typing a passphrase added to what it does. The request can be a pull: the lab watches a signal in Fleet, such as a label the test puts on the host, so nothing in the lab is opened to the internet |
| **A TPM-backed Ubuntu 26.04 VM** | There is no dialog on this path; it is a different one, added in 4.90 | Nowhere: no passphrase | One VM rebuilt. The lab's server is full by memory, so `prem-ubu2604d-01` rebuilt this way would serve both its smoke and the escrow. Inferred: that the installer's TPM option works on the lab's virtual TPM |
| **A Fleet script types into the dialog** | Yes | The lab's passphrase, or a second one added for tests, in a Fleet custom variable | A keystroke tool installed on each host and a new baseline. A disk passphrase leaves the lab. Not recommended |
| **A fake `zenity` first on the PATH** | No: the dialog is the part replaced | As above | A file on each host. Never on Fedora or Omarchy. Not recommended |
| **A runner on the lab's network** | Yes | On the lab's server | A self-hosted runner for a public repository is the risk GitHub warns against. Not recommended |

fleetd's own endpoint would also store a key sent with the host's node key, with no request pending
(`server/service/orbit.go:1870-1906`). That fabricates the result and tests nothing, and the next vitals
refresh would delete the key.

## Repeating it

- **Fleet's side resets itself on a throwaway fleet.** The move back deletes the key row, the error and any
  pending request (`disk_encryption.go:606-659`). On a standing fleet nothing does: turning the setting off
  and on leaves the row as it was.
- **The disk's side does not, on Linux.** Each completed escrow keeps a slot, and fleetd stops at 8. A
  nightly escrow needs the slot removed by a script (`cryptsetup luksKillSlot` in batch mode, by the slot
  number a live report showed appearing) or a rollback. Removing the wrong slot leaves a VM that can't
  unlock at boot, so this is an experiment with Andrey present before it is a test.
- **A TPM-backed disk has no such limit.** fleetd replaces its one named key in place (`snapd_fde.go:86-113`).
- **Windows repeats by script.** Decrypt after the move back, so the server has stopped asking.

## Is the key the right one

| Platform | What Fleet checks itself | What stays unchecked |
|---|---|---|
| Linux | fleetd tests the new passphrase against its slot before sending it; the server compares slot and salt on each vitals refresh | That the passphrase the server stored and shows is the one fleetd tested |
| Windows | Nothing: the key is "decryptable" once the server can read its own ciphertext | Everything. fleetdm/fleet#52273 is the open request |
| macOS | That it can decrypt the escrowed blob, once | That the key unlocks the disk |

- **A check from outside is possible through Fleet alone.** The test reads the key, stores it as a Fleet
  custom variable, and runs a saved script that feeds the variable to `cryptsetup open --test-passphrase`,
  or compares it with the volume's recovery password in PowerShell, and prints only yes or no. Fleet expands
  the variable when the script goes to the host and never shows it (`server/service/orbit.go:1429-1430`).
- **Where the key then is:** in the test's memory, in Fleet's variables until the test deletes it, and in
  the script file on the host for the length of the run. Not in a script body, an output or a log. It is in
  a trace only if tracing is on, so the project that does this runs with traces and screenshots off.
- **Only for a key the test destroys:** the Windows 10 recovery password ends with the decryption, and a
  LUKS slot is removed in the same test.
- **My view:** add it to the BitLocker slice once that is stable. It would catch only a gross regression
  (a wrong or mangled key), and the history's stale-key bugs all needed an unusual sequence first. It is
  cheap once the rest exists, and no reason to build anything by itself.

## The shapes

| Shape | Bugs of the 41 it would have met | To build | To run | Risk to hosts and to the smokes | Needs |
|---|---|---|---|---|---|
| **1. A separate suite that reaches the hosts** | The prompt bugs, beyond the rest | A second suite, and a machine on the lab's network to run it | Unknown | The lab's passphrases within reach of a test run | A runner in the lab. The same reach comes from the hook, with the tests kept here |
| **2. Encryption on for OS matrix, some hosts escrowed** | #49059, #54131 as a standing picture; the click paths once | `os-matrix.yml`, `_sanity`, `CLAUDE.md`, a spec | Seconds | Every setting reaches sixteen hosts. Windows enforcement encrypts `prem-win10-01` once. After the first night "Failed" and a stored key stay, so nothing happens again | A person at each escrowed host, per baseline |
| **3. FileVault on the pool Macs** | None | Not applicable | Not applicable | Both pool Macs lose auto-login at their next restart, and Fleet can't undo it | Not possible on the pool |
| **4. A standing fleet of its own** | As 2 | As 2, plus the manifest, `labHostFleet`, the smokes' sweep and the Windows hosts' turn | Seconds | Five hosts that carry smokes change fleet for good | As 2 |
| **5. Nothing** | None | Nothing | Nothing | None | Nothing |
| **6. A project of this suite on throwaway fleets** | 7 with no host changed (slice 1); #53426 and the scripted BitLocker states (slice 2); the prompt bugs with the hook | A project and its workflow, a My device page object, the disk-encryption table and the Controls row, a host move that undoes itself | About 5 minutes for slice 1; slice 2 to be timed | A host is off OS matrix for the length of a test. Slice 2 changes `prem-win10-01` and puts it back | Andrey's word for the moves, and for BitLocker on that host |

**Why 6 and not 2.** Shape 2 is the cheapest to write and keeps every host where it is. But a state on a
standing fleet is entered once (*What decides it*, 5), so from the second night it asserts a photograph,
which is the part Andrey doubted. On a throwaway fleet the same statuses are reached from nothing every night,
the fleet's counts are exactly the hosts the test moved in, and OS matrix keeps its contract. The escrow by
hand on 2026-11-14 already ran this way.

**What 6 costs the smokes: nothing in the code.** The manifest, `labHostFleet`, the sweep and the Windows
hosts' turn stay as they are. The project must never run beside the smokes, which the shared concurrency
group and the config's refusal already give `premium-matrix`. A run killed mid-test leaves a host on a
`pw-*` fleet, or on Unassigned if the fleet was deleted first; the next run's cleanup returns it
(`returnLabHostsToTheirFleets`) and sweeps the fleet. That return has never yet moved a real host.

**Suite shape.** A project, `premium-encryption`, with its own folder and its own workflow in premium's
concurrency group, after the OS smokes in the nightly and by a flag in a branch run. One worker per host,
the hosts side by side. Traces and screenshots off for the tests that open a key. A separate suite would
need its own way into the lab, and everything except the passphrase is reachable through Fleet.

## Recommendation

1. **Slice 1, now: what needs nobody.** On each of the five LUKS hosts: into a `pw-*` fleet with Linux
   escrow on; "Action required" on the host, in the fleet's table and through its link to the Hosts list;
   My device from Host details, the banner and *Create key*; then what the click does on that host (the
   table under *Linux*); then back, and the status gone. One Windows Server on a `pw-*` fleet with Windows
   enforcement on: it still answers a refetch, shows no status and is not counted. No host is changed.
   Fedora's and Omarchy's rows carry `TODO(fleetdm/fleet#58776)`, and Omarchy's expectation follows the
   host's fleetd version.
2. **Slice 2, after experiment 5: BitLocker on `prem-win10-01`.** Enforcement on a `pw-*` fleet, "Enforcing"
   to "Verified" with refetches, the escrow activity, the key modal and its viewed activity, the action by
   role, then back to OS matrix and a script that decrypts. The cleanup's resting state gains "the Windows
   10 host is decrypted".
3. **Ask the lab for two things,** in this order: the reset hook able to type a passphrase, and
   `prem-ubu2604d-01` rebuilt with TPM-backed encryption. The first turns the largest Linux cluster (key
   slots: #46227, #46535, #52236, #58617) into a nightly test. The second is the only Linux escrow that
   needs nobody, on code that is one release old.
4. **Leave out:** FileVault in any form for now, the BitLocker PIN, the Windows 11 pool VMs, and a standing
   escrowed host.

**What slice 1 does not do.** It never completes a Linux escrow. Until the lab can answer the prompt, the
key-slot bugs stay a manual test.

## Experiments, for Andrey's approval

All wait until the first nightly since the merges has finished, with nothing else running on premium. Each
is one item to approve.

| # | Host | The change | What it answers | How it is undone | If it goes wrong |
|---|---|---|---|---|---|
| 1 | The five LUKS hosts | A live report of fleetd's `cryptsetup_luks_salt` table, slot numbers only | How many slots each disk has used, and whether the slot from 2026-11-14 is still there | Nothing to undo: a read | Nothing |
| 2 | `prem-ubu2404-luks` | A `pw-*` fleet with Linux escrow on; the host moved in; *Create key* clicked and left to time out; moved back; fleet deleted | That the statuses, the banner, the 60-second prompt and the reset by the move are as read | The move back, which the cleanup also does | A dialog on an unattended screen for up to two minutes |
| 3 | `prem-kubuntu2404-luks`, `prem-zorin18-luks`, `prem-fedora45-luks`, `prem-omarchy-01` | The same, one host at a time | kdialog's timeout; Fedora's and Omarchy's "Failed", and that the move back clears it | As 2 | As 2. Their smokes are not running then |
| 4 | `prem-ws2022-01` | A `pw-*` fleet with Windows enforcement on, PIN off; the host moved in for ten minutes and back | That a Server stays healthy, with no status and no count | The move back | It stops answering (#55549's symptom): moving it back ends it |
| 5 | `prem-win10-01` | The same fleet; the host encrypts and escrows; one restart by script; moved back; decrypted by script | That it needs nobody, how long each half takes, whether it boots unattended, whether fleetd rotates the key repeatedly before the first refetch, whether premium's firewall passes the decrypt script | The decrypt script; failing that, a rollback to the baseline, which only the lab's owner can do | It stops at a recovery prompt at boot: the lab's owner types the key Fleet holds, or rolls it back. Its smoke is red until then |
| 6 | `prem-ubu2404-luks`, with Andrey typing the passphrase | One completed escrow; a refetch; the key viewed; the slot removed by script; a refetch | Whether the key survives the first refetch (#58617), whether Fleet drops it when the slot goes, whether a slot can be freed without a rollback | A rollback to the baseline | The wrong slot is removed and the VM can't unlock at boot: a rollback |

## Decisions that are Andrey's

| # | Decision | My answer |
|---|---|---|
| 1 | Build step E at all | Yes, slices 1 and 2 |
| 2 | Throwaway fleets, or a standing setting on OS matrix | Throwaway fleets. It needs a new exception in `CLAUDE.md`: this one project may move its own host off OS matrix for the length of a test |
| 3 | Which hosts | The five LUKS hosts and one Server for slice 1, `prem-win10-01` for slice 2. No pool host |
| 4 | BitLocker every night with a decrypt, or once per baseline | Every night, if experiment 5 shows an unattended boot and a decrypt of reasonable length. Once per baseline is a manual test, and not worth a spec |
| 5 | May a test read a key and check it against the disk | Yes, in this project only, with traces and screenshots off, and only a key the same test destroys. Otherwise the modal is asserted without its value |
| 6 | Typing a passphrase, added to the reset hook | Yes. It is what makes a nightly LUKS escrow possible with the passphrase left where it is |
| 7 | `prem-ubu2604d-01` rebuilt with TPM-backed encryption | Yes, at the lab's next pass, if the installer takes the virtual TPM |
| 8 | FileVault on the pool Macs | No enforcement, ever, on a pool Mac. Escrow-only is safe as read and small in value: leave it until a Mac is kept for FileVault |
| 9 | The experiments above | 1 to 4 as soon as the nightly is read; 5 and 6 when he is at the lab |
| 10 | This branch | It is local: the docs commit `833c534`, this analysis, and the two corrections below. A docs PR of its own, or held until slice 1 |

## Corrected in this branch

`CLAUDE.md` (*Never deploy a passcode profile to a real host*) and `gitops/premium-fleetqa/fleets/os-matrix.yml`
said that disk encryption on OS matrix would prompt the LUKS hosts for their passphrase. Both now say what
the source says: Windows enforcement would start BitLocker on the MDM-enrolled host, and Linux key escrow
prompts nobody until *Create key* is clicked. The rule itself is unchanged: nothing is turned on for that
fleet. The file's header also said the fleet holds MDM-enrolled Macs; it holds none. The plan's step E
section has a short note of what this analysis corrects in it.

`os-matrix.yml` is one file that both gitops passes apply, so a standing state would be declared there once,
with `_sanity`'s `EMPTY_FLEETS` check changed beside it.

## Not exercised

Read from the source and still to be seen on a host:

- That zenity and kdialog time out on the lab's desktops as coded, and that the minute in flight tells an
  open dialog from a failed one.
- That `prem-win10-01` boots unattended after Fleet encrypts it, and how long encryption and decryption take.
- That fleetd rotates a BitLocker key every five minutes until the host's first vitals refresh after
  encryption (inferred from `server/service/orbit.go:1255-1261` and fleetd's five-minute wait).
- That premium's firewall passes scripts naming `manage-bde` or `cryptsetup`.
- That the Windows Servers lack the BitLocker feature, which is #55549's precondition.
- That `cryptsetup luksKillSlot` in batch mode frees a slot from a Fleet script, and that fleetd's own
  rollback, which calls it with no key and no batch flag (`luks_linux.go:491-498`), frees anything.
- That a throwaway fleet's default agent options leave a moved host as quick to answer as OS matrix's do.
- Everything about FileVault on a Tart VM.

Seen while reading, and worth a look once a host is in hand; none is filed or confirmed:

- A LUKS key that fails fleetd's own test after it was added leaves its slot on the disk
  (`luks_linux.go:299-311`).
- If escrow is turned off between the click and the passphrase, the server drops the key and answers
  success, fleetd shows its success dialog, and the slot stays (`server/service/orbit.go:1887-1895`).
- A Fedora host may get no disk-encryption banner on Host details (a reader's finding, not re-read).

## Appendix: the 41 bugs

"Reach" is whether a nightly on this lab would have met the bug: **1** in slice 1, **2** in slice 2, **W11**
only on the Windows 11 VMs' state, once per baseline, **P** with the passphrase answered, **+** with a host
prepared for it, **no** not on this lab. The classification is a reader's, from each issue's text.

| Issue | What | Platform | Reach |
|---|---|---|---|
| #48217 | Status list padding | all | no: visual |
| #48229 | BitLocker PIN tooltip font | Windows | no: visual |
| #50758 | No activity when toggled with Apple MDM off | Windows | no: needs MDM off |
| #52233 | Disabled controls where an empty state belongs, MDM off | macOS, Windows | no |
| #53190 | Tooltips misplaced, MDM off | macOS, Windows | no |
| #54609 | `fleetctl gitops` panics on a non-boolean `controls` value | all | no host needed |
| #55868 | API accepts macOS encryption with Apple MDM off, gitops rejects it | macOS | no |
| #47617 | My device lacks FileVault instructions | macOS | no: ADE |
| #49059 | The table doesn't count every eligible Linux host | Linux | 1 |
| #50069 | Omarchy missing from the supported-Linux checks | Linux | the smokes cover it |
| #52236 | No status change when the escrowed key becomes invalid | Linux | P |
| #52520 | Tooltip wrapping | all | no: visual |
| #53222 | Wrong copy for enforce-only and escrow-only | macOS | + : escrow-only on a pool Mac |
| #53503 | "Action required" flashes after a transfer to a fleet with encryption off | macOS | no: needs a Mac with a key |
| #54131 | All fleets with a disk-encryption filter shows only unassigned hosts | all | 1 |
| #55011 | Rotation returns 502 on a push failure and stays pending | macOS | no |
| #55549 | Windows hosts without BitLocker stop answering when encryption is enforced | Windows | 1 |
| #55895 | Windows counts show 0 while the host shows Enforcing | Windows | 1 |
| #46227 | Escrow fails when the passphrase isn't in slot 0 | Linux | P + |
| #46529 | *Create key* can prompt twice | Linux | P |
| #46535 | Escrowed slot deleted, new key never stored | Linux | P |
| #47589 | "Incorrect passphrase" for a valid one, noisy login shell | Linux | P + |
| #52717 | fleetd reports no progress: a dismissed prompt locks *Create key* | Linux | 1 |
| #54821 | An old failure keeps showing "Failed" | Linux | 1 |
| #55701 | The dialog fails silently on some Wayland sessions | Linux | no: needs zenity on Omarchy, which the lab keeps off |
| #58617 | The verify query deletes a key escrowed seconds earlier | Linux | P |
| #58776 | No zenity or kdialog on stock Fedora | Linux | 1 |
| #49278 | Migrated Windows device stuck at Enforcing | Windows | no |
| #49401 | Fleet never restores BitLocker protection | Windows | W11, or 2 by script |
| #50729 | PIN never enforced with Apple MDM off | Windows | no |
| #51098 | fleetd encrypts an encrypted disk when the status read fails | Windows | no |
| #51998 | PIN not required, yet stuck at "Action required" | Windows | W11, or 2 by script |
| #52159 | Rotation drops the PIN prompt; a paused conversion is ignored | Windows | + : risky |
| #53426 | "Action required" shown while the disk encrypts | Windows | 2 |
| #45369 | FileVault key not escrowed after ADE | macOS | no: ADE |
| #46977 | Stale key shown after wipe and re-enroll | macOS | no |
| #47680 | FileVault can't be turned on by `_fleetadmin` | macOS | no |
| #48965 | Unusable key escrowed for a Mac outside Fleet's MDM | macOS | no |
| #53398 | FileVault not enabled: no secure token | macOS | no |
| #53509 | The PIN modal's own poll loop | Windows | no: code only |
| #57708 | Key verification fails at 65,534 waiting keys | macOS | no: scale |

Three more are defect reports without the label: #47256 (multi-disk LVM, no such host), #55069 (Omarchy's
escrow never completed: slice 1 once fleetd 1.64.0 is on the host) and #42318 (the PIN not surfaced, needs
a person).
