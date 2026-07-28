# QA tooling

Operational scripts that support the QA instances and Fleet release testing.
Unlike [`playwright/`](../playwright/) and [`gitops/`](../gitops/), nothing here
runs in CI — these are run by hand, usually against infrastructure that lives
outside this repo.

| Tool | What it does | Runs where |
|---|---|---|
| [`perf-hosts/`](perf-hosts/README.md) | `launchd` daemons running Fleet's osquery-perf simulator, keeping ~300 online hosts on each QA instance | A dedicated macOS QA VM |
| [`windows-mdm-loadtest/`](windows-mdm-loadtest/README.md) | Drivers for the Windows MDM profile fan-out and team-transfer load-test scenarios | Anywhere with API access to the load-test instance |
| [`kubernetes/`](kubernetes/README.md) | Deploys a Fleet release to Docker Desktop Kubernetes to smoke-test the Helm chart | Your machine, from a `fleetdm/fleet` clone |

## Before you run anything

**Two of these operate on other repos or hosts.** `kubernetes/` must be invoked
from inside a `fleetdm/fleet` checkout (it reads that repo's chart and compose
file), and `windows-mdm-loadtest/` implements a runbook that lives in the fleet
repo. Each README says so up front.

**This repository is public.** Nothing here may contain a real instance URL,
enroll secret, or API token:

- `perf-hosts/` plists are templates with `__PLACEHOLDER__` tokens; `install.sh`
  substitutes real values from a gitignored `perf-hosts.env` at install time.
- The load-test scripts read `FLEET_URL` / `FLEET_TOKEN` from the environment.
- The MySQL credentials in `kubernetes/` are Fleet's own docker-compose dev
  defaults — local-only, not secrets.

`.gitignore` covers the generated and secret paths. If you add a tool, keep
credentials in a gitignored file next to it and commit a `.example` alongside.

## Generated artifacts aren't committed

`windows-mdm-loadtest/` ships a deterministic generator rather than its ~300 KB
of output — run `./generate.sh` after cloning. Same pattern as
[`gitops/loadtest/`](../gitops/loadtest/README.md).
