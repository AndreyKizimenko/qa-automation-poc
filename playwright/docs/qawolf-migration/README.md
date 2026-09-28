# QA Wolf → Playwright migration

**Round 1: complete.** 269 flows handed over, 267 audited, 250 portable, **250 covered**. Lock and Wipe are the
only commands never fired — their **availability is asserted across macOS, Windows and Ubuntu on both tiers**,
so the gating is covered even though the destructive act isn't. Shipped in PR #35 (Batches 1–3) and PR #36
(Batch 4).

QA Wolf handed us a suite of `*.flow.js` files that were never runnable here — they import helpers that don't
exist in this repo, hardcode `@qawolf.email` accounts, and create teams inline. We treated them as **coverage
transcripts**: harvest *what* each tested, re-author *how* against this suite's standards.

## Where to look

| if you want to… | read |
|---|---|
| run a migration like this yourself | **[PLAYBOOK.md](PLAYBOOK.md)** |
| know whether we replaced QA Wolf, with numbers | **[PARITY.md](PARITY.md)** |
| know what shipped and why, batch by batch | **[DELIVERY-LOG.md](DELIVERY-LOG.md)** |
| check one specific flow's fate | **[audit/](audit/)** — per-flow disposition tables, C1–C10 |
| work on **round 2** (the 2026-08-28 export) | **[round-2/README.md](round-2/README.md)** — batches, POM work, standing rules |
| understand a specific spec's decisions | **the spec's own header comment** — that's where grounding lives |

`audit/` is the primary evidence: every flow, its disposition, its target path, and the notes behind the call.
Start there for "did we cover X?".

## Standing instance preconditions

The suite assumes these exist and does **not** create them. Each fails loud with recreation instructions, but
they're invisible to anyone re-provisioning an instance, so they're recorded here.

