# vm

UTM virtual machines used as real hosts for Fleet QA. Every VM has a known place, a known role and one row in an
inventory; `vm` starts and stops them, (re)enrolls their fleetd to whichever Fleet instance you're testing, and
checks that the VMs and Fleet agree.

Code lives here; your data (VM bundles, inventory, logins) lives in `$VM_DATA`, set in the shared `lab.env`.

```
$VM_DATA/
├── inventory.tsv   ← source of truth: one row per VM (format below)
├── LOGINS.md       ← guest logins, one row per VM (chmod 600). Kept in sync by vm
├── golden/         ← clean base images. Never enrolled, never booted for testing. Clone them.
├── hosts/          ← test hosts, enrolled to one instance at a time
├── isos/           ← installer media (optional; vm doesn't touch it)
└── scratch/        ← temp files. Safe to empty
```

## Prerequisites

- Apple Silicon Mac (x86 guests run emulated and slow). Tested on macOS 27 with **UTM 5.0**
  (`brew install --cask utm`).
- Xcode Command Line Tools (`xcode-select --install`): `/usr/bin/python3` and `swift`.
- `brew install jq`
- `fleetctl` with one context per Fleet instance, each logged in:
  `fleetctl config set --context rc --address https://fleet-rc.example.com && fleetctl login --context rc`
- Your terminal allowed to control UTM (System Settings → Privacy & Security → Automation). macOS asks the first time.

## Setup

```sh
git clone <this repo> && cd <repo>/tools
cp qalab/lab.env.example qalab/lab.env          # gitignored. Or ~/.config/qalab/lab.env, or set QALAB_ENV
$EDITOR qalab/lab.env                            # INSTANCES, INSTANCE_<i>_*, VM_DATA, INSTALLERS_DIR, SSH_KEY, GUEST_USER
ssh-keygen -t ed25519 -N '' -f ~/.ssh/qalab_ed25519   # or whatever SSH_KEY says
mkdir -p ~/qalab/vm && head -1 vm/inventory.example.tsv > ~/qalab/vm/inventory.tsv   # your VM_DATA
mkdir -p ~/qalab/installers/rc ~/qalab/installers/prev                             # one folder per instance
ln -s "$PWD/vm/bin/vm" /usr/local/bin/vm         # any dir on PATH; symlinks are followed
vm doctor
```

`vm doctor` prints a ✓/✗ line per prerequisite with the fix. `vm config` shows the resolved settings
(`vm config VM_DATA` prints one value; other tools use it to find the inventory).

Put fleetd packages in `$INSTALLERS_DIR/<instance>/` (Fleet UI → Hosts → Add hosts, or `fleetctl package`).
`vm enroll` takes the newest match: `fleet-osquery*_arm64.deb` / `_amd64.deb`, `fleet-osquery*.aarch64.rpm` /
`.x86_64.rpm`, `fleet-osquery*.pkg`, `fleet-osquery-arm64.msi`.

## Daily use

Run **`vm`** on its own for the interactive view: every VM with its UTM state, the instance its fleetd is enrolled
to, and what that instance reports (online/offline, last seen, fleetd version). **Enter** opens a VM: start/stop,
switch fleetd to another instance (greyed out until there's a package for that OS and arch), park/unpark. On the
list: `i` install to every running VM, `a` start all, `d` stop all, `c` check, `r` refresh, `q` quit. Every action
runs the matching subcommand, so the view and the CLI behave the same.

```sh
vm up                     # start every active test host, wait for IPs. Also: vm up <instance> | <name>...
vm enroll <name> <inst>   # switch a host's fleetd: wipes fleetd and its state, installs the newest package
vm install <inst>         # vm enroll every running host to <inst>, in parallel
vm status                 # NAME SERVER ACTIVE UTM IP
vm down                   # clean shutdown (forced after 90s). Also: vm down <instance> | <name>
vm park <name>            # leave a host out of vm up (vm unpark <name> to bring it back)
vm check [<inst>...]      # do the VMs and Fleet agree?
vm exec <name> 'cmd'      # run a command in a running guest as root
vm ls | start | stop | ip | clone | golden | rename | rm | config | doctor    # vm help
```

`vm up`/`vm down` only touch hosts, never goldens. `vm up` warns if you'd start more than 2 macOS VMs (Apple's limit).

`vm check` reports `MISSING` (not enrolled, or hostname ≠ VM name), `DUP` (several Fleet hosts share the hostname;
delete the extras), `COLLIDE` (one hardware UUID on several hosts: a clone kept its golden's identity), `STALE` (old
record on the instance the host moved away from) and `DRIFT` (bundle on disk or VM in UTM that isn't in the
inventory, or a VM with no row in `LOGINS.md`).

## Naming

