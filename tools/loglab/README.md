# loglab

`loglab` switches where each of your Fleet instances sends **osquery result logs**, **osquery status logs** and
**audit logs**. It can also test the destination and stream the logs back from it. Running it with no arguments
opens an arrow-key view.

```
loglab                                   interactive: per-instance destination (green = live, yellow = restart needed) + sinks
loglab status [--json]                   same, as text
loglab switch rc kinesis                 result + status + audit → LocalStack Kinesis (starts LocalStack if needed)
loglab switch prev webhook               result + status → webhook; audit off (Fleet has no audit webhook)
loglab switch rc nats --only audit       advanced: move one log type, leave the others where they are
loglab switch rc default                 no logging keys: Fleet's built-in filesystem in $TMPDIR, audit off
loglab path rc                           the config file to pass to fleet serve --config
loglab test rc [--no-write]              live vs file, wiring, destination reachable + a marked test record, server-log errors
loglab view rc                           stream the logs back from the destination (Ctrl-C to stop)
loglab fire rc [--audit] [--status-from <vm>]   generate logs now (temporary report), watch, clean up
loglab view rc --type status --grep ERROR   / --raw (full JSON) / --from-start / --dest <d>
loglab up|down <receiver|localstack|redpanda|nats|pubsub|splunk|all>
loglab aws guard install|status|run|down cost safeguards in the AWS account (one per account, shared)
loglab aws up [--ttl 4h]|extend|status|down   your real AWS resources for the *-aws destinations, auto-deleted at expiry
loglab show rc | env rc | hangar | dests
```

`rc`/`prev` above are examples: the instance names are whatever you list in `INSTANCES` in `lab.env`.

TUI keys: `↑↓` move · `⏎` on an instance → pick a destination for all three log types (runs `loglab switch`;
per-type choices are under *Advanced*), on a sink → start/stop · `f` fire · `t` test · `v` view (Ctrl-C comes back)
· `s` show YAML · `e` env rows · `h` Hangar wiring · `r` refresh · `q` quit.

## Prerequisites
- macOS with the stock `/usr/bin/python3` (3.9) or newer. No pip packages.
- A `fleetctl` context with an API token per instance (`fleetctl login --context <name>`); loglab reads
  `~/.fleet/config` and only calls `GET /config` and `GET /version` (plus `fire`, which creates and deletes a report).
- Docker Desktop for the local sinks (LocalStack, Redpanda, NATS, Pub/Sub emulator, Splunk). Each container is
  memory-capped: LocalStack 900 MB, Redpanda 700 MB, Pub/Sub 512 MB, NATS 96 MB. **Splunk needs a 3 GB cap and is an
  amd64-only image**: on Apple Silicon it runs under Docker Desktop's x86 emulation (enable Rosetta in Docker Desktop),
  first start takes 3–5 min and it idles around 1 GB. Give Docker Desktop at least 6 GB if you plan to run Splunk
  next to other sinks. `loglab up` checks free Docker memory first.
- For the real-AWS destinations: the AWS CLI (`brew install awscli`) and an SSO profile or access keys.
- Optional: `vm` (the UTM test-VM tool next to this one) for `fire --status-from <vm>`. Without it that option is off.

## Setup
1. Fill in the shared lab config: copy `tools/qalab/lab.env.example` to `tools/qalab/lab.env` and set
   `INSTANCES`, `INSTANCE_<name>_CONTEXT` and `LOGLAB_DATA` (see `tools/qalab/README.md` for every key). Optional per
   instance: `_SRC` (Fleet checkout, to know which log plugins that build has), `_FLEET_BIN` (built `fleet`, to
   validate each config with `fleet config_dump`; without it validation is skipped with a warning), `_SERVER_LOG`
   (file that fleet serve's output goes to; needed for the `stdout` destination's test/view and for log-writer
   errors).
2. Put `bin/loglab` on PATH: `ln -s "$PWD/bin/loglab" /usr/local/bin/loglab` (or any PATH dir).
3. `loglab status`. It creates `$LOGLAB_DATA` with `config/<inst>.yml` (no logging keys yet) and `SECRETS.env`
   (from `SECRETS.env.example`, chmod 600; fill it only for the cloud destinations).
