# free-fleetqa-reset

Empty variant of [`../free-fleetqa/`](../free-fleetqa/). Applied as the
final gitops step before the Playwright nightly so the no-team scope
starts as a known blank slate.

What's wiped:

| Resource | baseline count | reset count |
|---|---:|---:|
| Configuration profiles (macOS/Win/Android) | 23 | 0 |
| Scripts | 11 | 0 |
| Policies | 27 | 0 |
| Reports | 30 | 0 |

Preserved:

- `agent_options`
- `org_settings` — features, fleet desktop, host expiry, SMTP, SSO, server URL, org info
- Enroll secret
- Labels (test infrastructure — tests filter hosts by these)

## Usage

Apply via the `gitops-free-reset` workflow (runs as the final step of the nightly chain), or locally:

```bash
set -a; source playwright/.env.free; set +a
fleetctl gitops -f gitops/free-fleetqa-reset/default.yml
```

The Playwright suite's `cleanup-teardown` project re-wipes the same
entities at the end of every test run as defence in depth.
