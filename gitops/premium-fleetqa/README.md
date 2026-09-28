# premium-fleetqa

GitOps config for the Premium QA Fleet instance. `default.yml` mirrors `free-fleetqa/` and configures the **No team** (team_id=0) scope; `fleets/workstations.yml` configures the **Workstations** fleet; `fleets/qa.yml` configures the **QA** fleet.

```
premium-fleetqa/
├── default.yml              # org settings + No-team (team_id=0) controls/policies/etc.
└── fleets/
    ├── workstations.yml     # fleet "Workstations" — full scope
    └── qa.yml               # fleet "QA" — the durable Fleet-maintained-app shelf
```

All `path:` references resolve to `../lib/` (or `../../lib/` from `fleets/`) — same source of truth as the free configs.

## Apply

```bash
set -a; source playwright/.env.premium; set +a
fleetctl gitops --context qa-premium \
  -f gitops/premium-fleetqa/default.yml \
  -f gitops/premium-fleetqa/fleets/workstations.yml \
  -f gitops/premium-fleetqa/fleets/qa.yml
```

Either fleet file can be applied on its own — `fleetctl gitops` accepts at most one global file but any number of fleet files, and a fleet file only rewrites its own fleet.

### `--context qa-premium` is not optional

**`fleetctl gitops` ignores `FLEET_URL` and `FLEET_API_TOKEN`.** It resolves the server from `~/.fleet/config`, and the `default` context on a Fleet developer's machine usually points at their own dev instance. Sourcing `.env.premium` therefore does *not* aim the command at premium-fleetqa; without `--context qa-premium` the whole config lands on whatever `default` points at, and the run still prints `gitops succeeded`.

Two ways to catch it: the `Server Version:` line in the output must match `GET /api/v1/fleet/version` on premium-fleetqa (the RC build timestamps differ between instances), and `fleetctl get fleets --context qa-premium` must list Workstations, QA, VMs and Mobile.

### Keep the client on the server's version

`fleetctl` and the Fleet server must be on the same minor version. An older client **silently no-ops the `software:` section**: a 4.85.1 client against a 4.93 server printed `applying 20 software packages` and `gitops succeeded` while writing nothing, because it never printed the matching `applied N software packages` line the current client emits. Build a matching client from the Fleet checkout when the released one is behind:

```bash
cd ~/repositories/fleet && go build -o /tmp/fleetctl ./cmd/fleetctl
```

### Do not pass `--delete-other-fleets`

`--delete-other-fleets` makes gitops the source of truth for which fleets exist, deleting any fleet not named in the run. **The premium instance has two fleets that are deliberately not under gitops** and that flag would destroy both:

| fleet | why it is not in gitops |
|---|---|
| **VMs** (103) | Home of the real QA VMs, the `pw-host-report-results` report that `playwright/tests/e2e/premium/hosts/host-report-details.spec.ts` reads, and a `HelloWorld.sh` script. gitops would delete everything it doesn't declare. |
| **Mobile** (104) | Holds ABM/VPP-enrolled mobile state that isn't reproducible from this repo. |

The flag is opt-in and off by default, so the command above is safe as written.

## Scope summary

| Scope | Profiles | Policies | Scripts | Software |
|---|---:|---:|---:|---:|
| No team (default.yml) | 23 | 27 | 11 | — |
| Workstations (fleets/workstations.yml) | 23 | 23 | 6 | — |
| QA (fleets/qa.yml) | — | — | — | 20 Fleet-maintained apps |

## The QA fleet's Fleet-maintained-app shelf

`fleets/qa.yml` parks 10 popular apps — each on both macOS and Windows, 20 catalog entries — on the QA fleet **permanently**. They exist to be listed, never installed.

**What it solves.** Fleet caches installer versions **per fleet** (`software_installers.global_or_team_id`), and a freshly added app caches exactly one version. Any test that needs "pin to an *older* version" therefore has nothing to pin to. Fleet's `maintained_apps_auto_update` cron runs hourly: for every app in latest/caret mode it downloads the newest published version, keeps the previous one (n-1, briefly n-2), and drops the rest. An app that lives on a fleet permanently accumulates a version history on its own — which is why this shelf is provisioned rather than seeded per test.

**Why the QA fleet.** `playwright/setup/cleanup.steps.ts` wipes installable software on **Unassigned** (`fleet_id=0`) and **Workstations** before and after every run, so a shelf on either is destroyed. It touches no other fleet. QA held nothing before this file existed — no policies, scripts, profiles, reports or software — so bringing it under gitops (which deletes whatever it does not declare) cost nothing.

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