4. Wire each server to its file once (Hangar below, or `fleet serve --config $(loglab path <inst>)`), restart it.
   Until you switch, the files hold no logging keys, so wiring them changes nothing.

The code folder holds nothing personal; everything loglab writes goes to `$LOGLAB_DATA`: `config/` (the Fleet config
files), `sinks/` (what local sinks received), `state/` (selection per instance, `history.log`, `hec.token`,
`splunk.env`, receiver pid/log, `aws.json`), `SECRETS.env`, `created.txt` (everything loglab made, for cleanup).

## How it applies: config file + your restart
Log destinations are **server** settings (`fleet serve` flags/env/config file), not app config: there's no API to change
them, and Fleet only reads them at startup. So loglab owns one Fleet config file per instance, `config/<inst>.yml`,
holding only logging keys (`osquery.*_log_plugin`, `activity.*`, plus the plugin block). chmod 600, because the
`*-aws` and `splunk-cloud` destinations put credentials in it.

Every switch validates the new file with that instance's own `fleet config_dump` (when `_FLEET_BIN` is set, so a key
the build doesn't know fails here, not at startup), shows *was → new*, writes it, then prints the manual steps.
**You restart the server.** `status`/`test` compare the file with `GET /config`'s `logging` section and show
"restart needed" until they match. Env vars beat the config file: `FLEET_*` logging env on the server overrides it.

### With Fleet Hangar
If Fleet Hangar is installed (`HANGAR=auto`, the default) and an instance has `INSTANCE_<name>_HANGAR_ID` (s1, s2…),
loglab reads Hangar's `settings.json` (Config file wiring, env rows) and `running.json` (pid, args, start time)
read-only, and uses Hangar's `fleet-serve-<id>.log` as the server log unless `_SERVER_LOG` is set.
- One-time wiring: Hangar → Settings → Fleet serve → *Config file (--config)* → pick the file from `loglab hangar`.
- `status` also flags enabled `FLEET_*` log env rows that override the file and env rows a destination needs.
- loglab never edits Hangar's settings and never restarts a server. `HANGAR=0` ignores Hangar entirely.

### Without Fleet Hangar
- `loglab path <inst>` prints the file (creating it if needed); start the server with
  `fleet serve --config "$(loglab path rc)"` (alongside your other flags). If you already use a config file, Fleet
  takes one `--config`: use the env-var alternative instead.
- Env-var alternative: `loglab env <inst>` prints the same settings as `FLEET_*=…` lines (secrets masked in the
  output; the real values are in the config file) for your launcher/compose file.
- Destinations that need process env (`pubsub`: `PUBSUB_EMULATOR_HOST=127.0.0.1:18085`; `*-aws` with SSO:
  `AWS_PROFILE`) are printed by `switch` and `env`; loglab can't check them without Hangar.
- Restart detection uses the API only: `status` is green once `GET /config` reports the new logging settings.
  `loglab hangar` says n/a.
- `stdout` needs `INSTANCE_<name>_SERVER_LOG` (e.g. `fleet serve … > ~/fleet-rc.log 2>&1`) for `test`/`view`;
  without it those say unsupported and why.
- The `filesystem` destination writes host paths under `$LOGLAB_DATA/sinks/`. They only work when fleet serve runs
  on this Mac; if Fleet runs in Docker, mount that folder at the same path or use another destination. Likewise the
  local sinks listen on `127.0.0.1`, which a containerized Fleet reaches as `host.docker.internal`, not 127.0.0.1.

## Generating logs on demand: `loglab fire` (TUI: `f`)
- **Result logs:** creates a temporary **global** report `loglab fire <inst> <time>` (`interval: 60`, snapshot,
  `automations_enabled: true`). Every host runs it, so results arrive ~1–2 min later.
- **Audit logs:** creating and deleting that report are `created_saved_query` / `deleted_saved_query` activities;
  Fleet ships audit logs up to ~5 min later. Audit logs need Premium.
