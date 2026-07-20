# GitOps coverage config

A dedicated GitOps configuration whose only job is to **exercise every
fully-appliable GitOps setting** in one `fleetctl gitops` run, so we have a
durable, dry-run-validated proof of the supported `.yml` surface. Apply it to a
**dedicated test instance** (it manages global config + replaces labels/policies
and, with `--delete-other-fleets`, teams).

Derived from the authoritative schema (`pkg/spec/gitops.go`), the Fleet YAML docs,
and the `it-and-security` + `premium-fleetqa` examples.

## Layout

| File | Exercises |
|------|-----------|
| `default.yml` | `org_settings` (org_info, server_settings, features, fleet_desktop, host_expiry, activity_expiry, vulnerability_settings, all four webhook types, **gitops-mode** block, secrets) · no-team `controls` · `labels` (dynamic + manual) · `reports` · `agent_options` |
| `fleets/controls-coverage.yml` | Full `controls`: disk encryption, recovery lock, BitLocker PIN, OS updates (macOS/iOS/iPadOS/Windows), profiles (mac/win/android + label scoping), `scripts`, `macos_migration`, `setup_experience` (creds-free sub-keys) · team `settings` (features, host_expiry, webhooks, secrets) |
| `fleets/software-coverage.yml` | `software`: script-only package + Fleet-maintained apps (self_service, setup_experience, categories, label scoping) · policy automations `install_software`, `run_script`, and `type: patch` |
| `fleets/policies-reports-coverage.yml` | Policy keys (critical, label include/exclude) · report/query keys (interval, automations_enabled, logging, discard_data, observer_can_run, min_osquery_version) |
| `lib/` | Coverage-local assets: rich `agent-options.yml` (config + command_line_flags + update_channels), scripts (script-only package, run-on-fail, setup), manual label. Shared profiles/scripts/reports are reused from `../../lib/`. |

## Intentionally NOT covered (need external creds/infra)

ABM / Apple Business · VPP / `app_store_apps` · SSO · `integrations` (Jira, Zendesk,
Google Calendar) · `conditional_access` · `certificate_authorities` · SMTP ·
`end_user_authentication` (IdP) · EULA · org logo file uploads. Plus
`org_settings.yara_rules` (schema differs across the client/server versions in
use — re-add when they agree). Add these to a credentialed variant if/when the
test instance has the integrations configured.

## Prerequisites

- **Premium** Fleet test instance.
- GitOps **"secrets" exception OFF** in Fleet settings (else remove the `secrets:` keys).
- Env vars: `FLEET_URL`, `COVERAGE_ENROLL_SECRET`, `COVERAGE_TEAM_ENROLL_SECRET`.
- A fleetctl config context for the instance (address + token).

## Validate / apply

```bash
# Dry-run (validate only — no changes):
FLEET_URL=https://<instance> \
COVERAGE_ENROLL_SECRET=<x> COVERAGE_TEAM_ENROLL_SECRET=<y> \
  fleetctl gitops --config <ctx> --dry-run \
    -f default.yml \
    -f fleets/controls-coverage.yml \
    -f fleets/software-coverage.yml \
    -f fleets/policies-reports-coverage.yml

# Apply for real: drop --dry-run. Add --delete-other-fleets to also remove
# teams not defined here (only on a throwaway instance).
```

Last validated: `fleetctl gitops --dry-run` **succeeded** against a Premium
instance (Fleet 4.87) on 2026-06-28 — global config, MDM profiles, a report, and
all three coverage teams (incl. software packages + policy automations) applied
clean. (`secrets` was validated separately; that instance had the secrets
exception ON.)
