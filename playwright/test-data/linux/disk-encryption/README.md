# Linux disk-encryption scripts

Scripts the `premium-encryption` project (`tests/e2e/premium/encryption/`) runs on the lab's LUKS hosts
through Fleet, as ad-hoc scripts (`helpers/disk-encryption.ts` builds them). Fleet runs a Linux script as
root. None of them prints a passphrase or a key.

| file | what it does |
|---|---|
| `luks-answer-start.sh` | Starts `luks-answer.py` in the background as the desktop user and returns at once. fleetd fetches its next script only after the passphrase dialog's round has ended, so the helper has to be waiting before *Create key* is clicked |
| `luks-answer.py` | Waits for fleetd's *Enter disk encryption passphrase* dialog and fills it through the desktop's accessibility API (`pyatspi`), so it needs no keyboard focus. Modes: `answer`, `cancel`, `wrong-then-answer`. It then reads and closes fleetd's *Disk encryption* notice, which holds fleetd's queue until it closes. Its log, `/tmp/pw-luks-answer.log`, holds what it saw and did, never the passphrase |
| `luks-slots.sh` | Prints the root disk's key slot numbers (`slots: 0 1`), nothing else of the LUKS header |
| `luks-remove-escrow-slots.sh` | Removes every key slot above 1, the ones fleetd's escrows added, authorized by the host's test passphrase, and prints the slots left. Never touches slots 0 and 1. One script, so a test's cleanup is one round trip |
| `fleetd-escrow-log.sh` | Prints fleetd's own key-escrow log lines since a moment: each request it picked up, the path it took, each dialog it launched. Reads the journal only, so it runs on every LUKS host, the controls included |

## The hosts they are for

Only the two hosts the lab built to be driven by a test (`lab-hosts.json`, purposes *Test-driven LUKS
escrow on …*): `prem-ubu2404-luks-02` (Ubuntu 24.04, GNOME on Wayland) and `prem-omarchy-02` (Omarchy on
Hyprland). On each:

- **Slot 0** holds the lab's boot passphrase, which the lab's server types at boot. Nothing here touches it.
- **Slot 1** holds a test passphrase that opens nothing else, also in `/root/luks-test-passphrase` (root
  only, no trailing newline). The helper reads it on stdin from that file, so it never passes through
  Fleet, this repository or a report.
- **fleetd's escrow adds slot 2.** LUKS2 has eight slots, so a host would refuse a seventh escrow without
  the cleanup: each test removes the slot it added, and starts by removing any slot above 1 a dead run left.
- `python3-pyatspi` (Ubuntu) or `python-atspi` (Omarchy) and zenity are installed; the lab's baseline was
  taken with slots 0 and 1 only.

Never on the other LUKS hosts: `prem-ubu2404-luks` is the unmodified control, and `prem-fedora45-luks` and
`prem-omarchy-01` reproduce fleetdm/fleet#58776 by having no dialog tool.

## Why it is safe

The worst a script here can do is remove the wrong key slot, and `luks-remove-escrow-slots.sh` skips the two
that unlock the disk. If a host still can't unlock at boot, the lab rolls it back to its baseline; no smoke
runs on these hosts. The lab tested the accessibility method on a throwaway clone of its Ubuntu template
on 2026-11-16, and the suite's experiment the same day completed an escrow with it on
`prem-ubu2404-luks-02`.

Rebuilding a host is the lab's: its recipe is in the lab's private folder.
