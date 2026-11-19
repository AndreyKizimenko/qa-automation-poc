# Release smokes: what the suite takes over

The plan of record for shrinking Fleet's manual release checklist (the `Release QA: <version>` issue, built
from `fleetdm/fleet`'s `.github/ISSUE_TEMPLATE/release-qa.md`) to what only a person or a device can check.
Agreed with Andrey on 2026-11-18, from a row-by-row read of the 4.95.0 checklist
([fleetdm/fleet#57311](https://github.com/fleetdm/fleet/issues/57311), 51 rows) against the suite's test
catalogue (`npm run catalogue`: 1109 tests in 203 specs that day).

## How it ends

The checklist PR against `fleetdm/fleet` opens only once phases 1–3 have landed, and it is the success
criterion: every row the suite runs is gone or cut to its device steps, the product groups whose share of
the smokes is light get new manual checks where a person still adds something, and *All product groups*
gains one row:

- **Full suite on the RC** — a screenshot of the green `QA — Nightly` (or `QA — Branch run`) run against the
  RC build, both tiers, with the build's revision (the run's build notice). The instances run the RC as soon
  as one is cut, and the full suite runs against it before the release (Andrey, 2026-11-18): that run is what
  every cut row below rests on.

## The 4.95 checklist, row by row

**Gone, covered every night today** (phase 4 deletes them):

| Row | What covers it |
|---|---|
| Orchestration › Login flow | `shared/auth/` (both tiers): empty and malformed fields, wrong password, forgot-password link, valid login, Okta SSO |
| Orchestration › Packs flow | Nothing to test: Fleet 5 removed 2017 packs (`ca4d8a214f`, fleetdm/fleet#53470). `/packs` answers 410 and `fleetctl apply` refuses `kind: pack`. Packs also leave the Log destination and Orchestration Free rows |
| Orchestration › GitOps and generate-gitops | the nightly gitops chains (full and min apply, the `gitops-verify` drift checks, `generate-gitops` reproducing the applied config, idempotence) and the `generate-gitops` CLI specs on both tiers. "From a brand-new server" is phase 3's |
| Orchestration › Fleet Free | the `free` project, its paywall specs and free's gitops chain |
| Auto Patching › Report flow | reports CRUD on both tiers and every scope, the syntax-error check, live runs, every role's access |
| Auto Patching › Host flow | delete from Host details and in bulk, the Add hosts modal's downloads, every OS's vitals in the per-OS smokes |
| Auto Patching › My device page | `shared/hosts/my-device.spec.ts` and the per-OS smokes, which open My device on every OS of both tiers. Styling and padding are not asserted |
| Auto Patching › Software | the library lifecycle (custom package, FMA, VPP, Android), installs from Host details and self-service from My device on all three platforms, statuses, the activity feed |
| Auto Patching › Fleet Free | free's per-OS smokes and its reports, scripts, software and vulnerability specs |
| Supply Chain › Disk encryption (Linux) | the `premium-encryption` project: LUKS key escrow on Ubuntu (TPM and passphrase) and Omarchy, Create key on five desktops |
| Supply Chain › Fleet Free | free's vulnerability specs, its paywall specs, Lock and Wipe refused on free (UI and `fleetctl`) |
| Apple at Work › OS settings, Power to PC › OS settings | profile upload, download and delete in both scopes; delivery, resend and removal on the macOS and Windows VMs; label targeting; declarations |

**Gone once phase 1 lands:**

| Row | What phase 1 adds |
|---|---|
| Auto Patching › Scripts | `fleetctl run-script` on each platform (P1.1). Its "disable scripts globally" step goes with the row: Fleet 5 no longer has the setting |
| Auto Patching › Fleet-maintained apps | an FMA updated by its patch policy (P1.4), an FMA installed and updated from My device (P1.5) |
| Supply Chain › Vulnerabilities | vulnerable software on My device, on every OS (P1.3) |
| Power to PC › OS updates | the Windows deadline and grace period, set, kept and cleared (P1.6) |

**Cut to the steps a device needs:**

| Row | What stays manual |
|---|---|
| Apple at Work › MDM enrollment flow | the ADE erase and enroll (the CLI MDM command on macOS runs nightly) |
| Apple at Work › OS updates | minimum OS enforced during ADE enrollment |
| Apple at Work › Setup experience | steps 5–8, on an ADE Mac (steps 1–4, the settings, run nightly) |
| Power to PC › Manual enrollment | the enrollment itself (the CLI MDM command on Windows lands in P1.2) |
| Power to PC › Disk encryption | the BitLocker PIN, steps 3–5 |
| Apple at Work, Power to PC › Fleet Free | enrollment and APNs renewal; the paywalls run nightly |
| Orchestration › Log destination flow | Splunk, and status logs to the filesystem and an external destination (Andrey, 2026-11-19): phase 3 sends report results to the filesystem and a webhook, and nothing else, since osquery-perf sends no status logs and audit logs are premium |
| Orchestration › IdP Provisioning (SCIM) | connecting each IdP and the device enrollments, once phase 2 checks Fleet's side |
| Supply Chain › Lock & Wipe | whatever phase 2 can't run on the lab |

**Stays manual:** ADE enrollment and MDM migration, Autopilot, Windows MDM migration, FileVault, iOS and
iPadOS, Token & Certificate Renewals, the certificate authorities phase 2 doesn't reach, and *All product
groups* (bar the Helm chart, phase 3). **BYOD stays wholly manual** until the lab enrolls Android devices,
its Software step 1 included; it is the first row to revisit when they arrive.

## Phase 1 — one PR (`playwright/release-smokes-phase1`)

| | What | Where |
|---|---|---|
| P1.1 | `fleetctl run-script` on a pool VM of each platform: a passing and a failing script, the exit code and output fleetctl prints, the run in the host's activity | a CLI spec on the pool VMs |
| P1.2 | a Windows MDM command from the CLI, through `fleetctl mdm run-command`, and Fleet's record of it. Fleet takes only a single `<Exec>` as a custom Windows command (`ParseWindowsMDMCommand`), so no read-only `<Get>`: the test sends Defender's `UpdateSignature` from Fleet's own catalogue, a signature update Windows also runs by itself (approved by Andrey, 2026-11-19) | `shared/hosts/mdm-commands.spec.ts`, beside the macOS command |
| P1.3 | My device lists the host's vulnerable software with its CVEs, on every OS that has any; an OS with none is noted, not failed | a per-OS smoke (`helpers/os-smokes.ts`), both tiers |
| P1.4 | an FMA brought up to date by its patch policy, on a pool VM of each platform: the app pinned to its previous cached build and installed, the patch policy added (and passed), the pin cleared, the policy failing, its automation installing the newest build, the policy passing. Each platform takes the first candidate with two builds cached: Itsycal, then VS Code and Chrome on macOS; VS Code and Chrome on Windows, added to the VMs fleet for this on 2026-11-19 (Andrey: apps that ship often, two per platform), whose history starts once `vms.yml` reaches `main` | `premium/exclusive/software/fma-patch-policy.spec.ts`: a policy's install runs below every user-requested one |
| P1.5 | an FMA offered in self-service: installed from My device, and, once the library moves ahead of it, offered on My device's **Updates** card and updated from there. Claude on a pool Mac, beside update-on-host's other Claude tests, which pin the same title. It found that Fleet keeps the self-service flag per cached build (a pin activates another build with its own flag): filed as fleetdm/fleet#59238, worked around in the test | `premium/software/update-on-host.spec.ts` |
| P1.6 | the Windows OS-update deadline and grace period: set, kept across a reload, cleared. Settings only: nothing on a host is asserted | `premium/exclusive/os-updates/`, on Workstations |

## Phase 2 — one PR, with the device lab

| | What | Needs |
|---|---|---|
| P2.1 | SCIM, Fleet's side: a user and groups pushed to Fleet's SCIM endpoint, mapped to a lab host's IdP username, shown on Host details | to explore: the SCIM endpoint's auth from a test, and which host carries the IdP username |
| P2.2 | a certificate authority: a SCEP server in the lab, a certificate delivered to the macOS VM and listed on Host details | the lab's server; a certificate payload is a new profile type, so Andrey approves it first |
| P2.3 | Lock, Unlock and Wipe fired on real hosts and confirmed on the host: the lab spins up a fresh VM for the run, the test wipes it and checks the VM, and a webhook on the lab answers health checks and resets | a reset and health-check hook CI can reach (`long-term-goals.md` › *What to provision next*, item 1) |

**Where it stands (2026-11-19, interim):** explored by session `qa-automation-d6`; the lab measurements for P2.3
wait on its lab access. Verdicts so far:
- **P2.1 SCIM: automatable now, no infrastructure.** Premium only, always on, a global admin's API token. A user's
  name, groups and department reach Host details at once; deactivating a SCIM user deletes the matching SSO user
  in Fleet; the IdP host-vitals labels fill on a 5-minute cron. The first request sets premium's "last SCIM
  request" for good (a decision for Andrey). Okta could provision later (the suite's tenant already does, to the
  local instance); Entra and Google stay manual, and a Google Workspace integration switches SCIM off.
- **P2.2 certificate authorities: Custom SCEP and Smallstep automatable**, with a CA Render can reach (Fleet
  validates and proxies it): proposed as a Render private service. Proven on the local instance with micromdm's
  scepserver and a stub of Smallstep's challenge webhook. DigiCert and Okta Dynamic SCEP need accounts (Andrey's
  call); NDES stays manual. Delivering a certificate to a lab host waits for Andrey's approval.
