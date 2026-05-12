# loadtest

Generator for a bulk gitops bundle that provisions a fleet (team) shaped
for the Playwright `loadtest` project: hundreds of policies, reports,
labels, scripts, profiles, software packages, FMAs, and app-store apps.

Only [`generate.sh`](./generate.sh) is checked in. Everything it writes
lands under `generated/` and is gitignored — each run produces fresh
content tied to a specific instance's enroll secret.

```
gitops/loadtest/
├── generate.sh         # the generator (this dir is otherwise empty)
└── generated/          # gitignored output (created by generate.sh)
    ├── team-load-test.yml
    ├── policies/       # 500 .yml
    ├── reports/        # 500 .yml
    ├── labels/         # 500 .yml (dynamic / host_vitals / manual)
    ├── scripts/        # 100 each of macOS, Windows, Linux, Python
    ├── profiles/       # 100 macOS + 100 Windows + 5 Android
    └── software/       # 80 script-only packages per platform
```

## End-to-end flow

The Playwright `loadtest` project measures real page-load times against
a high-scale instance. The dataset has to be in place before tests run.

1. **Spin up the loadtest Fleet instance.** Credentials are per-run; put
   them in `playwright/.env.loadtest` (URL, API token, admin email +
   password — see `playwright/.env.loadtest.example`).

2. **Generate the bundle:**
   ```bash
   ./gitops/loadtest/generate.sh
   ```
   Writes everything to `gitops/loadtest/generated/`. Re-run to start
   over; `--clean` removes the directory.

3. **Fill in the placeholders in `generated/team-load-test.yml`:**
   - `name:` — the team you want created (e.g. `loadtest-2026-05`).
   - `secrets[0].secret:` — the enroll secret you'll use for the new
     hosts. Anything unique; the generator doesn't pick one for you.

4. **Apply via fleetctl gitops** (use your local Fleet repo's build, not
   a globally installed `fleetctl` — gitops shape changes per Fleet
   release and the bundle assumes the same version):
   ```bash
   set -a; source playwright/.env.loadtest; set +a
   /path/to/fleet/build/fleetctl gitops -f gitops/loadtest/generated/team-load-test.yml
   ```
   Apply takes several minutes — the bundle uploads ~1.5k entities.

5. **Move hosts into the new team.** The Playwright loadtest specs read
   the first host (sorted by display name) in this fleet — make sure the
   team has at least one enrolled host. Use the Fleet UI's "Transfer"
   action or `fleetctl hosts transfer`.

6. **Wait for crons.** Software inventory, vulnerabilities, and label
   membership refresh on background schedules — populated rows + vuln
   data + label counts won't appear immediately after host enrollment.

7. **Wire up `FLEET_LOADTEST_FLEET_ID`.** The fleet id of the team you
   just created — grab it from the Fleet UI URL after navigating to the
   team (`/dashboard?fleet_id=<id>`) or via the API. Set it in
   `playwright/.env.loadtest`:
   ```bash
   FLEET_LOADTEST_FLEET_ID=102
   ```
   Required — the Playwright loadtest fixtures throw at setup if it's
   missing or non-numeric.

8. **Run the suite:**
   ```bash
   cd playwright
   npm run test:loadtest
   ```

## What the script generates

| Bucket | Count | Notes |
|---|---:|---|
| macOS configuration profiles | 100 | `.mobileconfig`, distinct UUIDs |
| Windows configuration profiles | 100 | `.xml` SyncML |
| Android profiles | 5 | One per safe key |
| macOS / Windows / Linux scripts | 100 each | Marker-file probes — safe to run on real hosts |
| Python scripts | 100 | `.py` — listed individually in the team yml (glob skips `.py`) |
| Script-only software packages | 80 / 80 / 80 | macOS `.sh`, Windows `.ps1`, Linux `.sh` |
| Policies | 500 | Rotates across 10 archetypes; every 3rd is `critical: true` |
| Reports | 500 | Rotates across 10 archetypes; intervals 1–5h |
| Labels | 500 | Mixed dynamic / host_vitals / manual membership |
| Android certificates | 100 | Inlined in the team yml |
| Fleet Maintained Apps | 276 | Full macOS + Windows catalog |
| Android app-store apps | 28 | A common shortlist |

VPP apps are intentionally omitted to avoid name conflicts with the FMAs
above; add them manually if your VPP token has non-overlapping titles.

## Safety

The generator is deterministic and read-only against your environment —
nothing it does touches Fleet directly. Apply is gated on you running
`fleetctl gitops` yourself with explicit credentials.

The scripts and software packages it writes only create marker files
under `/tmp/fleet-qa/` (or `%TEMP%\fleet-qa\` on Windows) — there's no
network traffic, no privileged actions, no persistence outside that
directory. They're meant to exercise script/install plumbing at scale.
