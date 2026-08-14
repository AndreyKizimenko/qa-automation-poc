# Local Helm-chart testing on Docker Desktop

Deploy a given Fleet release to Docker Desktop's built-in Kubernetes, so a
release candidate's Helm chart can be smoke-tested before it ships.

> **These scripts need a `fleetdm/fleet` clone** — the Helm chart
> (`charts/fleet`) and the MySQL/Redis compose file come from it. They find it
> automatically: the current git toplevel if that happens to be a Fleet
> checkout, otherwise `~/repositories/fleet` or `~/fleet`. Set `FLEET_REPO` to
> override. So both of these work:
>
> ```bash
> ./fleet-helm-test.sh v4.90.0                        # from anywhere
> FLEET_REPO=~/work/fleet ./fleet-helm-test.sh v4.90.0 # explicit checkout
> ```
>
> Each run prints which checkout it picked. If none is found the script exits
> before touching the cluster.

They automate parts 2 and 4–10 of the "Test Fleet Helm Chart With Docker
Desktop" runbook: switch kube-context, bring up MySQL + Redis via Compose, prep
the namespace and secret, resolve chart deps, install, wait for readiness, then
port-forward. Confirming the UI loads is the one manual step left.

## Prerequisites

- Docker Desktop with **Kubernetes enabled** (Settings → Kubernetes).
- `kubectl`, `helm`, `docker` on `PATH`.
- A clone of `fleetdm/fleet` (the chart and compose file come from it).

## Deploy

```bash
./fleet-helm-test.sh <image-tag>
```

The tag is passed verbatim to `fleetdm/fleet`, so use exactly what exists on
Docker Hub — `v4.90.0`, `rc-patch-fleet-v4.88.1`, `main`. The script checks the
tag via `docker manifest inspect` and fails fast if it isn't there, rather than
leaving you with a pod stuck in `ImagePullBackOff`.

It ends by holding a port-forward on <http://localhost:8081>. Ctrl-C stops it;
the deployment stays up.

## Tear down

```bash
./fleet-helm-reset.sh              # uninstall + drop the fleet_helm DB (fresh next run)
./fleet-helm-reset.sh --keep-db    # uninstall but keep the data
./fleet-helm-reset.sh --nuke       # DESTRUCTIVE — see below
```

`--nuke` runs `docker compose down -v`, which wipes **all** compose volumes,
including the `fleet` database your local `make serve` dev server uses. The
default mode never touches it.

## Isolation from `make serve`

Both scripts are built so a Helm deployment and a local dev server can run at
the same time:

| | `make serve` (dev) | this deployment |
|---|---|---|
| MySQL database | `fleet` | `fleet_helm` |
| Redis logical DB | `0` | `1` |
| Port | 8080 | 8081 |

So a reset that drops `fleet_helm` leaves your dev database untouched — that
separation is the reason for the extra `DB_NAME` / `REDIS_DB` plumbing.

## Environment overrides

Rarely needed; all have working defaults.

| Var | Default | What it does |
|---|---|---|
| `FLEET_REPO` | git toplevel if it's a Fleet clone, else `~/repositories/fleet`, `~/fleet` | The Fleet checkout supplying `charts/fleet` and `docker-compose.yml` |
| `KUBE_CONTEXT` | `docker-desktop` | Context to deploy into |
| `NAMESPACE` | `fleet` | Kubernetes namespace |
| `LOCAL_PORT` | `8081` | Port-forward port (dev uses 8080) |
| `KEY_FILE` | `~/.fleet-local-key` | Fleet server private key; generated on first run and reused |
| `DB_NAME` | `fleet_helm` | MySQL database, kept separate from dev's |
| `REDIS_DB` | `1` | Redis logical DB index |

## Notes

- The MySQL credentials in these scripts (`-uroot -ptoor`, and the
  `mysql-password=insecure` secret) are Fleet's own docker-compose dev defaults.
  They're local-only and not secrets.
- `~/.fleet-local-key` is generated once with `openssl rand -base64 32` and
  deliberately preserved across resets, so re-runs skip first-time setup.
