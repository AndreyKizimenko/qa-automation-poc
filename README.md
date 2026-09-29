# Fleet QA Automation

Combined Fleet QA tooling: GitOps configs, the Playwright browser + API
suite, and the GitHub Actions that wire them together.

## Layout

```
.
├── gitops/
│   ├── lib/                    # Shared payloads referenced by every config
│   │   ├── agent-options.yml
│   │   ├── labels/             # Label definitions (multi-entry files)
│   │   └── platforms/<os>/     # configuration-profiles, policies, reports, scripts
│   ├── free-fleetqa/           # Baseline gitops config for the free QA instance
│   ├── free-fleetqa-min/       # Trimmed variant — used by gitops-verify
│   ├── premium-fleetqa/        # Baseline gitops config for the premium QA instance
│   ├── premium-fleetqa-min/    # Trimmed variant — used by gitops-verify
│   └── loadtest/               # Generator for the bulk loadtest team bundle (local-only)
├── playwright/                 # Playwright browser + API test suite
│   └── docs/                   # Suite docs: blocked-by-product-bugs, QA Wolf migration record
├── tools/                      # Hand-run ops tooling — see tools/README.md
│   ├── perf-hosts/             # osquery-perf launchd daemons keeping QA hosts online
│   ├── windows-mdm-loadtest/   # Windows MDM profile fan-out + team-transfer drivers
│   └── kubernetes/             # Helm-chart smoke test on Docker Desktop
└── .github/
    ├── gitops-action/          # Composite action: install fleetctl, dry-run, apply
    └── workflows/              # CI workflows (see below)
```

`qa-wolf/` is deliberately untracked — the source `*.flow.js` exports the
Playwright suite was migrated from. It isn't runnable and isn't needed for
anything here.

