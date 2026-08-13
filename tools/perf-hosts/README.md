# fleet-perf-hosts — keep the QA instances stocked with online hosts

Runs Fleet's **osquery-perf** host simulator on a MacStadium macOS VM so the
premium + free QA instances always have ~300 **online** hosts for the
host-dependent Playwright specs (Batch 4).

## TL;DR — the smart, low-infra approach

**Don't cycle hosts daily. Run osquery-perf as a persistent `launchd` daemon.**

osquery-perf is a long-running process: while it runs it keeps its simulated
hosts checking in (online). If it stops, its hosts go offline. So the whole
problem is just "keep the process running and relaunch it if it dies" — which is
exactly what `launchd` `KeepAlive` does natively. No cron, no custom supervisor,
no daily teardown/rebuild.

- Two `KeepAlive` daemons (premium + free) keep ~300 hosts online 24/7 and
  relaunch automatically on crash or VM reboot.
- `host_expiry=1` on each instance is the janitor: the only time hosts go
  offline is a crash/reboot restart (which enrolls a fresh set and abandons the
  old one); host_expiry deletes the abandoned set within a day. Steady state on
  each instance is ~300 online + at most a day's worth of abandoned offline.
- The binary is **self-contained** — osquery-perf `go:embed`s its OS templates
  and software/vuln data, so you build once and copy the binary anywhere; no
  need for the repo or a working directory at runtime.