`<os><ver>-<arch>`, lowercase, **15 characters max** (Windows' hostname limit). The name is also the guest hostname,
which is how `vm check` finds the host in Fleet. Goldens end in `-base`: `ubu24-arm-base` → host `ubu24-arm`;
`mac27-base` → `mac27` (macOS guests are always arm, so the arch is left out).

## Building a golden image

There are no build scripts; build it in UTM by hand (it lands in UTM's own library), then hand it to `vm`.

1. Create the VM in UTM, named `<name>-base`. Install the OS and updates. **Don't install fleetd.**
2. Do the per-OS prep below. Every guest needs a user named `$GUEST_USER` (default `qa`).
3. Shut it down, then `vm golden <name>-base` (asks for os, arch, purpose and the login to record in `LOGINS.md`).
   UTM exports it into `$VM_DATA/golden/` and drops its library copy.
4. `vm clone <name>-base <name> "purpose"`: an APFS clone (instant, shares blocks) with a new VM UUID, MAC and,
   for Apple-backend VMs, machine identifier, so Fleet doesn't merge clones into one host. It's registered in UTM
   and (QEMU only) gets `$INSTALLERS_DIR` as a shared folder.
5. `vm enroll <name> <instance>`. It sets the guest hostname to the VM name, then installs fleetd.

| Guest | Backend | What vm needs |
|---|---|---|
| Linux (Ubuntu/Debian, Fedora/RHEL) | QEMU | `qemu-guest-agent` enabled (vm runs everything through it, as root; no SSH needed). `apt-get` or `dnf`, `systemctl`, `hostnamectl`. The installers share mounted at `/mnt/installers`: `mkdir /mnt/installers` and add `share /mnt/installers 9p trans=virtio,version=9p2000.L,ro,nofail 0 0` to `/etc/fstab`. Last step before shutdown: `sudo truncate -s0 /etc/machine-id && sudo rm -f /var/lib/dbus/machine-id`, or clones fight over one DHCP lease. |
| macOS | Apple Virtualization | No guest agent: vm uses SSH and finds the IP from the Mac's DHCP leases. In the guest: user `$GUEST_USER`, **Remote Login** on (System Settings → General → Sharing), your `$SSH_KEY.pub` in `~/.ssh/authorized_keys` (mode 600), and passwordless sudo: `echo "$USER ALL=(ALL) NOPASSWD: ALL" \| sudo tee /etc/sudoers.d/$USER && sudo chmod 440 /etc/sudoers.d/$USER`. Skip Apple Account and MDM in Setup Assistant; FileVault off. Clones get no shared folder; `vm enroll` copies the pkg with scp. ADE doesn't work in VMs. |
| Windows 11 ARM | QEMU | UTM's Windows wizard plus the UTM/SPICE guest tools (includes the QEMU guest agent: `vm exec` runs `cmd /c`, shutdown goes through it). OpenSSH Server running, port 22 allowed on every firewall profile, `$GUEST_USER` an administrator with `$SSH_KEY.pub` in `C:\ProgramData\ssh\administrators_authorized_keys` (vm enrolls over SSH + PowerShell). |

Test passwordless access before `vm golden`: `ssh -i $SSH_KEY $GUEST_USER@<ip> 'sudo -n true && echo ok'`.

## Files

**`inventory.tsv`** (tab-separated, header row; see `inventory.example.tsv`):

| column | values |
|---|---|
| `name` | VM name = guest hostname |
| `role` | `golden` or `host` |
| `os` | `ubuntu24`, `fedora44`, `macos27`, `win11`… (the prefix picks the package type) |
| `arch` | `arm` or `x86` |
| `backend` | `qemu` or `apple` (from the bundle's config) |
| `server` | instance the host is enrolled to, or `-` |
| `purpose` | free text |
| `created` | `YYYY-MM-DD` |
| `active` | `yes` (`vm up` starts it), `no` (parked), `-` for goldens |

**`LOGINS.md`**: a Markdown table `| vm | user | password | notes |`, first column = VM name (see
`LOGINS.example.md`). `vm golden` creates it (chmod 600) if missing. Never commit it.

## Rules

1. Every VM has an inventory row and every row has a bundle: `vm ls` shows no `DRIFT`.
2. Goldens are never enrolled or booted for testing. To update one: boot, update, redo the prep, shut down.
   Existing clones are unaffected.
3. Hostname = VM name. **Rename with `vm rename`**: it updates the guest, UTM, the bundle, the inventory and
   `LOGINS.md`, and asks you to *Remove* (not Delete) the old entry in UTM midway, so the VM keeps its UUID.
4. One instance per host at a time; the inventory's `server` column is the record.
5. Don't leave VMs in UTM's own library: `vm golden` them or delete them.
6. `vm rm <name>` moves the bundle to the Trash; delete the host in Fleet too.
7. Keep `$VM_DATA` out of iCloud, Time Machine and Spotlight: bundles are tens of GB.

## If you use Fleet Hangar

Point each `INSTANCE_<i>_FLEETCTL` at that server's `build/fleetctl` and save the packages Hangar builds into
`$INSTALLERS_DIR/<instance>/` (folder names must match `INSTANCES`). After a local TUF rebuild rotates keys, re-run
`vm enroll <name> <instance>` with a fresh package; Fleet keeps the same host record.