| what | where | needed by | if missing |
|---|---|---|---|
| `team-admin@fleetdm.com` — admin on **Workstations + VMs**, shared `FLEET_STATIC_USER_PASSWORD`, `force_password_reset: false` | premium | every team-admin case (C1 #16/#26/#27, labels role-access) | recreate via `POST /users/admin`, then clear the reset flag — `PATCH` won't do it, see [PLAYBOOK §6](PLAYBOOK.md#6-instance-level-gotchas-worth-knowing-up-front) |
| Report **`pw-host-report-results`** on the **VMs** fleet — interval 300, `SELECT 'bar' AS foo` | premium | `premium/hosts/host-report-details.spec.ts` | re-apply `gitops/premium-fleetqa/fleets/vms.yml` with `--context qa-premium`, then allow ~3.5 min for one scheduled run |
| **Claude installed on the macOS + Windows VMs**, tracking latest, from the **VMs** fleet | premium | `premium/software/update-on-host.spec.ts` | re-apply `fleets/vms.yml`; its "Claude is installed" policies reinstall Claude at each VM's next policy run (a refetch triggers one). The pin walk stays skipped until Fleet has cached a second Claude build |
| Real VMs online (macOS/Windows MDM-enrolled) + the osquery-perf load fleet | both | every host-dependent spec | see "Keeping the host population online" below |
| **Fleet-maintained app shelf on the QA fleet** — 10 apps × macOS + Windows, unpinned, never installed | premium | `premium/software/version-pinning.spec.ts` | re-apply `gitops/premium-fleetqa/fleets/qa.yml` with `--context qa-premium`; the older-version case stays skipped until Fleet's hourly cron caches a second build |

The report has to live on a **fleet**: `cleanup.steps.ts` wipes global reports at the start of every run, and
never touches other fleets. Verified to survive overnight plus repeated cleanup cycles.

The same reasoning puts the software shelf on **QA**: `cleanup.steps.ts` wipes installable software on
Unassigned and Workstations only. **VMs** is under gitops too since batch D (`fleets/vms.yml`) — the only fleet
with real hosts, so the only place a Fleet-maintained app can be kept *installed*. Gitops deletes whatever a
declared fleet doesn't list, so `vms.yml` declares the report above as well. `cleanup.steps.ts` touches both
fleets in two narrow ways: it clears version pins, and it sweeps the host-execution specs' own named leftovers
from VMs. See [round-2/D-host-execution.md](round-2/D-host-execution.md#the-fma-fixture-set).

## Two host populations

Both share each instance and are good at opposite jobs — pick per spec via
`findOnlineHost(request, platform, { kind })`:

- **`'real'`** — genuine device behaviour. Runs the query's actual SQL, reports real users and agent versions,
  supports MDM. Only ~3 per tier, so **never destroy one**.
- **`'simulated'`** — volume for bulk work. Ignores live-query SQL, returns no rows ~20% of runs, and matches
  contradictory labels. Disposable, but a deleted simulation **never comes back on its own**.

Split by **hardware model**: the QA VMs report `VirtualMac2,1` or `QEMU Virtual Machine`, osquery-perf reports
fixed consumer models. It holds on both tiers and across re-enrollment — MDM enrollment stopped being a usable
signal once the perf-hosts tooling began enrolling a share of the simulations. Every VM is **ARM** (Apple M4
macOS, ARM Windows 11, aarch64 Ubuntu), which decides which installers can land on them.

Full comparison: [PLAYBOOK §7](PLAYBOOK.md#7-test-hosts-fidelity-vs-volume).

## Keeping the host population online

The simulated pool is Fleet's own `cmd/osquery-perf` binary run as two persistent
macOS `launchd` daemons (one per tier) on a dedicated QA VM. osquery-perf keeps its
hosts checking in only while the process lives, so `KeepAlive` is the whole
mechanism — no cron, no teardown/rebuild cycle. The daemons and their installer are
in [`tools/perf-hosts/`](../../../tools/perf-hosts/README.md). What matters for
reading the specs:

| Knob | Value | Why the suite depends on it |
|---|---|---|
| `--host_count` / `--os_templates` | 300, split `macos_14.1.2:100,windows_11:100,ubuntu_22.04:100` | Every spec resolving a `'simulated'` host by platform assumes all three exist |
| `--live_query_no_results_prob` | `0` (default `0.2`) | Otherwise ~20% of live queries return no rows and live-query specs flake |
| `--start_period` | `2m` | A tighter ramp bunches enrollments and drops hosts during the burst |
| `host_expiry_settings` on each instance | 1 day | The janitor for the abandoned set a crash/reboot leaves behind |
| `NumberOfFiles` resource limit | 10240 | 300 hosts/process exceeds macOS's 256-fd default and the process dies |

Two consequences the specs are written around: host IDs change across a daemon
restart (so fixtures resolve hosts by API at run time, never by stored id), and a
deleted simulation never returns on its own — osquery-perf enrolls once at startup
with no node-invalid recovery.

## Round 2 — in progress (54 of 127 flows shipped)

A second export (`qa-wolf/Fleet_20260828 (1)/`) arrived 2026-08-28 with QA Wolf's live free and premium
environments. Three of its five folders were round 1 re-exported as TypeScript and have been removed; of the
**156 new flows, 29 were cut** and the surviving **127 map to 60 target specs across seven batches.**

| | |
|---|---|
| **shipped** | batches **A**, **B**, **C** and **gitops-mode V1** — 54 flows, [PR #61](https://github.com/AndreyKizimenko/qa-automation-poc/pull/61) |
| **next** | **D** (host execution) — needs nothing that doesn't already exist |
| **blocked** | **F** — mailbox, IdP and Fedora host; **E** needs an inert profile fixture first |

**Everything round 2 lives in [`round-2/`](round-2/)** — start at its [README](round-2/README.md).
We keep their coverage, not their tests.

## Source flows

`flows-Free/` (52) and `flows-Premium/` (217) at the repo root, untracked and gitignored. Kept for reference
only — they are not runnable and are not part of the suite.
