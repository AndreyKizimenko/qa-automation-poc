# premium-fleetqa

GitOps config for the Premium QA Fleet instance. `default.yml` mirrors `free-fleetqa/` and configures the **No team** (team_id=0) scope; `fleets/workstations.yml` configures the **Workstations** fleet; `fleets/qa.yml` configures the **QA** fleet; `fleets/vms.yml` configures the **VMs** fleet, home of the real QA VMs.

```
premium-fleetqa/
├── default.yml              # org settings + No-team (team_id=0) controls/policies/etc.
└── fleets/
    ├── workstations.yml     # fleet "Workstations" — full scope
    ├── qa.yml               # fleet "QA" — the durable Fleet-maintained-app shelf
    └── vms.yml              # fleet "VMs" — the real VMs' durable fixtures (Claude, a report)
```

All `path:` references resolve to `../lib/` (or `../../lib/` from `fleets/`) — same source of truth as the free configs.

## Apply

```bash
set -a; source playwright/.env.premium; set +a
fleetctl gitops --context qa-premium \
  -f gitops/premium-fleetqa/default.yml \
  -f gitops/premium-fleetqa/fleets/workstations.yml \
  -f gitops/premium-fleetqa/fleets/qa.yml \
  -f gitops/premium-fleetqa/fleets/vms.yml
```

The nightly applies all four: `.github/workflows/gitops-premium.yml` exactly as above, and
`gitops-premium-min.yml` with the min variant's `default.yml` and `workstations.yml` plus this directory's
`qa.yml` and `vms.yml` — the QA and VMs fleets hold the suite's durable fixtures, which are the same in both
passes. The Playwright premium job shares a concurrency group with the nightly apply, so the two never
overlap: an apply deletes whatever its files don't declare, including a running test's per-run items.

Either fleet file can be applied on its own — `fleetctl gitops` accepts at most one global file but any number of fleet files, and a fleet file only rewrites its own fleet.

### `--context qa-premium` is not optional

**`fleetctl gitops` ignores `FLEET_URL` and `FLEET_API_TOKEN`.** It resolves the server from `~/.fleet/config`, and the `default` context on a Fleet developer's machine usually points at their own dev instance. Sourcing `.env.premium` therefore does *not* aim the command at premium-fleetqa; without `--context qa-premium` the whole config lands on whatever `default` points at, and the run still prints `gitops succeeded`.

Two ways to catch it: the `Server Version:` line in the output must match `GET /api/v1/fleet/version` on premium-fleetqa (the RC build timestamps differ between instances), and `fleetctl get fleets --context qa-premium` must list Workstations, QA, VMs and Mobile.

### Keep the client within a minor of the server

A client **far** behind the server silently no-ops the `software:` section: a 4.85.1 client against a 4.93
server printed `applying 20 software packages` and `gitops succeeded` while writing nothing, and never printed
the `applied N software packages` line a current client emits. That is what CI used to install for an RC server,
which has no published client of its own. A client **one** minor behind is fine: the released 4.92.1 applied
`vms.yml` and `qa.yml` against the 4.93 RC correctly, `applied N software packages` included (2026-09-28). CI
now installs the server's own release when it is published, else the latest release. Check for that `applied`
line after any apply that carries software.

**A known false report:** an apply can print `[-] deleted software - <name>` for a title it kept — seen for
`Fleet Playwright Install` on VMs and `zoom` on QA, both declared, both with the same installer id and upload
time afterwards. The deletion *report* matches titles on a different key from the deletion itself. Confirm by
the title's installer id before treating one as real.

### Do not pass `--delete-other-fleets`

`--delete-other-fleets` makes gitops the source of truth for which fleets exist, deleting any fleet not named in the run. **The premium instance has a fleet that is deliberately not under gitops**, and that flag would destroy it:

| fleet | why it is not in gitops |
|---|---|
| **Mobile** (104) | Holds ABM/VPP-enrolled mobile state that isn't reproducible from this repo. |

A run that names only some fleet files also leaves the others alone without the flag — so applying
`vms.yml` never touches QA or Workstations, and vice versa.

The flag is opt-in and off by default, so the command above is safe as written.

## Scope summary

| Scope | Profiles | Policies | Scripts | Software |
|---|---:|---:|---:|---:|
| No team (default.yml) | 23 | 27 | 11 | — |
| Workstations (fleets/workstations.yml) | 23 | 23 | 6 | — |
| QA (fleets/qa.yml) | — | — | — | 20 Fleet-maintained apps |
| VMs (fleets/vms.yml) | — | 2 | — | 2 Fleet-maintained apps (Claude, macOS + Windows) |

## The QA fleet's Fleet-maintained-app shelf

`fleets/qa.yml` parks 10 popular apps — each on both macOS and Windows, 20 catalog entries — on the QA fleet **permanently**. They exist to be listed, never installed.

**What it solves.** Fleet caches installer versions **per fleet** (`software_installers.global_or_team_id`), and a freshly added app caches exactly one version. Any test that needs "pin to an *older* version" therefore has nothing to pin to. Fleet's `maintained_apps_auto_update` cron runs hourly: for every app in latest/caret mode it downloads the newest published version, keeps the previous one (n-1, briefly n-2), and drops the rest. An app that lives on a fleet permanently accumulates a version history on its own — which is why this shelf is provisioned rather than seeded per test.

