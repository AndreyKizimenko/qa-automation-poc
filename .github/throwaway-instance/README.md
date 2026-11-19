# The throwaway instance

A free Fleet that `QA — Throwaway instance` (`.github/workflows/throwaway-instance.yml`) brings up on its own
GitHub runner, works, and drops with the runner. It takes over the rows of Fleet's release checklist
(`fleetdm/fleet` `.github/ISSUE_TEMPLATE/release-qa.md`; the 4.95.0 one is fleetdm/fleet#57311) that need a
server nobody else uses, which the two standing QA instances can't be: phase 3 of the release-smokes plan
(`playwright/docs/release-smokes-plan.md`). Nothing here touches the standing instances or the device lab, and
nothing needs a secret.

Dispatch it by hand, with the image under test: `gh workflow run "QA — Throwaway instance" -f image=<tag>`
(`main` by default; an RC is `rc-minor-fleet-v4.96.0`). `-f from=<tag>` picks the release the Update flow
starts from (Fleet's latest by default), `-f hosts=<n>` the number of simulated hosts (30). On a branch, add
`--ref <branch>`.

## What it runs

Two jobs, side by side on two runners (4 vCPU, 16 GB; the whole of either uses about 3 GB):

| Job | What | Checklist row |
|---|---|---|
| **Helm chart (kind)** | A kind cluster; Fleet's chart from the image's own revision, with the chart's MySQL and Valkey subcharts and two Fleet pods, installed brand-new on the image under test; pods Ready and no error in Fleet's log; first-run setup through the browser (`throwaway-first-run`); `generate-gitops` → `fleetctl gitops` → `generate-gitops` on the brand-new server, which must agree (`gitops-round-trip.sh`); the seed, the simulated hosts and the basic checks (`throwaway`); `helm uninstall` and the namespace deleted | *All product groups › Helm chart*; *Orchestration › GitOps and generate-gitops*, step 1's "brand new Fleet server" |
| **Update flow (Docker Compose)** | The last release on Compose (MySQL, Valkey, one Fleet); setup, the seed and, on Fleet 4, a 2017 pack; the simulated hosts; on an upgrade to Fleet 5, `fleetctl upgrade-packs` with the release's own fleetctl and its reports applied; a snapshot; the upgrade as Fleet's guide says (stop Fleet, `fleet prepare db` on the new image, start it); every host checking in again; the snapshot compared (`fleet-data.mjs compare`); the basic checks (`throwaway`); report results reaching the filesystem log, then a webhook | *Orchestration › Update flow*; *Orchestration › Log destination flow*, but for Splunk and status logs |

**Left to a person, and why.** *Log destination*'s Splunk step, and **status logs** to any destination:
osquery-perf sends result logs only, never status logs, and Fleet's audit logs are Premium-only. The run
proves report results reach the filesystem and an external (webhook) destination, nothing more.

The basic checks are the `throwaway` Playwright project (`playwright/tests/e2e/throwaway/`): every host listed
and online; each platform's Host details with its policy answers; a live report reaching every host (across
two pods on the Helm job); the seeded report's stored results, each policy's hosts, the label's members and the
organization name; and every main page opening without a page error, console error or 5xx.

## The files

| File | What |
|---|---|
| `action.yml` | The first step of both jobs: the image's revision (`fleet version --full`), Fleet checked out there (`.fleet-src`), osquery-perf and fleetctl built from it, Node, and the suite's packages |
| `kind.yaml` | One node; its port 30080 published as the runner's `localhost:8080` |
| `helm-values.yaml` | The chart's values: subcharts on, TLS off, two replicas, 1-minute label, detail and policy intervals |
| `nodeport.yaml` | A NodePort Service on the chart's Fleet pods (the chart's own is a NodePort only with its GKE values) |
| `compose.yaml` | The Update flow's MySQL, Valkey, `migrate` (`fleet prepare db`), `fleet` and `log-receiver` |
| `log-receiver.py` | The webhook destination: prints each POST on one line |
| `fleet-data.mjs` | Fleet's REST API for the run: `setup`, `login`, `prepare` (usage statistics off, the enroll secret), `seed`, `seed-pack`, `wait`, `snapshot`, `compare`, `os-templates`. Its header has each |
| `start-osquery-perf.sh` | The simulated hosts, in the background, over the seed's OS templates |
| `gitops-round-trip.sh` | `generate-gitops` → `gitops` → `generate-gitops` |
| `install-k8s-tools.sh` | kind, Helm and kubectl at pinned versions and checksums |
| `playwright.sh` | A command in the suite's Playwright image, on the runner's network |

