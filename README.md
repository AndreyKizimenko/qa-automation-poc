# Fleet QA Automation

Combined Fleet QA tooling: GitOps configs, the Playwright browser + API
suite, and the GitHub Actions that wire them together.

## Layout

```
.
├── gitops/
│   ├── lib/                    # Shared payloads referenced by every config
│   │   ├── agent-options.yml
│   │   ├── icons/              # Software-title icons the configs upload
│   │   ├── labels/             # Label definitions (multi-entry files)
│   │   └── platforms/<os>/     # configuration-profiles, policies, reports, scripts, software (+ all/ for cross-platform reports)
│   ├── free-fleetqa/           # Baseline gitops config for the free QA instance
│   ├── free-fleetqa-min/       # Trimmed variant — used by gitops-verify
│   ├── premium-fleetqa/        # Baseline gitops config for the premium QA instance
│   ├── premium-fleetqa-min/    # Trimmed variant — used by gitops-verify
│   └── loadtest/               # Generator for the bulk loadtest team bundle (local-only)
├── playwright/                 # Playwright browser + API test suite
│   └── docs/                   # Suite docs: CI pipeline, blocked-by-product-bugs, long-term goals, test plans, gitops coverage, loadtest runs, test audit
├── tools/                      # Hand-run ops tooling — see tools/README.md
│   ├── perf-hosts/             # osquery-perf launchd daemons keeping QA hosts online
│   ├── windows-mdm-loadtest/   # Windows MDM profile fan-out + team-transfer drivers
│   ├── loadtest-api-audit/     # Checks the loadtest-api request matrix against the Fleet source
│   └── kubernetes/             # Helm-chart smoke test on Docker Desktop
├── plugins/fleet-qa/           # The fleet-qa Claude Code plugin (see below); .claude-plugin/ is its marketplace
├── .claude/skills/             # This repo's Claude Code skills (see below)
└── .github/
    ├── gitops-action/          # Composite action: install fleetctl, dry-run, apply
    ├── scripts/                # restore-gitops-exceptions.sh, run before every premium apply
    └── workflows/              # CI workflows (see below)
```