**Why the QA fleet.** `playwright/setup/cleanup.steps.ts` wipes installable software on **Unassigned** (`fleet_id=0`) and **Workstations** before and after every run, so a shelf on either is destroyed. On other fleets it only clears stranded version pins (QA, VMs) and sweeps the host-execution specs' named leftovers from VMs. QA held nothing before this file existed — no policies, scripts, profiles, reports or software — so bringing it under gitops (which deletes whatever it does not declare) cost nothing.

**Why these apps.** Every one ships updates on a scale of weeks or faster, and is offered on both platforms, so the odds that at least one entry has moved between two test runs are high:

| app | macOS slug | Windows slug |
|---|---|---|
| 1Password | `1password/darwin` | `1password/windows` |
| Claude | `claude/darwin` | `claude/windows` |
| Mozilla Firefox | `firefox/darwin` | `firefox/windows` |
| Google Chrome | `google-chrome/darwin` | `google-chrome/windows` |
| Notion | `notion/darwin` | `notion/windows` |
| Postman | `postman/darwin` | `postman/windows` |
| Slack | `slack/darwin` | `slack/windows` |
| Zed | `zed/darwin` | `zed/windows` |
| Microsoft Visual Studio Code | `visual-studio-code/darwin` | `visual-studio-code/windows` |
| Zoom | `zoom/darwin` | `zoom/windows` |

**Rules for anyone editing this list.**

- No `self_service` and no `setup_experience`. QA is the target fleet for the host-transfer specs (`premium/hosts/bulk-transfer.spec.ts`, `premium/hosts/host-transfer-permissions.spec.ts`), and an install-on-enroll flag would start real work on hosts those specs move in.
- No `version:` pin. A literal pin stops the hourly cron from downloading anything new (`ee/server/service/maintained_apps_auto_update.go`), which defeats the whole point of the shelf.
- Removing an app resets its accumulated version history to zero the next time it's added back. Add freely; remove only with a reason.
- **Watch the installer size.** premium-fleetqa is a 2 GB Render box, and Docker Desktop for Windows (~1.7 GB) 502'd it mid-apply — taking the instance down for every other spec running at the time. Zed replaced it. Nothing on this list should need more than a few hundred MB.
- Applying this file downloads all 20 installers on a fresh instance and runs for many minutes. **A software batch is all-or-nothing** — a 502 on the last app discards every download before it, so an interrupted apply starts over from zero. On a fresh instance, apply the macOS half first and widen to the full list once those are in storage; a re-run then reports `skipped downloading the software package (already in storage)` for everything it already has.
- Windows titles come back with the installer's own name (`Mozilla Firefox (x64 en-US)`, `Notion 6.1.0`) until Fleet's `reconcile_windows_maintained_app_titles` cron merges them. Anything keying on a title name should key on the macOS entry.

Consumed by `playwright/tests/e2e/premium/software/version-pinning.spec.ts`, which fails loud with recreation instructions if the shelf is missing.

## The VMs fleet's durable fixtures

`fleets/vms.yml` brings the **VMs** fleet — the three real QA VMs (macOS, Windows, Ubuntu) — under gitops, for
the fixtures that have to exist before a test starts:

- **`pw-host-report-results`**, a 5-minute report on the macOS VM, so it always holds a stored result for
  `playwright/tests/e2e/premium/hosts/host-report-details.spec.ts`.
- **Claude, kept installed** on the macOS and Windows VMs and tracking latest, the durable subject of
  `playwright/tests/e2e/premium/software/update-on-host.spec.ts`. Its Fleet-maintained entries carry no pin,
  so the hourly auto-update cron caches each new build and keeps the previous one; two "Claude is installed"
  **presence** policies (not patch policies — those would erase the "behind" state the spec creates)
  reinstall it on any VM that loses it at that VM's next policy run.
- **The install/uninstall subjects** of `playwright/tests/e2e/premium/software/software-lifecycle-on-host.spec.ts`:
  an inert "Fleet Playwright Install" `.pkg`, `.msi` and `.deb`, 7-Zip's ARM64 `.exe` (with its own install and
  uninstall scripts), and the Fleet-maintained Itsycal (macOS) and DB Browser for SQLite (Windows). The custom
  packages download from commit-pinned `raw.githubusercontent.com` URLs with a `hash_sha256`, so the URL never
  changes and Fleet skips the download once it holds the file. Their resting state is **uninstalled** — the
  opposite of Claude's — and because the titles never leave the fleet, Fleet always knows whether each is on
  its VM. `playwright/helpers/vm-fixtures.ts` lists the same entries for the specs; the two change together.

Everything else on the fleet is per-run (`fleet-pw-*` / `pw-*`): specs whose test changes the title itself add
it and delete it. `playwright/setup/cleanup.steps.ts`, at the start and end of every run, sweeps the ones a
timed-out test left behind, purges leftover `fleet-pw-*` packages from the Ubuntu VM, clears any version pin
here and on QA, and brings the VMs to their resting state: nothing of the suite's queued, the script timeout
at Fleet's default, every install/uninstall fixture uninstalled. It never deletes what this file declares.

**Bringing VMs under gitops deleted what it didn't declare** on the first apply (2026-09-28): a `Fail` policy
that ran `HelloWorld.sh` as its automation, and `HelloWorld.sh` itself. Neither was used by any spec. The enroll
secret and the report survived — a fleet file with no `secrets:` key leaves the fleet's secrets alone.