The seed itself, which the specs read too, is `playwright/test-data/shared/throwaway/seed.json`.

## What it had to work around

Each of these cost a try while the workflow was built (2026-11-19, Fleet 4.95.0 and `main` at `cb3d6773bf`):

- **The chart's migration Job, with its own MySQL.** With `mysql.enabled` the Job is no Helm hook (a pre-install
  hook would run before the MySQL it needs exists), so it runs beside the Fleet pods, which exit on "missing
  migrations" and restart until it is done: a few restarts on install are expected, and "no errors in the logs"
  reads the containers that came up after it. The Job keeps a fixed name and deletes itself 100 s after it
  finishes, so a `helm upgrade` inside those 100 s that changes its template fails with `field is immutable`.
  Only the dev/test subchart is affected (Andrey: not filed). The workflow never upgrades the chart.
- **Webhooks to a private address.** Fleet 5 refuses an integration request to a private address unless
  `server.allow_private_network_integrations` is on, and the webhook logger then logs the error and drops the
  batch. The Compose receiver is on a private address, so the setting is on there.
- **osquery-perf's defaults.** 1 in 10 simulated hosts signs its requests with a host identity certificate
  from Fleet's SCEP endpoint, which a free Fleet without a server private key doesn't serve: such a host
  never enrolls. 1 in 5 live-query answers carries no rows. `start-osquery-perf.sh` turns both off.
- **`generate-gitops` on a brand-new server** writes `integrations.conditional_access_enabled` and
  `integrations.certificates_disable_host_end_user_binding` with no value, and applying its own output saves
  them as `false`, so the round trip compares "no value" and `false` as equal.
- **`kubectl port-forward`** sends every connection to one pod and dies on every rollout: the NodePort spreads
  the browser's and the hosts' connections over both pods.
- **`fleetctl setup` and the setup page leave usage statistics on**: `fleet-data.mjs prepare` turns them off
  before any host enrolls, so a run never reports a new instance to Fleet.
- **The runner's AppArmor profile for `mysqld`** (found on the first CI run, 2026-11-19). GitHub's Ubuntu images
  ship a MySQL server, and its `usr.sbin.mysqld` profile attaches to any `/usr/sbin/mysqld` the host kernel
  runs unconfined, kind's pods included. It denies the chart's MySQL (Oracle Linux paths) its `/etc/my.cnf`
  and message files: the kernel logs `apparmor="DENIED" operation="open" profile="/usr/sbin/mysqld"`, mysqld
  falls back to `/var/lib/mysql/mysql.sock`, and the chart's `mysqladmin ping` probes, which use
  `/var/run/mysqld/mysqld.sock`, fail until Kubernetes restarts it, so `helm install --wait` times out with
  `fleet-mysql` at `0/1`. The Helm job unloads the profile before the install. Docker containers run under
  `docker-default` and never attach it, which is why the Update flow's MySQL was never affected, and a Mac
  has no such profile.
- **Fleet's images are amd64 only**: native on the runner; on an Apple-silicon Mac, kind and Compose run them
  emulated (the chart's install took about 100 s there).

## Running it on your machine

Everything but the workflow's glue runs locally, with Docker, kind, Helm, Node and Go. Pick a port other than
8080 if a dev Fleet holds it (Fleet Hangar's does), and keep the run's files outside the checkout:

```bash
# Compose (the Update flow), from this folder
export LOGS_DIR=$(mktemp -d) FLEET_PORT=18080 FLEET_TAG=v4.95.0
chmod 777 "$LOGS_DIR" && docker compose up --detach --wait
export FLEET_URL=http://localhost:18080 FLEET_ADMIN_EMAIL=admin@example.com FLEET_ADMIN_PASSWORD='Pw-<random>-1!'
export FLEET_API_TOKEN=$(node fleet-data.mjs setup) ENROLL_SECRET=$(node fleet-data.mjs prepare)
node fleet-data.mjs seed && node fleet-data.mjs seed-pack
# osquery-perf from a Fleet checkout's cmd/osquery-perf, with the flags start-osquery-perf.sh passes
node fleet-data.mjs wait 8 300
docker compose down -v        # when done

# kind (the Helm chart): kind.yaml with hostPort 18080, then the workflow's install step
sed 's/hostPort: 8080/hostPort: 18080/' kind.yaml > /tmp/kind-local.yaml
kind create cluster --name throwaway --config /tmp/kind-local.yaml --kubeconfig /tmp/throwaway-kubeconfig
```

The Playwright projects read `playwright/.env.throwaway` (`.env.throwaway.example`) and run as any other:
`npx playwright test --project=throwaway-first-run` on a brand-new server, then `--project=throwaway`.
