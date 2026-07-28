# Windows MDM load-test tools

Helper scripts for driving the profile and team-transfer scenarios in the Windows MDM load
test plan. The plan and the environment it runs against live in the **fleet** repo, not here:

- `infrastructure/loadtesting/terraform/windows-mdm-loadtest.md` — the runbook these scripts
  implement, with the scenario numbering referenced below.
- `infrastructure/loadtesting/terraform/readme.md` — standing up the environment.

These scripts do **not** stand up that environment (terraform, migrations, osquery-perf
containers) — follow the runbook for that. They cover the profile-application and
host-transfer scenarios once the fleet of simulated Windows hosts is up and enrolled.

## Why these exist

The load-test scenarios boil down to a handful of API operations against the running instance:

| Runbook scenario | Operation | Tool |
|---|---|---|
| 3. Profile batch fan-out (add) | apply 100 CSP profiles to all hosts | `batch_profiles.sh apply` |
| 4. Profile batch fan-out (replace) | swap to 100 differently-named profiles | `batch_profiles.sh replace` |
| Profile update (in-place modify) | re-push 100 same-named profiles with changed contents | `batch_profiles.sh update` |
| 5. Profile deletion | remove all profiles | `batch_profiles.sh delete` |
| 6. Team transfers | move enrolled hosts A→B in ≤30k batches | `transfer_hosts.sh` |

They all hit the instance's HTTP API, so run them from anywhere with network + token access —
nothing needs to be copied onto the servers.

## GitOps vs. the batch API

`fleetctl gitops` applies profiles by calling the **same** endpoint these scripts use
(`POST /api/latest/fleet/mdm/profiles/batch` → `BatchSetMDMProfiles` → the reconcile cron).
Hitting the endpoint directly is preferred for load testing because:

- **Same code under test.** No coverage is lost vs. GitOps — it's the identical server hot path.
- **Clean A/B.** Comparing two Fleet versions (e.g. 4.87 vs 4.89) needs the *identical* request
  on both. GitOps additionally diffs and re-applies everything else in the config (app settings,
  queries, policies, software, scripts) and requires the full team config present — confounding
  noise on top of the profile fan-out you're measuring.
- **The scenarios are literally "one batch."** apply / replace / delete each map to a single
  declarative POST that's trivially timeable.

Use GitOps only as an optional secondary run to confirm the customer-facing workflow degrades
the same way. Do headline numbers off the batch API.

## Profile realism

The 100 generated profiles mirror the LocURI-count distribution of the real profiles in the
fleet repo's `it-and-security/lib/windows/configuration-profiles/` — mode at 1 LocURI with a meaningful
multi-LocURI tail up to 6 — rather than 100 trivial single-setting profiles, which would
understate per-session SyncML payload and verification cost. Distribution:

```
45× 1 LocURI   20× 2   15× 3   8× 4   7× 5   5× 6   → 227 LocURIs, avg 2.27/profile
```

LocURIs are globally unique across the batch **and disjoint between batch A and batch B**
(A uses a `_loadtesta_` LocURI namespace, B uses `_loadtestb_`). This disjointness is load-bearing
for scenario 4 — see the gotcha below. LocURIs are built from real Policy-CSP path families.
All 100 profiles in both batches pass Fleet's real validator
(`MDMWindowsConfigProfile.ValidateUserProvided`): valid SyncML, `./`-prefixed LocURIs, no
`<?xml?>` declaration, no BitLocker/reserved URIs.

## Files

Committed:

| File | What it is |
|---|---|
| `gen_win_profiles.py` | Generator for the 100-profile batches (deterministic). `--rev N` bumps contents in place for the update scenario. |
| `generate.sh` | Produces every batch below in one shot. |
| `batch_profiles.sh` | apply / replace / update / delete driver, with timing. |
| `transfer_hosts.sh` | Interactive batched team-transfer driver. |

Generated, and gitignored:

| Path | What it is |
|---|---|
| `batch_A.json` | Ready-to-POST batch body: 100 profiles named `LoadTest A NNN`. Scenarios 3 & 5. |
| `batch_B.json` | Ready-to-POST batch body: 100 profiles named `LoadTest B NNN`. Scenario 4 (replace). |
| `batch_A_r<N>.json` | Batch A with bumped contents — the in-place update scenario. |
| `profiles_*/` | The same profiles as individual `.xml` files, for GitOps `custom_settings`. |
| `ids_<team>.txt` | Host-ID cache written by `transfer_hosts.sh`. |

**Run `./generate.sh` after cloning** — nothing generated is committed:

```bash
./generate.sh        # batches A, B, and A-rev2
./generate.sh 3      # ...with A-rev3 instead, for the next update round
```

The generator has no randomness or timestamps, so this is byte-identical on every machine.
That's what makes it safe to leave the artifacts out of git while still comparing two Fleet
versions against provably identical payloads — as long as both runs use the same commit of
`gen_win_profiles.py`. Editing the generator between runs invalidates the comparison.

## Setup

Create an **API-only** user so session churn doesn't skew timings, and grab its token:

```bash
fleetctl user create --name loadtest --email loadtest@example.com --api-only --global-role admin
# log in as that user, then read the token from ~/.fleet/config
```

```bash
export FLEET_URL="https://your-instance"    # no trailing slash
export FLEET_TOKEN="<api-only token>"
```

Requires `bash`, `curl`, `jq`, and `python3`.

## Usage — profile scenarios (3, 4, 5)

The batch endpoint is **declarative**: it sets the team's profile set to exactly what you POST.
Success is **HTTP 204**.

