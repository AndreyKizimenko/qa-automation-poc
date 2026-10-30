# QA tooling

Operational scripts that support the QA instances and Fleet release testing.
Unlike [`playwright/`](../playwright/) and [`gitops/`](../gitops/), nothing here
runs in CI — these are run by hand, usually against infrastructure that lives
outside this repo.

| Tool | What it does | Runs where |
|---|---|---|
| [`perf-hosts/`](perf-hosts/README.md) | `launchd` daemons running Fleet's osquery-perf simulator, keeping ~300 online hosts on each QA instance | A dedicated macOS QA VM |
| [`windows-mdm-loadtest/`](windows-mdm-loadtest/README.md) | Drivers for the Windows MDM profile fan-out and team-transfer load-test scenarios | Anywhere with API access to the load-test instance |
| [`kubernetes/`](kubernetes/README.md) | Deploys a Fleet release to Docker Desktop Kubernetes to smoke-test the Helm chart | Your machine, with a `fleetdm/fleet` clone |
| [`loadtest-api-audit/`](loadtest-api-audit/README.md) | Checks every request in the Playwright `loadtest-api` matrix against the Fleet source: registered route, decoded parameters | Your machine, with a `fleetdm/fleet` checkout |
| [`vm/`](vm/README.md) | UTM test VMs: start/stop, clone from goldens, enroll fleetd to a Fleet instance, check hosts against Fleet | Your Mac (Apple Silicon, UTM) |
| [`ssolab/`](ssolab/README.md) | Switches a Fleet instance's admin SSO and MDM end-user auth between Okta, Entra, Google, Auth0 and local authentik / SimpleSAMLphp | Your Mac, with Docker for the local IdPs |
| [`loglab/`](loglab/README.md) | Switches a Fleet instance's osquery result/status and audit log destinations (filesystem, webhook, Splunk, Kinesis/Firehose, Pub/Sub, Kafka, NATS — local emulators or real AWS) | Your Mac, with Docker; AWS mode needs a sandbox account |
| [`qalab/`](qalab/README.md) | Menu over `vm`, `ssolab` and `loglab`, plus the shared `lab.env` they all read | Your Mac |

## Before you run anything

**Three of these use another repo.** `kubernetes/` and `loadtest-api-audit/`
read a `fleetdm/fleet` checkout (`kubernetes/` its chart and compose file,
`loadtest-api-audit/` its routes and request structs) — both find one on their
own or take `FLEET_REPO` — and `windows-mdm-loadtest/` implements a runbook that
lives in the fleet repo. Each README says so.

**This repository is public.** Nothing here may contain a real instance URL,
enroll secret, or API token:

- `perf-hosts/` plists are templates with `__PLACEHOLDER__` tokens; `install.sh`
  substitutes real values from a gitignored `perf-hosts.env` at install time.
- The load-test scripts read `FLEET_URL` / `FLEET_TOKEN` from the environment.
- The MySQL credentials in `kubernetes/` are Fleet's own docker-compose dev
  defaults — local-only, not secrets.
- `vm/`, `ssolab/`, `loglab/` and `qalab/` read your instances and paths from a
  gitignored `qalab/lab.env` (copy `lab.env.example`), and keep logins, tokens
  and generated state in per-tool data dirs outside the repo. Each has a
  `doctor` or `status` command that checks the setup.

`.gitignore` covers the generated and secret paths. If you add a tool, keep
credentials in a gitignored file next to it and commit a `.example` alongside.

## Generated artifacts aren't committed

`windows-mdm-loadtest/` ships a deterministic generator rather than its ~600 KB
of output — run `tools/windows-mdm-loadtest/generate.sh` after cloning (it works
from any directory). Same pattern as
[`gitops/loadtest/`](../gitops/loadtest/README.md).
