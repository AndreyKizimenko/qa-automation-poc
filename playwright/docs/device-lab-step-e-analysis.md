# Device lab step E: disk encryption on real hosts. The analysis

Written 2026-11-16 for Andrey, who asked whether disk-encryption tests on the lab's hosts can add real value
before anything is built ([`device-lab-plan.md`](device-lab-plan.md), step E). No test is built. Nothing
on a host or an instance was changed to write it: Fleet's source, GitHub's issues and GETs against premium
only. It waits for his decisions, which are listed at the end.

**Revised later the same day.** After reading it, Andrey had the lab build two hosts kept for these tests,
`prem-win11-bde` and `prem-ubu2604-tpm` (*What the lab built*). They move the second slice to a host of its
own, add a third, and take both off the hosts that carry smokes. What the lab's session reported is marked
"the lab". A second round had the lab test whether a script can answer fleetd's passphrase prompt. It can
(*What the lab tested*), which adds a fourth slice, on a host that is still to be built.

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
- **First slice, with no host changed:** on each passphrase host, the statuses, My device's banner and *Create
  key*, then what the click does with nobody there (the prompt times out on three hosts, and fails in a
  known way on Fedora and Omarchy), and a Windows Server on an enforcing fleet. Seven of the eleven
  reachable bugs sit here.
- **Second slice: BitLocker on `prem-win11-bde`, end to end,** which needs nobody. The host rests in
  Windows 11's stock state (encrypted, protection off), where most of Fleet's Windows bugs were. Fleet adds
  a recovery key and a TPM protector and turns protection on, the test reads the key, and a script takes
  the protectors off again. Its second step, on the same host: a script decrypts the disk and Fleet
  encrypts it. One experiment by hand comes first.
- **Third slice: a completed Linux escrow every night, on `prem-ubu2604-tpm`.** Its disk is under Ubuntu's
  TPM-backed encryption, which fleetd escrows through snapd with no prompt, and a second escrow replaces
  the first in place. None of the 41 bugs is on that path, which shipped in July: the value is a real
  escrow, key and all, that repeats.
- **Fourth slice, on a host still to be built: a completed escrow on a passphrase disk.** Nothing in fleetd
  answers the passphrase prompt, but a script on the host can: the lab tested it through the desktop's
  accessibility API, with nobody at the host. The host gets a second passphrase that is for tests only and
  never leaves it. The key-slot bugs, the largest Linux cluster, are on this path only.
- **Not the pool, and no FileVault.** FileVault enforcement can't be undone by Fleet and the pool Macs
  would lose auto-login; Andrey set FileVault aside on 2026-11-16. BitLocker would change the pool's
  Windows 11 VMs for good.

## How this was checked

| Kind of claim | How it is marked |
|---|---|
| Read from premium (GETs only), 2026-11-15 and 16, build `4.95.0-rc`, `d6df44a` | "live" |
| Read in Fleet's source at that commit | a path, relative to Fleet's repository |
| Fleet's bug history | an issue number |
| Reasoned from the source, or from how the OS behaves, and not exercised on a host | "inferred", or listed under *Not exercised* |
| Reported by the lab's session on 2026-11-16 and relayed by Andrey. Not checked here, beyond what Fleet shows of the two new hosts | "the lab" |

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
   (`orbit/pkg/luks/luks_linux.go:121-136`, `orbit/pkg/luks/snapd_fde.go:70-127`). The lab has such a host
   since 2026-11-16, `prem-ubu2604-tpm`. The click is still what starts it. On a passphrase disk, a script
   on the host can answer the prompt in a person's place (the lab, *What the lab tested*).
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

Read on 2026-11-15 and 16. At 03:34 UTC on the 16th all 26 premium lab hosts, the two new ones included,
were online and on their role's fleet.

| Host | Fleet reports the disk as | In MDM | Key available |
|---|---|---|---|
| `prem-ubu2404-luks` | encrypted | no | no, and one archived |
| `prem-kubuntu2404-luks`, `prem-zorin18-luks`, `prem-fedora45-luks`, `prem-omarchy-01` | encrypted | no | no |
| `prem-ubu2604-tpm` | encrypted | no | no |
| `prem-win10-01` | not encrypted | yes | no |
| `prem-win11-bde` | encrypted | yes | no |
| `prem-win11-01`, `prem-win11-02` | encrypted | yes | no |
| `prem-macos15-01`, `prem-macos26-01` | not encrypted | yes, bootstrap token escrowed | no |

- Every disk-encryption setting is off on VMs and on OS matrix, and both fleets' summaries are all zero.
- **The escrow by hand, from the activity feed.** On 2026-11-14 at 18:20 UTC a throwaway fleet was created
  with Linux escrow on, and the Ubuntu, Fedora and Omarchy LUKS hosts were moved in. Fleet logged the Ubuntu
  host's key as escrowed at 18:23 and read at 18:23. At 18:35 the hosts were moved out and the fleet
  deleted. That move is what removed the key.
- **The slot that escrow added was still on the disk** (the lab). It counted two key slots on
  `prem-ubu2404-luks` and one on each of the other four passphrase disks, removed the extra one at Andrey's
  word, and retook that host's baseline at 01:07 UTC on 2026-11-16. Every passphrase disk's baseline now
  holds slot 0 alone.