```bash
export TEAM_ID=1      # target team; omit for "No team" / global

# Scenario 3 — apply 100 profiles to all hosts in the team
./batch_profiles.sh apply batch_A.json

# ...let ReconcileWindowsProfiles drain (full sweep ~25 min at 100k). Watch queue depth below.

# Scenario 4 — replace with 100 differently-named profiles (exercises the Replace path).
# This is also where the 100-profile modification timeout (#48349) shows up.
./batch_profiles.sh replace batch_B.json

# Scenario 5 — delete all profiles (empty set)
./batch_profiles.sh delete
```

Run the identical commands with the same JSON files against each instance being compared.

## Usage — profile update / in-place modify

This is the **modification** path: re-apply the profiles that are *already on* the team, keeping
the **same names and same LocURIs** but with changed contents. Fleet diffs by name, sees a new
checksum, and re-verifies + re-pushes all 100 profiles to **every** host — without any add/remove
churn. It's distinct from `replace` (scenario 4), which fully removes batch A and adds a
differently-named batch B (an add + remove, not a modify).

It exists to generate a large, concurrent **modification-path** writer load — e.g. to run
alongside the certificate-ingestion loadtest for
[#49705](https://github.com/fleetdm/fleet/issues/49705), where the concern is the writer being
serialized by inventory writes. Re-pushing 100 profiles × N hosts drives heavy concurrent writes
to `host_mdm_windows_profiles` and `windows_mdm_command_queue` at the same time.

You already have batch A applied. Generate a bumped-revision copy and push it:

```bash
# same names + LocURIs as batch_A.json, only the <Data> bytes change -> pure in-place modify
python3 gen_win_profiles.py --out ./profiles_A_r2 --prefix "LoadTest A" --rev 2 --json ./batch_A_r2.json

TEAM_ID=1 ./batch_profiles.sh update batch_A_r2.json     # HTTP 204 = accepted; watch the drain below
```

To push another round of updates, bump `--rev` again (`--rev 3`, `--rev 4`, …) — each bump changes
the contents so Fleet re-pushes once more. `./generate.sh 3` does the same thing alongside a
fresh A and B. Keep `--prefix` matching whatever is currently applied
(`"LoadTest A"` if batch A is on the team) — using a different prefix changes the names and turns
this back into an add/remove instead of a modify.

## Usage — team transfers (scenario 6)

**Prerequisite:** both teams must already carry the full 100-profile set, so each transfer
forces a per-host remove-source + add-dest churn (the heaviest profile operation). Apply
batch A to both teams first:

```bash
TEAM_ID=1 ./batch_profiles.sh apply batch_A.json
TEAM_ID=2 ./batch_profiles.sh apply batch_A.json
```

Then transfer in interactive batches. **Batch size is hard-capped at 30000** — larger single
transfers are blocked by [#46894](https://github.com/fleetdm/fleet/issues/46894).

```bash
export SRC_TEAM_ID=1      # move hosts out of this team
export DST_TEAM_ID=2      # ...and into this one
export BATCH_SIZE=10000   # optional, default 10000

./transfer_hosts.sh
```

It enumerates the source team's host IDs (cursor pagination, cached to `ids_<SRC>.txt`), then
prompts before each batch: `[y]es` fires one batch, `[a]ll` blasts through the rest, `[q]uit`
stops. Each POST is timed (`HTTP 200 in N.NNs`).

To reverse direction for another sample, swap the team IDs and force a rescan (the cached IDs
are stale once hosts have moved):

```bash
SRC_TEAM_ID=2 DST_TEAM_ID=1 ./transfer_hosts.sh --refresh
```

## What to measure

The POST returning success only means Fleet *accepted* the batch. The real work is the reconcile
cron writing up to ~10M rows. Watch these between operations — the drain **rate** (rows/min) is
usually more interesting than the POST latency:

```sql
SELECT COUNT(*) FROM windows_mdm_command_queue;                          -- pending commands, drains toward 0
SELECT COUNT(*) FROM host_mdm_windows_profiles;                          -- ~100 × host_count at full push
SELECT status, COUNT(*) FROM host_mdm_windows_profiles GROUP BY status;  -- pending → verifying → verified
```

## Gotchas

- **`WindowsEnabledAndConfigured` must be on.** The batch endpoint reads it from app config;
  enable Windows MDM in the UI first. (`batch_profiles.sh` can be extended with
  `--assume_enabled` if needed, but enabling in the UI is cleaner.)
- **`ids_<SRC>.txt` goes stale** after a transfer (those hosts are no longer in the source team).
  Use `--refresh` when reversing or re-running.
- **Batch A and batch B must target DISJOINT LocURIs.** The generator guarantees this: the
  LocURI namespace is derived from `--prefix`, so `"LoadTest A"` emits `_loadtesta_…` and
  `"LoadTest B"` emits `_loadtestb_…` — 227 LocURIs each, zero overlap. Only a hand-edited
  batch, or two batches generated with the same prefix, can break it. If the replacement
  batch does reuse the old batch's LocURIs, Fleet's
  LocURI-protection path suppresses the `<Delete>` for every setting still targeted by a retained
  profile. The deleted profiles' `host_mdm_windows_profiles` rows then never transition to remove,
  so they stay `install/verified` forever and hosts show **200 profiles instead of 100**. The team
  *definitions* still correctly show 100 — the phantom rows are only at the host level. If you hit
  this, the recovery is a `batch_profiles.sh delete` (empty set unprotects all LocURIs so the
  deletes finally fire), confirm the summary drains to 0, then re-apply. This is arguably also a
  product bug (a deleted profile shouldn't remain "verified" on hosts just because another profile
  shares its LocURIs) — worth a minimal repro + issue if it matters for the release.