**This repo is public.** Real instance URLs, enroll secrets, and API tokens
never belong in it — they come from GitHub secrets in CI, and from gitignored
`.env` files locally. [`tools/README.md`](tools/README.md#before-you-run-anything)
covers the same rule for the hand-run tooling.

## Claude Code skills

Checked in under `.claude/skills/`, so every Claude Code session started in this repo has them:

| skill | for |
|---|---|
| `playwright-test-author`, `playwright-test-reviewer`, `playwright-run-reviewer` | writing, reviewing and triaging the Playwright suite |
| `fleet-upgrade-preflight` | predicting which specs a Fleet upgrade will break |
| `fleet-bug-qa` | QA a bug or security fix: reproduce on a pre-fix instance, verify on the fixed one |
| `fleet-story-qa` | QA a user story alongside the engineer |
| `fleet-quickwin-qa` | QA a small change end to end |
| `fleet-bug-file` | file a bug from a finding, and record how to retest it |
| `fleet-bug-retest` | retest the bugs you filed once their fix is in a build |

The last five run against your own Fleet instances. On first use they write
`.claude/fleet-qa.local.md` (gitignored; see `.claude/skills/fleet-bug-qa/references/local-setup.md`):
- which fleetctl contexts are the fixed and the pre-fix instance;
- where your Fleet checkout and QA workspace are;
- which role users you keep.

Tokens stay in `~/.fleet/config`. The skills also need an authenticated `gh`, a Fleet checkout, `npm ci`
in `playwright/` (the screenshot scripts use its Playwright), and Pillow (`pip3 install pillow`) for
`stack.py`.

## Running locally

- **Playwright** — see [playwright/README.md](playwright/README.md).
- **GitOps (free)** — `fleetctl gitops -f gitops/free-fleetqa/default.yml`
- **GitOps (premium)** —
  ```bash
  fleetctl gitops \
    -f gitops/premium-fleetqa/default.yml \
    -f gitops/premium-fleetqa/fleets/workstations.yml \
    --delete-other-fleets
  ```

Source the matching `playwright/.env.<tier>` first so `FLEET_URL` /
`FLEET_API_TOKEN` (and the SSO / VPP / ABM env vars used by gitops) are
in the environment.

Loadtest runs are local-only — credentials change per run, so they are
not stored as GitHub Actions secrets. The loadtest fleet itself is
provisioned via [gitops/loadtest/](gitops/loadtest/README.md) before any
loadtest spec is run.

## CI

All workflows live in [.github/workflows/](.github/workflows/). Every
workflow supports `workflow_dispatch`; reusable ones also expose
`workflow_call`.

| Workflow | Trigger | What it does |
|---|---|---|
| `qa-nightly.yml` | 03:00 UTC daily (GitHub starts it hours late), manual | **The nightly**, as one chain: Render redeploy → 30-min wait + both instances healthy → per tier, the gitops chain, then that tier's Playwright suite. `gh workflow run "QA — Nightly"`. |
| `render-deploy.yml` | Manual, `workflow_call` | Hits Render deploy hooks so the free + premium instances pick up the latest Fleet release. The nightly's first step. |
| `gitops-free.yml` / `gitops-premium.yml` | Manual, `workflow_call` | Apply the baseline gitops config to the matching instance via the `gitops-action` composite. |
| `gitops-free-min.yml` / `gitops-premium-min.yml` | Manual, `workflow_call` | Apply the trimmed `-min` variant — used by gitops-verify to confirm gitops actually mutates the live instance. |
| `gitops-verify.yml` | Manual, `workflow_call` | Runs the Playwright `gitops-verify` project against a chosen gitops target (directory or `fleets/*.yml`) and asserts the live instance matches. |
| `nightly-qa-gitops-free.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Free chain: apply baseline → verify → apply min → verify → fleetctl checks. |
| `nightly-qa-gitops-premium.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Premium chain: same as free, plus parallel verify of the Workstations team. Both passes also apply the QA and VMs fleets (`qa.yml`, `vms.yml`). |
| `playwright-free.yml` / `playwright-premium.yml` | Nightly (via `qa-nightly.yml`), manual, `workflow_call` | Runs the Playwright suite against the matching instance — project scope is folder-based (see `playwright/playwright.config.ts`). Test-state cleanup is owned by the suite: `cleanup-setup` runs before specs, `cleanup-teardown` after. |
| `qa-branch-run.yml` | Manual (`branch` input) | The nightly against a branch's code and config: per tier, the nightly gitops chain, then that tier's Playwright suite; the two tiers side by side. `gh workflow run "QA — Branch run" -f branch=<branch>`. |
| `playwright-check.yml` | PR + push to `main` touching `playwright/**`, manual | Static gate: `tsc --noEmit` + `eslint` on the suite. The only Playwright workflow that runs per-PR — the tier suites are nightly. |

Nightly ordering is by dependency, not by clock: `qa-nightly.yml` fires both
Render deploy hooks, waits 30 min for the deploys to finish (a hook only queues
one, and Render keeps the old instance serving until the new one is live), checks
both instances' `/healthz`, then runs each tier's gitops chain and, once it has
finished — green or red — that tier's suite, the two tiers side by side. It's
scheduled for 03:00 UTC (10 PM CDT), and GitHub starts it late — since 2026-08-27
this repo's scheduled runs have been starting 4–6.5 h after their cron time — so
it lands around 1–4:30 AM Central and is done before morning. The chain tolerates
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
run leaves the branch's gitops config applied until the next nightly re-applies
`main`'s.

### Required secrets

Instance + gitops:

| Secret | Used by |
|---|---|
| `FLEET_FREE_URL`, `FLEET_FREE_API_TOKEN` | gitops-free, gitops-verify, playwright-free |
| `FLEET_FREE_ADMIN_EMAIL`, `FLEET_FREE_ADMIN_PASSWORD` | playwright-free |
| `FLEET_FREE_ENROLL_SECRET` | gitops-free (enroll secret managed via gitops on free) |
| `FLEET_PREMIUM_URL`, `FLEET_PREMIUM_API_TOKEN` | gitops-premium, gitops-verify, playwright-premium |
| `FLEET_PREMIUM_ADMIN_EMAIL`, `FLEET_PREMIUM_ADMIN_PASSWORD` | playwright-premium |
| `FLEET_FREE_SSO_METADATA_URL` | gitops-free |
| `FLEET_PREMIUM_SSO_METADATA_URL` | gitops-premium |
| `FLEET_EUA_METADATA_URL`, `FLEET_ABM_ORG_NAME`, `FLEET_VPP_LOCATION` | gitops-premium |
| `FLEET_SSO_LOGIN_USERNAME`, `FLEET_SSO_LOGIN_PASSWORD` | playwright (admin SSO login spec, both tiers) |
| `RENDER_FREE_DEPLOY_HOOK`, `RENDER_PREMIUM_DEPLOY_HOOK` | render-deploy |

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
