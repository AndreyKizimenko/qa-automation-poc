# Fleet QA Automation

POC for combined Fleet QA tooling.

## Layout

```
.
├── gitops/
│   ├── premium-fleetqa/   # fleetctl gitops config for the premium QA instance
│   └── free-fleetqa/      # fleetctl gitops config for the free QA instance
├── playwright/            # Playwright browser + API test suite
└── .github/workflows/     # CI (workflow_dispatch only, for now)
```

## Running locally

- **Playwright** — see [playwright/README.md](playwright/README.md).
- **GitOps** — `fleetctl gitops -f gitops/premium-fleetqa/default.yml` (env vars for that instance must be set).

Loadtest runs are local-only — credentials change per run, so they are not stored as GitHub Actions secrets.