If you specifically want a **forced fresh set every 24h** ("kill previous,
deploy new"), that's the optional `com.fleetqa.perf.refresh.plist` — see below.
You almost certainly don't need it; persistent + host_expiry is simpler and
gives the tests *stable* host IDs between reboots.

## Two corrections to the original plan

1. `go run ./agent.go` won't compile — osquery-perf is a multi-file
   `package main` (`agent.go` + `android_agent.go` + `certificates.go` +
   `ddm.go`). Build the whole package: `go build -o fleet-perf ./cmd/osquery-perf`
   (or `go run ./cmd/osquery-perf`). `install.sh` does the build for you.
2. A daily kill/restart isn't needed to keep hosts online — see above.

## Prerequisites (on the VM)

- macOS (MacStadium VM), admin/sudo.
- Go toolchain on `PATH`.
- A clone of `github.com/fleetdm/fleet` (for the osquery-perf source). Point
  `FLEET_REPO` at it (default `~/fleet`).
- Network reachability from the VM to both Fleet instances.
- On **each** Fleet instance: set **host expiry window = 1 day** (Settings →
  Organization settings → Advanced, `host_expiry_settings`). This is your
  cleanup for abandoned/offline sims.

## Credentials

The committed plists are **templates** — instance URL and enroll secret are
`__PLACEHOLDER__` tokens, because this repo is public. Fill them in locally:

```bash
cp perf-hosts.env.example perf-hosts.env
$EDITOR perf-hosts.env      # gitignored
```

`install.sh` sources that file and substitutes the values as it installs each
daemon, so real credentials only ever exist in `perf-hosts.env` and in the
rendered plists under `/Library/LaunchDaemons/`. Exporting the four vars instead
of creating the file works too. The install refuses to load a plist that still
contains a placeholder.

Note the rendered plists in `/Library/LaunchDaemons/` are mode 644 and therefore
world-readable on the VM — fine for a dedicated single-tenant QA box, not fine
on a shared one. See [Security note](#security-note).

## Install

```bash
# from this directory on the VM
FLEET_REPO=~/fleet ./install.sh
# …or, if you also want the optional forced 09:00 daily refresh:
FLEET_REPO=~/fleet ./install.sh --daily-refresh
```

`install.sh` builds `/usr/local/bin/fleet-perf`, renders the plists into
`/Library/LaunchDaemons/`, and `launchctl bootstrap`s them (starts now + at every
boot).

## Verify

```bash
sudo launchctl print system/com.fleetqa.perf.premium | grep -iE 'state|pid'
tail -f /usr/local/var/log/fleet-perf-*.log
```
Then watch the host count climb toward 300 in each instance's UI (spread over
`--start_period`). Filter by **Status: Online** — that's what the test fixtures
target.

## Operate

```bash
# Restart one instance's sims now (also how you'd force a fresh set on demand):
sudo launchctl kickstart -k system/com.fleetqa.perf.premium

# Stop / uninstall everything:
for l in premium free refresh; do
  sudo launchctl bootout system "/Library/LaunchDaemons/com.fleetqa.perf.$l.plist" 2>/dev/null || true
  sudo rm -f "/Library/LaunchDaemons/com.fleetqa.perf.$l.plist"
done
```

## Capacity & the ASAv firewall (100 Mbps)

Bandwidth is **not** the constraint. For 600 hosts total (300 per instance) at
these intervals, traffic is dominated by tiny periodic polls (distributed query
every 10s, config every 60s, scheduled-query logs every 10s) plus a small
software-inventory submission ~hourly per host (the per-OS payloads are tens of
KB; the 88 MB `software.db` is a server-side library pool, not per-host):

- **Steady state ≈ 3–6 Mbps** across both instances (~5% of 100 Mbps).
- **Peak initial-enrollment burst ≈ 10–20 Mbps**, spread over `--start_period 2m`
  (~2.5 hosts/sec). A tighter ramp (e.g. `30s`) bunches enrolls and can drop a
  handful during the burst — `2m` reliably lands the full count.
- The ASAv's connection/CPS limits are fine too: Go's keep-alive HTTP client
  reuses connections, so it's ~60 reused req/s and a few hundred concurrent
  connections, not 60 TLS handshakes/s.

**The real limit is local file descriptors.** macOS defaults to a 256-fd soft
limit and 300 hosts/process blow past it ("too many open files"). launchd
doesn't inherit shell `ulimit`, so both instance plists set
`SoftResourceLimits`/`HardResourceLimits` `NumberOfFiles = 10240`. If you ever
run the binary by hand instead, `ulimit -n 10240` first.

Verify empirically on the VM once it's running:
```bash
nettop -P -l 1 | grep fleet-perf     # per-process network throughput
# and watch the ASAv throughput graph — it should sit in the low single-digit Mbps
```

## Tuning

Edit the `ProgramArguments` in the plists, then re-run `install.sh` (it reloads).
Leave the `__*__` placeholders alone — change those in `perf-hosts.env`. The
remaining flags are: `--host_count`, `--os_templates <name>:<count>,…`,
`--start_period`, `--query_interval`, `--config_interval`. Template names come from
`cmd/osquery-perf/*.tmpl` (`macos_14.1.2`, `windows_11`, `ubuntu_22.04`, …).

Also set: `--live_query_no_results_prob 0` (default `0.2`). osquery-perf otherwise
returns *no rows* for ~20% of live queries; forcing 0 makes results deterministic
so live-query specs can assert an actual result row instead of just "responded".

**Free only:** `--http_message_signature_prob 0` (default `0.1`). ~10% of agents
otherwise request a host identity certificate from
`/api/fleet/orbit/host_identity/scep`, which is served only from Fleet's `ee/`
tree. On free it 404s, and osquery-perf treats that as fatal for the agent — it
returns out of `runLoop` and never retries — so free lands ~270 hosts instead of
300, with `Failed to get CA cert: 404` spam in the log. Premium serves the
endpoint and keeps the default.

### Want zero churn (stable hosts even across reboots)?

Add `--node_key_file /usr/local/var/fleet-perf-<instance>.nodekeys` to a plist.
osquery-perf then persists node keys and **resumes the same hosts** on restart
instead of enrolling new ones. Caveat: don't combine this with an aggressive
`host_expiry` — if the daemon is ever down longer than the expiry window, Fleet
deletes those hosts and the saved node keys go stale. With `host_expiry=1`,
prefer the default (no node_key_file); the abandoned-set-plus-janitor model
above is the clean fit.

## Security note

The **committed** plists carry no credentials — that's what `perf-hosts.env` and
the install-time substitution are for. But the **rendered** plists that land in
`/Library/LaunchDaemons/` do contain the enroll secret, and launchd requires them
to be `root:wheel` and readable, so they end up world-readable at `644` on the VM.

That's fine for a dedicated single-tenant QA box. If the VM is ever shared, move
each secret into a `root:wheel 600` env file read by a small wrapper script
instead, or rotate the secrets.

Keep `perf-hosts.env` out of git — it's gitignored, and `install.sh` refuses to
install a plist that still has an unsubstituted placeholder, so there's no path
where a real secret silently ends up in a committed file.

## How this serves the migration

This unblocks the host-dependent specs (see
`playwright/docs/qawolf-migration/README.md` → "Keeping the host population
online"), which need online hosts. Once these daemons are up and each
instance shows online hosts, the next agent can build the `liveMacosHost`
fixture and the host-execution specs. The Playwright fixtures resolve the host
by API at run time, so they tolerate host IDs changing across a reboot/refresh.