- **P2.3 Lock and Wipe, Linux and Windows: automatable**, measured on two VMs of their own on the premium fleet
  "Lab experiments" (2026-11-19). A snapshot rollback alone leaves Fleet saying Locked or Wiped; a re-enroll
  clears it and keeps the host's id, so the VMs' baselines are taken without a node key: every reset (4 s)
  came back Unlocked as the same host. Fleet's state follows each action within 40 s. The VM is checked
  through Fleet (scripts and live queries still run on a locked host), plus its power state and a screenshot
  from the lab. CI reaches the lab through a webhook behind a tunnel with fixed actions and an allowlist, plus a
  watcher in the lab: no self-hosted runner. About 10 minutes as a workflow of its own after the smokes (about
  5 once the Ubuntu VMs' 2-minute network wait at boot is fixed). macOS waits for the January Macs. The run's
  product findings are tracked outside this repo.

## Phase 3 — a throwaway instance (separate session)

A workflow Andrey toggles that brings up a Fleet of its own on the runner, works it, and drops it with the
runner: a kind cluster with Fleet's Helm chart (its MySQL and Valkey subcharts) on the RC image, osquery-perf
simulations enrolled, a small Playwright project that needs none of the standing instances' state,
`generate-gitops` and an apply on the brand-new server, an upgrade from the last release with data that must
survive it, and the filesystem and webhook log destinations. **Free only:** there is no spare license key
(premium's would work technically, since Fleet checks a key offline and binds it to no server, but reusing it
is Andrey's call, not a test's). It replaces the Helm chart and Update flow rows and most of Log destination.
The session doing it keeps its own notes and branch; this file records the outcome.

**Where it stands (2026-11-19):** draft PR #158 (`playwright/throwaway-instance`), verified locally on kind and on Compose (4.95.0 → `main`). It hasn't run in CI: GitHub dispatches a `workflow_dispatch` workflow only once its file is on `main`. Proposed in the PR, not yet decided: merge, dispatch with `-f image=main` and fix forward; the other way is a temporary push trigger on the branch. Andrey chooses. It found that `generate-gitops` on a brand-new server writes `integrations.conditional_access_enabled` and `certificates_disable_host_end_user_binding` with no value, and they read back `false` after its own output is applied; the round-trip check counts no value and `false` as equal (not filed). Filed: fleetdm/fleet#59237 (fleetctl 4.x's `upgrade-packs` message). The shape: Andrey chose one workflow with two parallel jobs: the Helm chart on kind (a brand-new server on the build under test: Ready, clean logs, first-run setup in the UI, the `generate-gitops` round trip, osquery-perf hosts and the shared basic checks, uninstall), and the Update flow on Docker Compose, no Kubernetes (the last release with hosts and seeded data, an image swap and `fleet prepare db`, the before-and-after comparison, the same basic checks, and the log destinations). The rows it replaces are as below. He chose not to file the chart's migration-Job finding (it only affects the dev/test MySQL subchart; the workflow works around it), and approved filing fleetctl 4.x's wrong `upgrade-packs` message. What was proposed first, for the record:
The design: `QA — Throwaway instance`, one `ubuntu-latest` job, no secrets, about 20–25 minutes, kind with the
chart's MySQL and Valkey subcharts, TLS off, free. Part A is a brand-new server on the build under test (install,
Ready, clean logs; first-run setup and login in Playwright; `generate-gitops`, an apply, and `generate-gitops`
again with no diff). Part B is the Update flow from the last release: osquery-perf hosts and seeded data (a
report with results logged, policies, a label, a user, and from Fleet 4 a 2017 pack and `fleetctl upgrade-packs`),
`helm upgrade`, the data compared before and after, and every main page walked. Result logs go to the filesystem,
then to a webhook in the cluster. Playwright gets a `throwaway` project of its own (`tests/e2e/throwaway/`), with
no cleanup chain. Proven locally: 4.95.0 → `main` with the data intact, the pack dropped by the migration,
`/packs` answering 410, and both log destinations. Still manual from Log destination: Splunk and status logs
(osquery-perf sends none; audit logs are premium). Findings: with `mysql.enabled`
the chart's `fleet-migration` is a plain Job with a fixed name and a 100 s TTL, so a `helm upgrade` inside that
window fails with `field is immutable`; fleetctl 4.95's `upgrade-packs` says Fleet 5 will convert packs
automatically, while Fleet 5's migration drops them; and Fleet 5 refuses a webhook destination on a private
network unless `allow_private_network_integrations` is set (by design).

## Phase 4 — the checklist PR

Against `fleetdm/fleet`'s `.github/ISSUE_TEMPLATE/release-qa.md`, after phases 1–3: delete and cut the rows
above, remove packs, add the *Full suite on the RC* row, and spread what is left so no product group's share
is a token one, adding manual checks where a group's is light.
