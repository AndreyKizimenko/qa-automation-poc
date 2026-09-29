# Fleet QA gotchas

Things earlier runs lost time on. Skim before building test data.

## osquery-perf

```bash
cd <fleet checkout> && go run ./cmd/osquery-perf \
  -server_url https://<instance> -enroll_secret <fleet secret> \
  -host_count 2 -os_templates ubuntu_22.04 &      # templates: cmd/osquery-perf/*.tmpl
echo "pid $! # osquery-perf <ctx>" >> <QA workspace>/qa-<N>/created.txt
```

- Record the PID and one `api <ctx> DELETE /api/v1/fleet/hosts/<id>` line per host
  once enrolled. Deleting a fleet **does not** delete its hosts — they move to
  "No fleet" — and a stopped osquery-perf host just goes offline.
- Policy answers are deterministic: `SELECT 1` → pass, `SELECT 0` → fail. Use that
  for known pass/fail states instead of real checks.
- Scripts run by osquery-perf succeed or fail at random — compare run counts
  before/after, don't expect exact outcomes.
- Enroll with a **fleet** secret so hosts are findable; a host enrolled with the
  global secret is indistinguishable from other sessions' hosts in "No fleet".
- `ps`/`pgrep` output shows other sessions' enroll secrets on the command line —
  don't copy those into reports.
- Kill osquery-perf **before** deleting its hosts in cleanup, or they re-enroll as
  new hosts. `cleanup.sh` runs newest-first, so move the `pid` lines to the end of
  the manifest.
- Fleet Desktop (so `fleet_desktop_version` is set and the My device link shows):
  `-orbit_prob 1` on desktop templates.
- iPhone/iPad over MDM: build once (`go build -o qa-<N>/osquery-perf ./cmd/osquery-perf`),
  then `-os_templates iphone_14.6,ipad_13.18 -mdm_scep_challenge "$(tr -d '\n' <
  <fleet checkout>/scep_challenge)" -mdm_apns_url http://127.0.0.1:9` — no
  enroll secret, lands in "No fleet" (transfer it to your `qa-<N>` fleet). The dead
  APNs URL is fine: enrollment, host creation and `mdm_enrolled` happen for real,
  but pushes fail with `BadDeviceToken`, so commands you send (wipe, lock, Recovery
  Lock) stay **pending** forever — a real way to reach a pending state. The API call
  that sends a command can return 502 *after* queuing it; check `pending_action`.

## Counts and crons

- Policy pass/fail counts on the policies page only update when
  `cleanups_then_aggregation` runs: `fleetctl --context <ctx> trigger --name
  cleanups_then_aggregation`, then poll. Software counts read 0 mid-aggregation —
  not a bug.
- Other crons: `fleetctl --context <ctx> trigger --name <name>` (schedule names are in `cmd/fleet/cron.go`).
- To make hosts re-report policies: `POST /api/v1/fleet/hosts/:id/refetch`.

## Shared instances

Other QA sessions may be using the same two instances and the same Mac.
- Global objects (global policies, labels, users with global roles) are visible to
  every session and show up in their screenshots — scope global policies with
  `labels_include_any` to a manual label holding only your hosts.
- Never flip global settings (GitOps mode, agent options, MDM settings,
  `apple_machineinfo_verify`, license) without asking the user; batch it into the
  step-3 ask.
- Only clean up what your manifest recorded.

## Users and auth

- API-only users (`POST /api/v1/fleet/users/api_only`) return a token — good for
  API role matrices. They're redirected to `/apionlyuser` in the UI, so UI-by-role
  needs a real user from the user.
- The UI auth cookie is `__Host-token` over https, `token` over http
  (`frontend/utilities/auth_token.ts`) — `pw.mjs` handles it.

## APIs

- Endpoints live under `/api/v1/fleet`, `/api/latest/fleet` and `/api/2022-04/fleet`;
  a routing fix should be checked on all three.
- Policy deletes are `POST /api/v1/fleet/global/policies/delete` and
  `POST /api/v1/fleet/fleets/{fleet_id}/policies/delete` (fleet_id 0 = No fleet)
  with `{"ids":[...]}`, so their manifest lines carry a body. Deleting a fleet
  removes its own policies.
- Software upload is multipart: `fleetapi.sh <ctx> POST /api/v1/fleet/software/package
  -F team_id=12 -F software=@pkg.sh`.
- Apple enroll endpoints need a deviceinfo blob; `scripts/encode_deviceinfo/` makes
  a self-signed one, which is rejected while `mdm.apple_machineinfo_verify` is on.

## Local baselines

When the shared instances don't bracket the fix, an older image may already be on
the machine: `docker images | grep fleetdm/fleet`. Run it on its own network with
its own MySQL/Redis, and record every container and the network in the manifest
(`docker <name>`). Set up the admin via `POST /api/v1/setup` with a generated
password that is only ever sent through the API.

## Screenshots

- Playwright hides the text caret by default — `screenshot.mjs --caret`.
- `--full` can render washed-out on long pages; `--clip <selector>` is sharper.
- Pages mid-transition get captured faded; `pw.mjs` sets reduced motion, and
  `--wait <selector>` helps.
- Host/enroll pages show enroll secrets in URLs — check before attaching to a
  public ticket.