- The first nightly since the merges had not started at 03:34 UTC on 2026-11-16.

## What the lab built, 2026-11-16

Both hosts are `special` in the manifest (PR #148), on OS matrix, with fleetd 1.63.0. No smoke runs on a
special host, and a spec asks for one by its purpose (`specialHostOfRun`). The table is the lab's report,
except its last row.

| | `prem-win11-bde` | `prem-ubu2604-tpm` |
|---|---|---|
| What it is | Windows 11 Pro 26H2, cloned from the lab's template, with its own virtual TPM 2.0 and Secure Boot on | Ubuntu 26.04.1 desktop, installed with the installer's hardware-backed encryption on a virtual TPM, with Secure Boot on. zenity is installed |
| The disk in its baseline | Used space encrypted, protection off, no key protectors | Two LUKS2 volumes that snapd owns, each with a TPM key, a fallback and a recovery key, and tokens `ubuntu-fde` and `ubuntu-fde-recovery`. Nothing escrowed |
| Its boot | Unattended | Unattended: the TPM releases the key |
| If it can't unlock | A rollback | The recovery key, which the lab holds, or a rollback |
| A rollback restores | The disk, the EFI variables and the TPM together | The same |
| Fleet, live | Disk encrypted, MDM on (manual), no key | Disk encrypted, platform `ubuntu`, no key |

What the lab found that bears on a test:

- **Windows 11 encrypts itself.** A fresh clone boots decrypted, and Windows' automatic device encryption
  brings it to the state above within minutes. So this host has no decrypted disk at rest, and a disk
  decrypted by script may be encrypted again by Windows before Fleet is asked (inferred). On an enforcing
  fleet, with a refetch while the disk decrypts, fleetd is asked before the decryption ends and encrypts
  as soon as it does (`orbit/pkg/update/notifications.go:982-987, 1043-1051`), so it should get there
  first. Experiment 5 shows which.
- **BitLocker can't bind to Secure Boot on these VMs**: the event log reports PCR 7 as unusable. The TPM
  protector Fleet adds would then be sealed to the firmware's measurements, and a firmware update on the
  lab's server could leave an encrypted VM at the recovery prompt. The lab inferred it from the log and did
  not test it. It is a reason for a test to take its protectors off again.
- **A fleet's automations reach a host within minutes.** In the two minutes `prem-win11-bde` sat on VMs
  after enrolling, that fleet's policy automation installed an app on it. A `pw-*` fleet holds nothing but
  the one setting.
- **The Ubuntu host's snaps are held**, its kernel among them, like every update in the lab. The monthly
  pass refreshes them and restarts once to see that the disk still unlocks.

## What the lab tested, 2026-11-16

A second round of questions, about more hosts. Nothing was built for it: the lab tried the first on a
throwaway clone of its Ubuntu 24.04 desktop template (GNOME on Wayland, zenity, a user logged in
automatically) and deleted the clone. This section is the lab's report, except its last paragraph.

**Can a script answer fleetd's passphrase prompt with nobody at the host? Yes.** A root script opened the
dialog with fleetd's own command line, and a run passed when zenity returned the passphrase with exit code
0, which is what fleetd reads.

| Method | On the stock Wayland session | Needs keyboard focus | Notes |
|---|---|---|---|
| The accessibility API (`python3-pyatspi`), run as the desktop user | 4 of 4 | No | Finds the window by its title, fills the hidden field and presses OK. One package more than a stock install |
| `ydotool`, as root | 4 of 4 | Yes | Types into whatever has focus. The dialog took focus by itself each time |
| `xdotool` | Not tried: it needs an Xorg session | No | The host would no longer be a stock install |
| A stand-in `zenity` ahead of the real one | 1 of 1 | No | Replaces the dialog, so it tests the escrow and not the prompt |

- **The dialog takes 5 to 8 seconds to show** on a VM with no GPU, so the script waits for the window and
  doesn't sleep a fixed time.
- **The passphrase belongs in a root-only file or on stdin.** As an argument it shows in the process list.
- **What was tested is the dialog, not fleetd.** A script replayed fleetd's command line. fleetd opening the
  dialog and taking the answer is experiment 6.
- **fleetd 1.64.0 is not out**: Fleet's update server lists 1.63.0 on `stable` and on `edge`. Until it is, a
  second Omarchy with zenity could show nothing. The server refuses the click, and the prompt can't open on
  Hyprland without the change 1.64.0 carries.
- **Room:** the lab's server takes one more 4 GB VM as it is. With a 6 GB one beside it, the margin for
  every VM filling its memory at once is gone.

**One line of the lab's reply disagrees with the source.** It says Fleet never checks a key against the
disk, so removing an escrowed slot doesn't upset it. That holds for BitLocker and for a TPM-backed disk. For
a passphrase disk the server compares the stored slot and salt with the host's on each vitals refresh, and
deletes the key when they differ (`server/service/osquery_utils/queries.go:4045-4182`). So a test removes
its slot after the host has moved back, or before that on purpose, as the test of that check.

## What the experiments showed, 2026-11-16

Andrey approved all of step E for the night of 2026-11-16, and the experiments ran from 06:47 UTC, before
the first nightly since the merges. Each ran as a scratch spec of the new project: a throwaway fleet, the
host moved in, the flow driven in the browser, the host moved back. Times are from the click or the move.

| # | Host | Predicted | Seen |
|---|---|---|---|
| 6 | `prem-ubu2404-luks-02` | The helper answers fleetd's prompt; a key in slot 2; the key survives a refetch; with its slot removed, Fleet drops it | All of it. The dialog opened 27 s after *Create key* (fleetd 1.63.0, so the launch without `XDG_RUNTIME_DIR` works on GNOME); the helper answered in 1 s; "Verified" and the escrow activity 2.5 min after the click, the key work on a 4 GB VM taking about two minutes. Two refetches kept it (#58617 did not show). With slot 2 removed by script, the next refetch dropped the key and the host read "Action required" again |
| 1 | `prem-ubu2404-luks` | The prompt opens and times out; "Already asking" while it is open; "Action required" throughout | The prompt opened 29 s after the click and closed a minute later; the status stayed "Action required" with no key. **No "already asking" ever**: fleetd 1.63.0 doesn't report the prompt's state, so the server never marks the request in flight, and eleven clicks in five and a half minutes queued three prompts in a row (#46529's symptom). A click before fleetd picks the request up gets the ordinary answer too |
| 4 | `prem-ubu2604-tpm` | No prompt; snapd's path; a second escrow replaces the first | "Verified" 29 s after the click, with no helper; after a move out and in, the second escrow took 7 s. Each logged `escrowed_disk_encryption_key` in the global feed (not in the host's own activities) |
| 5 | `prem-win11-bde` | From the stock state: a key, a TPM protector, protection on; fleetd re-encrypts a decrypted disk; an unattended boot | From the stock state: a recovery password and a TPM protector within 30 s ("Enforcing"), protection on and "Verified" at 80 s, one escrow activity (no repeated rotation). Decrypted by script in 3 min, during which Fleet showed "Verifying" with the disk read as not encrypted, then "Enforcing"; **fleetd encrypted it again** (XTS-AES 256, where Windows' own was 128) and it read "Verified" 2.5 min after the decryption ended. A restart with Fleet's protectors on the disk came back unattended. The reset left it encrypted, protection off, no protectors, with XTS-AES 256 |
| 2, 3 | The four matrix LUKS hosts; `prem-ws2022-01` | | Held until tonight's nightly has finished: those hosts carry smokes |

What the experiments add to the source:

- **Premium's firewall passes scripts that name `cryptsetup`, `Disable-BitLocker` and `Remove-BitLockerKeyProtector`.**
- **A helper started by a Fleet script outlives it** (`setsid`), and answers a dialog fleetd opens.
- **fleetd's success notice after an escrow holds its queue** until it closes or its minute runs out, so
  the helper closes it, and the notice's text is the host's own word that the escrow worked.
- **The move back drops a pending request too**: a click followed at once by the move never reached fleetd.
- **A run that stops mid-decryption leaves `prem-win11-bde` decrypted**: the first run of the BitLocker test
  failed there (a test bug), and Windows had not encrypted the disk again ten minutes later. The BitLocker test starts by encrypting such a disk
  as Windows does (XTS-AES 128, a TPM protector) and resetting it.

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
  | `prem-ubu2604-tpm` | No prompt: fleetd enrolls a key of its own through snapd (below) | The key and an "escrowed" activity, and the status reads "Verified" |
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
- **A disk under Ubuntu's TPM-backed encryption takes another path.** It starts the same way, with *Create
  key* and the same checks on the server (`luks_linux.go:99-104`), which `prem-ubu2604-tpm` passes as Fleet
  reports it today. fleetd then reads the root disk's LUKS tokens, and one whose type contains "fde" means
  snapd owns the disk (`orbit/pkg/luks/luks.go:92-113`, `luks_linux.go:512-539`). The lab's host has
  `ubuntu-fde`. The source notes that the name was still to be confirmed on real Ubuntu 26 hardware.
  - fleetd asks snapd for a recovery key, enrolls it under the name `fleet-escrow` on both volumes,
    replaces it in place when that name is taken, has snapd check it, and sends it
    (`snapd_fde.go:70-127`). There is no dialog, and nothing on screen when it succeeds.
  - The server stores it with no slot and no salt (`server/service/orbit.go:2086-2117`), and the check on
    each vitals refresh skips a key that has neither (`queries.go:4145-4147`). So a key stored on this
    path is never looked at again, and #58617 can't happen to it.
  - If fleetd doesn't recognise the disk, it falls to the passphrase path, which on this host is a prompt
    nobody can answer, or "Failed to find LUKS Root Partition" (`luks_linux.go:137-149`).

### Windows: BitLocker

- **When Fleet acts.** The fleet's Windows setting is on, the host is connected to Fleet's MDM and is not a
  server, and the disk reads as not encrypted, or encrypted with no key Fleet can read, or an error is on
  record (`server/service/orbit.go:1199-1270`). MDM is only the gate: fleetd does the work over WMI as
  SYSTEM, on `C:` only, with no MDM command, no prompt and no restart.
- **From a decrypted disk** (`orbit/pkg/bitlocker/bitlocker_management_windows.go:523-588`): delete any
  protectors, add a recovery password and a TPM protector, start encrypting used space. The key is escrowed
  when encryption starts, not when it ends.
- **From an encrypted disk** (the Windows 11 VMs, `prem-win11-bde` among them), in two passes. While Fleet
  holds no key, fleetd adds a new recovery password, removes the old ones, adds a TPM protector if nothing
  can unlock at boot, and escrows the key (`bitlocker_management_windows.go:593-628`;
  `orbit/pkg/update/notifications.go:1018-1041`). Once the key is stored and the host's vitals say
  protection is off, the server asks for protection instead (`server/service/orbit.go:1255-1266`), and
  fleetd turns it on (`notifications.go:782-926`). A pending restart defers that, and the host shows
  "Action required" asking for it. **Nothing in Fleet undoes either pass.** A script may: with protection
  suspended and the protectors deleted, the disk should read as the stock state again (inferred;
  experiment 5).
- **Statuses wait for the host's vitals.** "Verified" needs a refetch newer than the key that reports the
  disk encrypted, protection on and a boot protector (`server/datastore/mysql/microsoft_mdm.go:2183-2294`).
  The escrow asks for no refetch, so a test has to.
- **Undo.** Turning the setting off changes nothing on the disk, and nothing in Fleet decrypts or removes a
  protector. A script can do either. The next vitals report then puts the host back where it started, and
  on an enforcing fleet fleetd acts again and the new key replaces the old. So the flow repeats without a
  rollback.
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
- **A Mac kept for FileVault** needs a macOS VM of its own and something on the lab's side that types the
  password at boot. Neither exists, and Andrey set FileVault aside on 2026-11-16.

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
  where a slice already produces a key, which slices 2 and 3 do, and not as a slice of its own.

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
  protectors rearranged by script. Slice 4's host answers the prompt and has its test passphrase outside
  slot 0, which is #46227's condition, so it reaches five of the nine.
- **Windows bugs cluster on disks Fleet did not encrypt** (#49278, #49401, #51098, #51998, #52159).
  `prem-win11-bde` rests as such a disk. The plain path from a decrypted disk produced one, #53426, caught
  before release.
- **None is on the TPM-backed path**, which shipped in fleetd 1.58, in July.
- **The lab's first escrow by hand found #58776.**

## What can be tested, per platform

| Platform | With nobody at a host | Once per baseline | Only with a lab change | Not at all |
|---|---|---|---|---|
| **Linux** | "Action required" on the six encrypted hosts and on an unencrypted eligible one; the fleet's table and its link to the Hosts list; My device's banner and *Create key*; the prompt opening and timing out (zenity, kdialog); the failure on Fedora and the refusal on Omarchy; "Failed" cleared by the move back. On `prem-ubu2604-tpm`, a completed escrow: "Verified", the escrow activity, the key modal and its viewed activity, the action by role, and the key replaced by the next escrow | A completed escrow on a passphrase disk, typed by hand, which is a manual test. Seven per baseline at most, as each keeps a slot | A completed escrow on a passphrase disk every night: a host built to be driven by a test, whose method the lab has tested, or the lab typing the passphrase. A noisy login shell (#47589) needs a host prepared for it | Multi-disk LVM (#47256): no such host |
| **Windows** | On `prem-win11-bde`: enforcement from the stock state to "Verified" (a key escrowed, then protection restored), the key modal, the viewed activity, the action by role, then the protectors removed by script. A Server on an enforcing fleet staying healthy and uncounted. The path from a decrypted disk (#53426) on the same host, once a script has decrypted it. Later, by script: protection suspended, a boot protector removed | The restore of protection, if no script can return the disk to its stock state: later nights then start from a protected disk and only rotate the key | Nothing more | The PIN past its creation: the next boot stops at a prompt. Migration from another MDM (#49278) |
| **macOS** | Escrow-only: profile delivery, "Action required" and its copy | Nothing | FileVault itself: a third Mac VM and a way to unlock it at boot | ADE and Setup Assistant bugs: MacStadium has no ADE |

## Answering the passphrase prompt

| Way | Is the real dialog path tested | Where a passphrase lives | Cost |
|---|---|---|---|
| **A script on the host answers the dialog**, through the accessibility API | Yes: the real zenity, opened by fleetd | A second passphrase, for tests only, in its own slot and in a root-only file on that host. Nothing passes through Fleet, the repository or a report | A host built for it, with one package more than a stock install. The lab tested the method on 2026-11-16. **Recommended**, on that one host |
| **The lab types it**, on request, into the VM's console | Yes, all of it | Where it is today: on the lab's server, readable by root only | The reset hook (`long-term-goals.md`, *What to provision next*, 1), with typing a passphrase added to what it does. The request can be a pull: the lab watches a signal in Fleet, such as a label the test puts on the host, so nothing in the lab is opened to the internet. No longer needed first. It is the way to cover the other passphrase hosts without changing them |
| **A TPM-backed Ubuntu 26.04 VM** | There is no dialog on this path; it is a different one, added in 4.90 | Nowhere: no passphrase | Built on 2026-11-16, as `prem-ubu2604-tpm`. It doesn't stand in for the passphrase path, where the key-slot bugs are |
| **A fake `zenity` first on the PATH** | No: the dialog is the part replaced | As the first row | A file on the host. The lab tried it, and it works. Never on Fedora or Omarchy. Not recommended |
| **A runner on the lab's network** | Yes | On the lab's server | A self-hosted runner for a public repository is the risk GitHub warns against. Not recommended |

**How a test uses the first.** The script that answers has to be waiting before *Create key* is clicked, and
has to detach. fleetd fetches its next script only after every receiver of the current round has returned,
the dialog among them (`client/orbit_client.go:398-437`). So the test runs a script that starts the helper
in the background and returns, and then clicks. The helper reads the passphrase from the file on the host,
so the script's body holds no secret. It can also cancel the prompt, or give a wrong passphrase first.

fleetd's own endpoint would also store a key sent with the host's node key, with no request pending
(`server/service/orbit.go:1870-1906`). That fabricates the result and tests nothing, and the next vitals
refresh would delete the key.

## Repeating it

- **Fleet's side resets itself on a throwaway fleet.** The move back deletes the key row, the error and any
  pending request (`disk_encryption.go:606-659`). On a standing fleet nothing does: turning the setting off
  and on leaves the row as it was.
- **The disk's side does not, on a passphrase disk.** Each completed escrow keeps a slot, and fleetd stops
  at 8. The control hosts' baselines hold one slot, and the driven host's would hold two, the boot's and
  the test's, so six escrows fit before the seventh fails (the lab). A nightly escrow removes its slot by
  script (`cryptsetup luksKillSlot`, by the slot number a live report showed appearing, authorized by the
  test passphrase), and starts by removing any slot a dead run left above those two. Removing the wrong
  slot leaves a VM that can't unlock at boot. On a host kept for this, that costs a rollback and no smoke,
  and it is still an experiment before it is a test.
- **A TPM-backed disk has no such limit.** fleetd replaces its one named key in place
  (`snapd_fde.go:86-113`). The first escrow after a rollback adds the key and every later one replaces it.
  snapd has no call that removes a recovery key (`luks.go:119-123`), so only a rollback takes it off the
  disk, and it harms nothing there.
- **Windows repeats by script.** The protectors come off after the move back, so the server has stopped
  asking. Without the script the flow still repeats, as a rotation on a protected disk, and the restore
  of protection is then seen once per baseline.

## Is the key the right one

| Platform | What Fleet checks itself | What stays unchecked |
|---|---|---|
| Linux, a passphrase disk | fleetd tests the new passphrase against its slot before sending it; the server compares slot and salt on each vitals refresh | That the passphrase the server stored and shows is the one fleetd tested |
| Linux, a TPM-backed disk | snapd checks the new key before fleetd sends it | Everything after that: the server stores no slot or salt to compare |
| Windows | Nothing: the key is "decryptable" once the server can read its own ciphertext | Everything. fleetdm/fleet#52273 is the open request |
| macOS | That it can decrypt the escrowed blob, once | That the key unlocks the disk |

- **A check from outside is possible through Fleet alone.** The test reads the key, stores it as a Fleet
  custom variable, and runs a saved script that feeds the variable to `cryptsetup open --test-passphrase`,
  hands it to snapd's own check on the TPM-backed host, or compares it with the volume's recovery password
  in PowerShell, and prints only yes or no. Fleet expands the variable when the script goes to the host and
  never shows it (`server/service/orbit.go:1429-1430`).
- **Where the key then is:** in the test's memory, in Fleet's variables until the test deletes it, and in
  the script file on the host for the length of the run. Not in a script body, an output or a log. It is in
  a trace only if tracing is on, so the project that does this runs with traces and screenshots off.
- **Only for a key the test destroys:** the BitLocker recovery password goes with the protectors, a LUKS
  slot is removed in the same test, and on the TPM-backed host the test's second escrow replaces the key
  it read.
- **My view:** add it to the BitLocker slice once that is stable. It would catch only a gross regression
  (a wrong or mangled key), and the history's stale-key bugs all needed an unusual sequence first. It is
  cheap once the rest exists, and no reason to build anything by itself.

## The shapes

| Shape | Bugs of the 41 it would have met | To build | To run | Risk to hosts and to the smokes | Needs |
|---|---|---|---|---|---|
| **1. A separate suite that reaches the hosts** | The prompt bugs, beyond the rest | A second suite, and a machine on the lab's network to run it | Unknown | The lab's passphrases within reach of a test run | A runner in the lab. The same reach comes from the hook, with the tests kept here |
| **2. Encryption on for OS matrix, some hosts escrowed** | #49059, #54131 as a standing picture; the click paths once | `os-matrix.yml`, `_sanity`, `CLAUDE.md`, a spec | Seconds | Every setting reaches eighteen hosts. Windows enforcement encrypts `prem-win10-01` and takes over `prem-win11-bde`'s disk, once. After the first night "Failed" and a stored key stay, so nothing happens again | A person at each escrowed passphrase host, per baseline |
| **3. FileVault on the pool Macs** | None | Not applicable | Not applicable | Both pool Macs lose auto-login at their next restart, and Fleet can't undo it | Not possible on the pool |
| **4. A standing fleet of its own** | As 2 | As 2, plus the manifest, `labHostFleet`, the smokes' sweep and the Windows hosts' turn | Seconds | Five hosts that carry smokes change fleet for good | As 2 |
| **5. Nothing** | None | Nothing | Nothing | None | Nothing |
| **6. A project of this suite on throwaway fleets** | 7 with no host changed (slice 1); #49401, #51998, #53426 and the scripted BitLocker states (slice 2); none on the TPM-backed path (slice 3); five more on a host built to be driven (slice 4) | A project and its workflow, a My device page object, the disk-encryption table and the Controls row, a host move that undoes itself | About 5 minutes for slice 1; slices 2 to 4 to be timed | A host is off OS matrix for the length of a test. Slices 2 to 4 change only the hosts kept for them, which carry no smoke | Andrey's word for the moves, and for the flows that change a host |

**Why 6 and not 2.** Shape 2 is the cheapest to write and keeps every host where it is. But a state on a
standing fleet is entered once (*What decides it*, 5), so from the second night it asserts a photograph,
which is the part Andrey doubted. On a throwaway fleet the same statuses are reached from nothing every night,
the fleet's counts are exactly the hosts the test moved in, and OS matrix keeps its contract. The escrow by
hand on 2026-11-14 already ran this way.

**What 6 costs the smokes: nothing in the code.** The manifest, `labHostFleet`, the sweep and the Windows
hosts' turn stay as they are. Slice 1 moves five hosts that carry smokes, each for minutes; slices 2 to 4
run on special hosts, which no smoke uses. The project must never run beside the smokes, which the shared
concurrency group and the config's refusal already give `premium-matrix`. A run killed mid-test leaves a
host on a `pw-*` fleet, or on Unassigned if the fleet was deleted first; the next run's cleanup returns it
(`returnLabHostsToTheirFleets`) and sweeps the fleet. That return has never yet moved a real host.

**Suite shape.** A project, `premium-encryption`, with its own folder and its own workflow in premium's
concurrency group, after the OS smokes in the nightly and by a flag in a branch run. One worker per host,
the hosts side by side. Traces and screenshots off for the tests that open a key. A separate suite would
need its own way into the lab, and everything except the passphrase is reachable through Fleet.

## Recommendation

1. **Slice 1, now: what needs nobody.** On each of the five passphrase hosts: into a `pw-*` fleet with Linux
   escrow on; "Action required" on the host, in the fleet's table and through its link to the Hosts list;
   My device from Host details, the banner and *Create key*; then what the click does on that host (the
   table under *Linux*); then back, and the status gone. One Windows Server on a `pw-*` fleet with Windows
   enforcement on: it still answers a refetch, shows no status and is not counted. No host is changed.
   Fedora's and Omarchy's rows carry `TODO(fleetdm/fleet#58776)`, and Omarchy's expectation follows the
   host's fleetd version.
2. **Slice 2, after experiment 5: BitLocker on `prem-win11-bde`.** Enforcement on a `pw-*` fleet; the key
   escrowed, and its activity; protection restored; "Verified" after a refetch, and the fleet's counts; the
   key modal and its viewed activity; the action by role; then back to OS matrix, and a script that takes
   the protectors off. The cleanup's resting state gains "this host has no protectors". A second step,
   once the first is stable: while the host is still on the enforcing fleet, a script decrypts the disk,
   and Fleet encrypts it and replaces the key (#53426's path). It needs no second host, and it is the slow
   part: two conversions of the disk a night.
3. **Slice 3, after experiment 4: the TPM-backed escrow on `prem-ubu2604-tpm`.** Linux escrow on a `pw-*`
   fleet; "Action required"; *Create key* from My device; "Verified" and the escrow activity with nobody at
   the host; the key modal, its viewed activity and the action by role, on a real Linux key; out and in
   again for a second escrow, which replaces the first; then back.
4. **Slice 4, once its host is built and after experiment 6: a completed escrow on a passphrase disk.** The
   host is an Ubuntu 24.04 desktop like the control, with a second passphrase in slot 1 that is for tests
   only and also sits in a root-only file on the host. Linux escrow on a `pw-*` fleet; a script starts the
   helper that answers the prompt; *Create key* from My device; "Verified" and the escrow activity; a
   refetch that leaves the key in place (#58617); the key modal; the slot removed by script, and a refetch
   after which Fleet has dropped the key (#52236); then back. The same helper cancels the prompt or gives
   a wrong passphrase first, for those paths. It turns the largest Linux cluster, the key slots, into a
   nightly test. The TPM-backed host doesn't reach it: its path has no slot and no salt.
5. **Ask the lab for that host now, and for a second Omarchy with zenity once fleetd 1.64.0 is on a
   channel.** The reset hook no longer has to type a passphrase for a first nightly escrow. It stays the
   way to complete one on the other passphrase hosts, kdialog's among them, without changing them.
6. **Leave out:** FileVault, the BitLocker PIN, the pool's Windows 11 VMs, and a standing escrowed host.

**The order.** Slices 2 to 4 don't depend on each other. Slice 3 is the smallest: one host, no script on
it, and the least that can go wrong. I would build it straight after slice 1. Slice 4 has the most bugs
behind it and waits only for its host.

**What the slices reach.** Of the eleven bugs reachable with nobody at a host, slice 1 has seven and slice 2
three (#49401 and #51998, and #53426 in its second step). The smokes already cover #50069. Slice 3 has
none: it is there for a real escrow that repeats, on a path nothing here has run yet. Slice 4 adds five
that need the prompt answered (#46227, #46529, #46535, #52236, #58617).

**What they don't do.** No slice completes an escrow on the other passphrase hosts: Kubuntu's kdialog,
Zorin, and Fedora and Omarchy once they can prompt. Slice 1 sees their prompts open and time out.

## Experiments, for Andrey's approval

All wait until the first nightly since the merges has finished, with nothing else running on premium. Each
is one item to approve. The list's first item used to be a count of the key slots, which the lab has since
answered (*The live state*). The TPM-backed escrow is new, the BitLocker one has moved to its own host, and
the last no longer needs Andrey to type: it waits for a host instead.

| # | Host | The change | What it answers | How it is undone | If it goes wrong |
|---|---|---|---|---|---|
| 1 | `prem-ubu2404-luks` | A `pw-*` fleet with Linux escrow on; the host moved in; *Create key* clicked and left to time out; moved back; fleet deleted | That the statuses, the banner, the 60-second prompt and the reset by the move are as read | The move back, which the cleanup also does | A dialog on an unattended screen for up to two minutes |
| 2 | `prem-kubuntu2404-luks`, `prem-zorin18-luks`, `prem-fedora45-luks`, `prem-omarchy-01` | The same, one host at a time | kdialog's timeout; Fedora's and Omarchy's "Failed", and that the move back clears it | As 1 | As 1. Their smokes are not running then |
| 3 | `prem-ws2022-01` | A `pw-*` fleet with Windows enforcement on, PIN off; the host moved in for ten minutes and back | That a Server stays healthy, with no status and no count | The move back | It stops answering (#55549's symptom): moving it back ends it |
| 4 | `prem-ubu2604-tpm` | A `pw-*` fleet with Linux escrow on; the host moved in; *Create key* clicked; a refetch; the key viewed once; moved out and in, and clicked again; moved back; fleet deleted | That fleetd 1.63.0 takes the snapd path on this disk and escrows with no prompt, how long it takes, that "Verified" survives a refetch, and that the second escrow replaces the first | Fleet's side by the move back. fleetd's own key stays on the disk until a rollback, and harms nothing there | "Failed" on the host, which the move back clears, or a passphrase prompt nobody answers, if fleetd doesn't recognise the disk. At worst the disk doesn't unlock at its next boot: the lab types its recovery key or rolls back. No restart is part of this |
| 5 | `prem-win11-bde` | A `pw-*` fleet with Windows enforcement on, PIN off; the host moved in; the key escrowed and protection restored; one restart by script while Fleet still holds the key; the disk decrypted by script, and Fleet left to encrypt it; moved back; a script that suspends protection and deletes the protectors | That it needs nobody, how long the two passes and the two conversions take, whether fleetd rotates the key repeatedly before the first refetch, whether the VM boots unattended on Fleet's TPM protector, whether Fleet or Windows encrypts a disk a script has decrypted, whether a script returns the disk to its stock state, whether premium's firewall passes those scripts | The script; failing that, a rollback to the baseline, which only the lab's owner can do | It stops at the recovery prompt at boot: the lab's owner types the key Fleet holds, or rolls it back. No smoke runs on it |
| 6 | The passphrase host built to be driven, once it exists | A `pw-*` fleet with Linux escrow on; the host moved in; the helper started by script; *Create key* clicked; a refetch; the key viewed once; the slot removed by script; a refetch; moved back; fleet deleted | That the helper answers the prompt when fleetd opens it, whether the key survives the first refetch (#58617), whether Fleet drops it when the slot goes, whether a script frees the slot, whether premium's firewall passes those scripts | The slot's removal, which is part of it; failing that, a rollback to the baseline | The wrong slot is removed and the VM can't unlock at boot: a rollback. No smoke runs on it, and `prem-ubu2404-luks` is not touched. Nobody has to type |

## Decisions that are Andrey's

| # | Decision | My answer |
|---|---|---|
| 1 | Build step E at all | Yes, slices 1 to 3, and slice 4 when its host exists |
| 2 | Throwaway fleets, or a standing setting on OS matrix | Throwaway fleets. It needs a new exception in `CLAUDE.md`: this one project may move its own host off OS matrix for the length of a test |
| 3 | Which hosts | The five passphrase hosts and one Server for slice 1, `prem-win11-bde` for slice 2, `prem-ubu2604-tpm` for slice 3, the host of decision 12 for slice 4. No pool host, and `prem-win10-01` keeps to its smoke |
| 4 | BitLocker every night, or once per baseline | Every night. Experiment 5 says whether each night starts from the stock state or from a protected disk |
| 5 | May a test read a key and check it against the disk | Yes, in this project only, with traces and screenshots off, and only a key the same test destroys or replaces. Otherwise the modal is asserted without its value |
| 6 | Typing a passphrase, added to the reset hook | Not for a first nightly escrow any more: the host of decision 12 does that. Later, for the other passphrase hosts |
| 7 | A TPM-backed Ubuntu host | **Decided, 2026-11-16:** built as a host of its own, `prem-ubu2604-tpm`. `prem-ubu2604d-01` is unchanged |
| 8 | FileVault | **Decided, 2026-11-16:** set aside for now. My answer stays: no enforcement, ever, on a pool Mac |
| 9 | The experiments above | 1 to 4 as soon as the nightly is read; 5 when he is at the lab; 6 once its host is built |
| 10 | This branch | It is local: the docs commit `833c534`, a merge of `main` for the two manifest entries, this analysis, and the corrections below. A docs PR of its own, or held until slice 1 |
| 11 | Hosts kept for these tests | **Decided, 2026-11-16:** two built, and in the manifest by PR #148 |
| 12 | A passphrase host built to be driven by a test | Yes, now: Ubuntu 24.04 at 4 GB. The lab has tested the method and has the room |
| 13 | A second Omarchy with zenity | When fleetd 1.64.0 is on a channel, at 4 GB. Nothing could run on it before that |

## Corrected in this branch

`CLAUDE.md` (*Never deploy a passcode profile to a real host*) and `gitops/premium-fleetqa/fleets/os-matrix.yml`
said that disk encryption on OS matrix would prompt the LUKS hosts for their passphrase. Both now say what
the source says: Windows enforcement would act on both of the fleet's MDM-enrolled Windows hosts, encrypting
`prem-win10-01` and adding protectors on `prem-win11-bde`, and Linux key escrow prompts nobody until *Create
key* is clicked. The rule itself is unchanged: nothing is turned on for that fleet. The file's header also
said the fleet holds MDM-enrolled Macs; it holds none. `CLAUDE.md` counted sixteen hosts on the fleet, and
with the two new ones it holds eighteen. The plan's step E section has a short note of what this analysis
corrects in it, and of the two hosts.

`os-matrix.yml` is one file that both gitops passes apply, so a standing state would be declared there once,
with `_sanity`'s `EMPTY_FLEETS` check changed beside it.

## Not exercised

Read from the source and still to be seen on a host (the rest of this list was seen on 2026-11-16, *What the
experiments showed*):

- That kdialog times out as zenity does, and what Fedora and Omarchy show (experiment 2, after the nightly).
- That a Windows Server on an enforcing fleet keeps answering (experiment 3, after the nightly), and that
  the Servers lack the BitLocker feature, which is #55549's precondition.
- That fleetd's own rollback of a slot, which calls `cryptsetup luksKillSlot` with no key and no batch flag
  (`luks_linux.go:491-498`), frees anything.
- Everything about FileVault on a Tart VM.

Seen while reading, and worth a look once a host is in hand; none is filed or confirmed:

- A LUKS key that fails fleetd's own test after it was added leaves its slot on the disk
  (`luks_linux.go:299-311`).
- If escrow is turned off between the click and the passphrase, the server drops the key and answers
  success, fleetd shows its success dialog, and the slot stays (`server/service/orbit.go:1887-1895`).
- A Fedora host may get no disk-encryption banner on Host details (a reader's finding, not re-read).

## Appendix: the 41 bugs

"Reach" is whether a nightly on this lab would have met the bug: **1** in slice 1, **2** in slice 2, **4**
in slice 4, where the prompt is answered, **+** with a host prepared for it, **no** not on this lab. The
classification is a reader's, from each issue's text.

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
| #52236 | No status change when the escrowed key becomes invalid | Linux | 4 |
| #52520 | Tooltip wrapping | all | no: visual |
| #53222 | Wrong copy for enforce-only and escrow-only | macOS | + : escrow-only on a pool Mac |
| #53503 | "Action required" flashes after a transfer to a fleet with encryption off | macOS | no: needs a Mac with a key |
| #54131 | All fleets with a disk-encryption filter shows only unassigned hosts | all | 1 |
| #55011 | Rotation returns 502 on a push failure and stays pending | macOS | no |
| #55549 | Windows hosts without BitLocker stop answering when encryption is enforced | Windows | 1 |
| #55895 | Windows counts show 0 while the host shows Enforcing | Windows | 1 |
| #46227 | Escrow fails when the passphrase isn't in slot 0 | Linux | 4: the test's passphrase is in slot 1 |
| #46529 | *Create key* can prompt twice | Linux | 4 |
| #46535 | Escrowed slot deleted, new key never stored | Linux | 4 |
| #47589 | "Incorrect passphrase" for a valid one, noisy login shell | Linux | 4 + : a noisy login shell |
| #52717 | fleetd reports no progress: a dismissed prompt locks *Create key* | Linux | 1 |
| #54821 | An old failure keeps showing "Failed" | Linux | 1 |
| #55701 | The dialog fails silently on some Wayland sessions | Linux | no: needs zenity on Omarchy, which the lab keeps off |
| #58617 | The verify query deletes a key escrowed seconds earlier | Linux | 4 |
| #58776 | No zenity or kdialog on stock Fedora | Linux | 1 |
| #49278 | Migrated Windows device stuck at Enforcing | Windows | no |
| #49401 | Fleet never restores BitLocker protection | Windows | 2 |
| #50729 | PIN never enforced with Apple MDM off | Windows | no |
| #51098 | fleetd encrypts an encrypted disk when the status read fails | Windows | no |
| #51998 | PIN not required, yet stuck at "Action required" | Windows | 2 |
| #52159 | Rotation drops the PIN prompt; a paused conversion is ignored | Windows | + : risky |
| #53426 | "Action required" shown while the disk encrypts | Windows | 2, in its second step |
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