**This repo is public.** Real instance URLs, enroll secrets, and API tokens
never belong in it — they come from GitHub secrets in CI, and from gitignored
`.env` files locally. [`tools/README.md`](tools/README.md#before-you-run-anything)
covers the same rule for the hand-run tooling.

## Claude Code skills

**In this repo** (`.claude/skills/`, loaded in any session started here):

| skill | for |
|---|---|
| `playwright-test-author`, `playwright-test-reviewer`, `playwright-run-reviewer` | writing, reviewing and triaging the Playwright suite |
| `fleet-upgrade-preflight` | predicting which specs a Fleet upgrade will break |

**The `fleet-qa` plugin** (`plugins/fleet-qa/`, installed once per engineer and loaded in every repo):

| skill | for |
|---|---|
| `fleet-bug-qa` | QA a bug or security fix: reproduce on a pre-fix instance, verify on the fixed one |
| `fleet-test-plan` | write a story's test plan from the design, then update it once the PR is up |
| `fleet-story-qa` | QA a user story alongside the engineer |
| `fleet-quickwin-qa` | QA a small change end to end |
| `fleet-bug-file` | file a bug from a finding, and record how to retest it |
| `fleet-bug-retest` | retest the bugs you filed once their fix is in a build |
| `fleet-loadtest-qa` | QA and investigate behavior at scale on a 100k-host load test |
| `fleet-explore` | run a chartered exploratory session on a feature, page or area: worst-case data, every scope and entry point, lifecycle and interruption tours, with a tagged log and a debrief |

Install it once:

```bash
claude plugin marketplace add AndreyKizimenko/qa-automation-poc
claude plugin install fleet-qa@qa-automation --scope user
```

Update it with `claude plugin marketplace update qa-automation && claude plugin update fleet-qa@qa-automation`,
or turn on auto-update for the marketplace under `/plugin` → Marketplaces. Invoke a skill as
`/fleet-qa:fleet-bug-qa` (or just `/fleet-bug-qa` when nothing else has that name), or let Claude pick it up
from the request. To install from your own clone, try a branch's skills before they merge, or change a
plugin, see [`plugins/README.md`](plugins/README.md).

Both sets are linted by `skills-check.yml` on every PR that touches them (see CI below).

**The plugin runs against your own Fleet instances.** On first use it writes `~/.claude/fleet-qa.local.md`
(see `plugins/fleet-qa/skills/fleet-bug-qa/references/local-setup.md`):
- which fleetctl contexts are the fixed and the pre-fix instance;
- where your Fleet checkout and QA workspace are;
- which role users you keep;
- where Playwright is.

Tokens stay in `~/.fleet/config`. It also needs an authenticated `gh`, a Fleet checkout, a clone of this
repo with `npm ci` done in `playwright/` (the screenshot scripts use its Playwright), and Pillow
(`pip3 install pillow`) for `stack.py`. The load-test skill also needs the AWS CLI v2 (SSO), jq and GNU
`timeout`.

## Running locally

- **Playwright** — see [playwright/README.md](playwright/README.md).
- **GitOps (free)** — `fleetctl gitops --context <your free-instance context> -f gitops/free-fleetqa/default.yml`
- **GitOps (premium)** — every fleet file, and never `--delete-other-fleets` (the instance keeps a
  fleet that is deliberately not under gitops; see `gitops/premium-fleetqa/README.md`):
  ```bash
  fleetctl gitops --context qa-premium \
    -f gitops/premium-fleetqa/default.yml \
    -f gitops/premium-fleetqa/fleets/workstations.yml \
    -f gitops/premium-fleetqa/fleets/qa.yml \
    -f gitops/premium-fleetqa/fleets/vms.yml \
    -f gitops/premium-fleetqa/fleets/compliance.yml
  ```

`fleetctl gitops` aims only by `--context` and ignores `FLEET_URL` /
`FLEET_API_TOKEN`: without `--context` the config lands on whatever your
`default` context points at (see `gitops/premium-fleetqa/README.md`). Export
the matching `playwright/.env.<tier>` first — `set -a; source
playwright/.env.<tier>; set +a` — so the variables the config references reach
fleetctl: `FLEET_SSO_METADATA_URL`, `FLEET_ENROLL_SECRET` on free, and the
EUA / ABM / VPP vars on premium.

Loadtest runs are local-only — credentials change per run, so they are
not stored as GitHub Actions secrets. The loadtest fleet itself is
provisioned via [gitops/loadtest/](gitops/loadtest/README.md) before any
loadtest spec is run.

## CI

All workflows live in [.github/workflows/](.github/workflows/). Every
workflow supports `workflow_dispatch`; reusable ones also expose
`workflow_call`. This section is the map; the reasoning behind the flow is
[playwright/docs/ci-pipeline.md](playwright/docs/ci-pipeline.md).

| Workflow | Trigger | What it does |
|---|---|---|
| `qa-nightly.yml` | 03:17 UTC daily (GitHub starts it hours late), manual (optional `render-wait-minutes`, default 30, used only without Render credentials) | **The nightly**, as one chain: Render redeploy → wait for the deploys (Render's API when its credentials are set, else 30 min) + both instances healthy + a notice with each build → per tier, the gitops chain, then that tier's Playwright suite. `gh workflow run "QA — Nightly"`. |
| `render-deploy.yml` | Manual, `workflow_call` | Hits Render deploy hooks so the free + premium instances redeploy the image their Render service is set to (the current Fleet RC). The nightly's first step. |
| `gitops-free.yml` / `gitops-premium.yml` | Manual, `workflow_call` | Apply the baseline gitops config to the matching instance via the `gitops-action` composite. |
| `gitops-free-min.yml` / `gitops-premium-min.yml` | Manual, `workflow_call` | Apply the trimmed `-min` variant — used by gitops-verify to confirm gitops actually mutates the live instance. |
| `gitops-verify.yml` | Manual, `workflow_call` | Runs the Playwright `gitops-verify` project against a chosen gitops target (directory or `fleets/*.yml`) and asserts the live instance matches. |
| `nightly-qa-gitops-free.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Free chain: apply baseline → verify → apply min → verify → fleetctl checks. |
| `nightly-qa-gitops-premium.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Premium chain: same as free, but each pass applies and verifies (in parallel) the no-team config and the Workstations, QA, VMs and Compliance fleets; the min pass reuses the baseline's `qa.yml` and `vms.yml`. |
| `gitops-nightly-cli.yml` | `workflow_call` (last step of each tier's gitops chain), manual (`suite`) | Read-only fleetctl checks right after the min apply: `generate-gitops` reproduces the min config, and a `gitops --dry-run` of it proposes no deletions (Playwright `gitops-nightly` project). |
| `playwright-free.yml` / `playwright-premium.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Runs the Playwright suite against the matching instance — the main project, then the exclusive specs and (premium) gitops-mode as their own steps, merged into one report; project scope is folder-based (see `playwright/playwright.config.ts`). Test-state cleanup is owned by the suite: `cleanup-setup` runs before specs, `cleanup-teardown` after. Optional `workers` input. |
| `qa-branch-run.yml` | Manual (`branch` input, optional `workers`) | The nightly against a branch's code and config: per tier, the nightly gitops chain, then that tier's Playwright suite; the two tiers side by side. `gh workflow run "QA — Branch run" -f branch=<branch>`; add `-f workers=N` for a worker-count trial. |
| `playwright-check.yml` | Every PR, push to `main`, manual | Static gate: `tsc --noEmit` + `eslint` on the suite. Runs on every PR, with no path filter, because it is a required status check and one that never reports leaves a PR unmergeable. The only Playwright workflow that runs per-PR — the tier suites are nightly. |
| `skills-check.yml` | Every PR touching the skills, plugin manifests, tools or docs; push to `main`; manual | Lints the Claude Code skills (`.github/scripts/check-skills.sh`): frontmatter (`name` = folder, `description` present), no orphan `references/` or `scripts/` files, plugin manifests consistent with the marketplace, and no instance hostnames or credential-shaped strings in skill text or docs. Not a required check, so it keeps a path filter. |

Nightly ordering is by dependency, not by clock: `qa-nightly.yml` fires both
Render deploy hooks, waits for the deploys to finish (a hook only queues one, and
Render keeps the old instance serving until the new one is live — so the wait
polls Render's deploy API when `RENDER_API_KEY` and the two service ids are set,
failing on a failed deploy, and otherwise sleeps 30 min), checks both instances'
`/healthz`, records each instance's build, then runs each tier's gitops chain
and, once it has finished — green or red — that tier's suite, the two tiers side
by side. If the wait fails (a failed deploy, one not live in 30 min, or an
instance still unhealthy 15 min later), neither tier's gitops chain or suite runs
that night. It's scheduled for 03:17 UTC (10:17 PM CDT), off the top of the hour,
and GitHub starts it late: every scheduled run from 2026-10-01 to 10-10 started
5.9–7.3 h after its cron time (09:09–10:35 UTC) and took 1 h 29 m–1 h 44 m, 30 min
of it the fixed Render wait, so it finished around 11:15–12:15 UTC (~6:15–7:15 AM
CDT). The chain tolerates
the lag, since no step waits on a clock. A start at an exact
time would take an outside scheduler calling its `workflow_dispatch` with a token
that has **Actions: read and write** on this repo.

Each tier's gitops chain and Playwright suite share a concurrency group
(`<tier>-fleetqa-instance`), so an apply and a test run — or two test runs —
queue rather than overlap: an apply deletes what its config doesn't declare, and
the real VMs work one queue each. GitHub keeps one pending run per group, so a
newer queued run replaces an older queued one.

Every workflow in the gitops and Playwright chains takes an optional `ref`
input on `workflow_call` and checks it out, which is how `qa-branch-run.yml`
runs a branch's code under the default branch's workflow definitions. A branch
that changes a workflow file is dispatched with `--ref <branch>` as well, so the
run uses the branch's workflow YAML rather than `main`'s. A branch
run leaves the branch's gitops config applied until the next nightly re-applies
`main`'s.

### Required secrets

Instance + gitops:

| Secret | Used by |
|---|---|
| `FLEET_FREE_URL`, `FLEET_FREE_API_TOKEN` | gitops-free(-min), gitops-verify, gitops-nightly-cli, playwright-free, qa-nightly |
| `FLEET_FREE_ADMIN_EMAIL`, `FLEET_FREE_ADMIN_PASSWORD` | playwright-free |
| `FLEET_FREE_ENROLL_SECRET` | gitops-free(-min), gitops-verify, gitops-nightly-cli (enroll secret managed via gitops on free) |
| `FLEET_PREMIUM_URL`, `FLEET_PREMIUM_API_TOKEN` | gitops-premium(-min), gitops-verify, gitops-nightly-cli, playwright-premium, qa-nightly |
| `FLEET_PREMIUM_ADMIN_EMAIL`, `FLEET_PREMIUM_ADMIN_PASSWORD` | playwright-premium |
| `FLEET_FREE_SSO_METADATA_URL` | gitops-free(-min), gitops-verify, gitops-nightly-cli |
| `FLEET_PREMIUM_SSO_METADATA_URL` | gitops-premium(-min), gitops-verify, gitops-nightly-cli |
| `FLEET_EUA_METADATA_URL`, `FLEET_ABM_ORG_NAME`, `FLEET_VPP_LOCATION` | gitops-premium(-min), gitops-verify, gitops-nightly-cli |
| `FLEET_SSO_LOGIN_USERNAME`, `FLEET_SSO_LOGIN_PASSWORD` | playwright (admin SSO login spec, both tiers) |
| `RENDER_FREE_DEPLOY_HOOK`, `RENDER_PREMIUM_DEPLOY_HOOK` | render-deploy |
| `RENDER_API_KEY`, `RENDER_FREE_SERVICE_ID`, `RENDER_PREMIUM_SERVICE_ID` | qa-nightly's deploy wait (optional: without them it is a fixed 30-min sleep) |

Test users — the role-access specs authenticate as pre-provisioned static users
rather than creating them, so each needs its bearer token as a secret. Prefixed
`FLEET_FREE_` / `FLEET_PREMIUM_` and mapped to the unprefixed env var the suite
reads (see `playwright/.env.<tier>.example`):

| Secret | Used by |
|---|---|
| `FLEET_<TIER>_TEST_USER_PASSWORD` | user-CRUD specs (the password they assign) |
| `FLEET_<TIER>_STATIC_USER_PASSWORD` | shared password for the UI-login static users |
| `FLEET_<TIER>_STATIC_TOKEN_API_GLOBAL_{ADMIN,MAINTAINER,OBSERVER}` | global-role API probes (both tiers) |
| `FLEET_PREMIUM_STATIC_TOKEN_API_GLOBAL_{OBSERVER_PLUS,TECHNICIAN,GITOPS}` | premium-only global roles |
| `FLEET_PREMIUM_STATIC_TOKEN_API_WS_{MAINTAINER,OBSERVER,MAINT_QA_OBS}` | fleet-scoped + multi-fleet role probes |
| `FLEET_PREMIUM_STATIC_TOKEN_API_SPECIFIC_ENDPOINTS_{GLOBAL,WS}` | API-only users with an endpoint allowlist |