- **Audit only (`--audit`):** a report with `interval: 0` (never runs, no hosts touched), deleted straight away; waits
  for both activities at the audit destination (default 8 min), printing log-writer errors on timeout.
- **Status logs:** only real osquery sends them. `--status-from <vm>` restarts orbit on a test VM enrolled to that
  instance (`vm exec`; needs the `vm` tool).
- Watches 4 min (`--minutes N`), then deletes the report (`--keep` leaves it; `--cleanup` removes leftovers).

## Destinations
| key | plugin | types | where it goes | view |
|---|---|---|---|---|
| `filesystem` | filesystem | all | `$LOGLAB_DATA/sinks/<inst>/filesystem/{result,status,audit}.log` (Fleet's default `$TMPDIR/osquery_*` is shared by every local server) | tail |
| `stdout` | stdout | all | fleet serve's stdout (JSON lines) | tail of `_SERVER_LOG` |
| `webhook` | webhook | result, status | receiver `http://127.0.0.1:18200/webhook/<inst>/<type>` → `sinks/<inst>/webhook-<type>.jsonl` | tail |
| `splunk` | splunk | all | HEC mock in the receiver, `/splunk/<inst>`, token in `state/hec.token` | tail |
| `splunk-local` | splunk | all | real Splunk Enterprise in Docker (license opt-in, below) | REST search inside the container |
| `splunk-cloud` | splunk | all | your real HEC (`SPLUNK_*` in SECRETS.env) | search in Splunk (HEC is write-only) |
| `kinesis` | kinesis | all | LocalStack streams `fleet-<inst>-<type>` | GetRecords |
| `kinesis-aws` | kinesis | all | real AWS streams `fleetqa-<owner>-<inst>-<type>` | GetRecords |
| `firehose` | firehose | all | LocalStack delivery streams → `s3://loglab-firehose/<inst>/<type>/` (60 s buffer) | S3 objects |
| `firehose-aws` | firehose | all | real AWS (also the Snowflake / Splunk-via-Firehose path) | S3 |
| `lambda-aws` | lambda | all | real AWS functions `fleetqa-<owner>-<inst>-<type>`, one invocation per log line | CloudWatch |
| `pubsub` | pubsub | all | Pub/Sub emulator, project `loglab`, topics `fleet-<inst>-<type>` | pull |
| `kafkarest` | kafkarest | all | Redpanda's REST proxy, topics `fleet-<inst>-<type>`, content type v2 | `rpk topic consume` |
| `nats` | nats | all | `nats://127.0.0.1:18422`, subjects `fleet.<inst>.<type>` | subscribe |

Notes found in Fleet's source:
- `webhook.status_url` exists; there's no audit webhook URL.
- `kinesis.endpoint_url` and `firehose.endpoint_url` exist (that's how LocalStack works). Lambda has none: real AWS only.
- Pub/Sub only reaches the emulator when `PUBSUB_EMULATOR_HOST` is in fleet serve's **environment**; set it once and
  leave it on (it only redirects Fleet's Pub/Sub log client).
- Fleet's Kafka REST default content type is v1; Redpanda speaks v2, so loglab sets `kafkarest.content_type_value`.
- **Startup checks:** kinesis, firehose, kafkarest and nats contact the destination while fleet serve starts; if
  that sink is down **the server exits**. `switch` won't write such a config until the sink is up, `down` warns,
  `status` flags it. Emulators keep nothing across restarts; `loglab up <sink>` recreates every stream/topic.

`loglab test` writes one record per log type marked `{"loglab_test": true}` unless `--no-write`. It never invokes a Lambda.

## Sinks (local)
| sink | port | memory cap | backs |
|---|---|---|---|
| receiver | 18200 | – (python process) | webhook, splunk |
| localstack | 18566 | 900 MB | kinesis, firehose |
| redpanda | 18082 | 700 MB | kafkarest |
| nats | 18422 | 96 MB | nats |
| pubsub | 18085 | 512 MB | pubsub |
| splunk | 18088 (HEC), 18000 (web) | 3 GB | splunk-local |

All docker sinks are compose project `loglab` (`docker/docker-compose.yml`, one profile per sink, ports on
127.0.0.1 only, chosen to stay clear of Fleet Hangar's and ssolab's). The code refuses any other project name.

## Real Splunk, locally: `splunk-local`
Splunk Enterprise 9.4 on the Free license. Its container only starts after you accept Splunk's license and General
Terms (https://www.splunk.com/en_us/legal/splunk-general-terms.html): set `LOGLAB_ACCEPT_SPLUNK_LICENSE=1` in
`lab.env`. Without it `loglab up splunk` and `switch … splunk-local` refuse; the compose file accepts nothing on its
own. HEC is `https://127.0.0.1:18088` (self-signed → `insecure_skip_verify: true`), index `main`, source
`fleet-<inst>`; web UI http://127.0.0.1:18000. Admin password + HEC token are generated into `state/splunk.env`.
`loglab down splunk` deletes its data.

## Real AWS: `loglab aws` (cost-guarded, multi-user)
Credentials: `AWS_PROFILE` (SSO; `aws sso login --profile <p>` or `loglab aws login`) or keys in SECRETS.env, and
`AWS_REGION`. For Fleet itself to use an SSO profile, fleet serve needs env `AWS_PROFILE=<profile>` (with no such
profile in `~/.aws/config`, every Fleet AWS client fails to load).

**Several engineers can share one account.** Everything you create is tagged `created-by=loglab`,
`owner=<LOGLAB_OWNER>` (lab.env; default `$USER`) and `expires-at`, and default names carry your owner:
streams/functions `fleetqa-<owner>-<inst>-<type>`, bucket `fleetqa-loglab-<owner>-<account>-<region>`, roles
`/loglab/loglab-<owner>-firehose|lambda`. `aws status` lists yours with time left, counts other owners', and lists
**unowned** resources (no owner tag, made by older loglab versions) with a warning. `aws down` deletes only yours
(streams, functions, log groups); `--all` also your bucket and roles; `--all --include-unowned` also the unowned ones.
Custom prefixes in SECRETS.env must still start with `fleetqa-` (bucket `fleetqa-loglab-`) or `aws up` refuses,
since the guard couldn't delete them.

**Safeguards, one per account: `loglab aws guard install`** (`--dry-run` prints everything it would create). If a
guard already exists (anyone's), install leaves it alone and only adds missing pieces; `--update` rolls out this
checkout's reaper code and policy.
- **Reaper**: Lambda `loglab-guard-reaper` (`aws/reaper.py`), every 15 min via EventBridge Scheduler. Deletes any
  `created-by=loglab` resource whose `expires-at` has passed (or that has none), **whoever owns it**: the TTL is per
  resource. Its IAM role can only delete names under `fleetqa-`, buckets `fleetqa-loglab-` and roles under `/loglab/`.
- **Budget** `loglab-guard`: monthly, on Kinesis, Firehose, Lambda, CloudWatch and S3 across the account. Emails
  `AWS_ALERT_EMAIL` (from the installer's SECRETS.env) above $5; above $20 it also triggers the reaper in
  delete-all mode. AWS evaluates budgets a few times a day: the expiry is the real limit.
- **Cost anomaly monitor**: daily email for anomalies ≥ $5 (free).
- `guard status` shows each piece, who installed it, this month's spend and the last reaper run. `guard run [--all]
  [--dry-run]` invokes the reaper now. `guard down` removes it for everyone and refuses while any loglab resources exist.

**Test resources: `loglab aws up [kinesis|firehose|lambda] [--ttl 4h]`** refuses without the guard. Kinesis (1 shard
each, ~$0.015/shard-hour), Firehose → S3 (objects expire after 1 day), Lambda with 1-day log retention. Default TTL
4h, max 24h; `aws extend 2h` pushes your expiry. `aws down` refuses while an instance logs to AWS (`--force`
overrides). `loglab status` and `qalab` warn while you have resources in AWS, from `state/aws.json` (no AWS call).
`--localstack` runs any `aws` command against LocalStack as a self-test.
