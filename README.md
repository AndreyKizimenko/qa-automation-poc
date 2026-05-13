# Fleet QA Automation

Combined Fleet QA tooling: GitOps configs, the Playwright browser + API
suite, and the GitHub Actions that wire them together.

## Layout

```
.
├── gitops/
│   ├── lib/                    # Shared profiles, policies, scripts, labels, reports
│   ├── free-fleetqa/           # Baseline gitops config for the free QA instance
│   ├── free-fleetqa-min/       # Trimmed variant — used by gitops-verify
│   ├── premium-fleetqa/        # Baseline gitops config for the premium QA instance
│   ├── premium-fleetqa-min/    # Trimmed variant — used by gitops-verify
│   └── loadtest/               # Generator for the bulk loadtest team bundle (local-only)
├── playwright/                 # Playwright browser + API test suite
└── .github/
    ├── gitops-action/          # Composite action: install fleetctl, dry-run, apply
    └── workflows/              # CI workflows (see below)
```

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
| `render-deploy.yml` | 04:00 UTC daily, manual | Hits Render deploy hooks so the free + premium instances pick up the latest Fleet release before nightly runs. |
| `gitops-free.yml` / `gitops-premium.yml` | Manual, `workflow_call` | Apply the baseline gitops config to the matching instance via the `gitops-action` composite. |
| `gitops-free-min.yml` / `gitops-premium-min.yml` | Manual, `workflow_call` | Apply the trimmed `-min` variant — used by gitops-verify to confirm gitops actually mutates the live instance. |
| `gitops-verify.yml` | Manual, `workflow_call` | Runs the Playwright `gitops-verify` project against a chosen gitops target (directory or `fleets/*.yml`) and asserts the live instance matches. |
| `nightly-qa-gitops-free.yml` | 05:00 UTC daily, manual | Free chain: apply baseline → verify → apply min → verify. |
| `nightly-qa-gitops-premium.yml` | 05:00 UTC daily, manual | Premium chain: same as free, plus parallel verify of the Workstations team. |
| `playwright-free.yml` / `playwright-premium.yml` | 05:30 UTC daily, manual | Runs the Playwright suite against the matching instance — project scope is folder-based (see `playwright/playwright.config.ts`). Test-state cleanup is owned by the suite: `cleanup-setup` runs before specs, `cleanup-teardown` after. |

Nightly ordering: Render redeploy at 04:00 UTC → gitops orchestrators at
05:00 UTC → Playwright at 05:30 UTC.

### Required secrets

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
| `FLEET_SSO_LOGIN_USERNAME`, `FLEET_SSO_LOGIN_PASSWORD` | playwright (admin SSO login spec) |
| `RENDER_FREE_DEPLOY_HOOK`, `RENDER_PREMIUM_DEPLOY_HOOK` | render-deploy |
