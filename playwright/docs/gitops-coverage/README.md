# GitOps coverage — the plan

Customers run Fleet from YAML, so the nightly should prove that `fleetctl gitops` applies the whole
surface Fleet documents, on both tiers, against a live instance — and keep proving it after every
RC. Today it proves the names and counts of six entity kinds and four org keys. This plan grows that
without the Playwright suite noticing, in three batches: things that need no new fixture or fleet,
then a gitops-only fleet for every control that reaches a host, then the items that need a fixture,
a credential or a decision.

It was written from an audit of the chain, the suite's dependencies on gitops state, the cleanup
pipeline, Fleet 4.93's schema and docs, and the stale `playwright/gitops-coverage` branch
(2026-07-20, never PR'd). Section 2 is the audit; everything after it follows from those facts.

## 1. What exists today

**The chain.** `QA — Nightly` and `QA — Branch run` run, per tier, `nightly-qa-gitops-{premium,free}.yml`:
apply the baseline (`gitops/<tier>-fleetqa/`) → `gitops-verify` → apply the min variant
(`gitops/<tier>-fleetqa-min/`) → `gitops-verify` → `gitops-nightly` (fleetctl checks) → then that tier's
suite. The apply is `.github/gitops-action/action.yml` (install the server's `fleetctl`, dry-run, apply);
premium's applies first run `.github/scripts/restore-gitops-exceptions.sh`. Verify is the Playwright project
`gitops-verify` (`tests/api/gitops-verify/`, 22 tests in 6 specs, bearer token, no browser), fed a
`GITOPS_TARGET` directory (no-team scope) or fleet file. The fleetctl checks are `tests/cli/nightly/`:
`generate-gitops` reproduces the min config's label, policy and report sets and org name, and
`gitops --dry-run` of the min config proposes no deletions.

**What is declared.** Both tiers: `agent_options`, `org_settings` (org_info, features, fleet_desktop,
host_expiry, server_settings, sso; free adds `secrets`; premium adds the `mdm` block with the EUA IdP, the ABM
token mapped to Workstations and the VPP token on all fleets), no-team `controls` (Windows and, on premium,
Android MDM flags, 11 scripts, 11 macOS + 10 Windows + 2 Android profiles), 25 labels, 27 policies, 30
reports. Premium adds `fleets/workstations.yml` (23 profiles, 23 policies, 6 scripts, 5 reports, team
settings), `fleets/qa.yml` (20 Fleet-maintained apps, the version-history shelf) and `fleets/vms.yml`
(4 packages, 4 FMAs, 2 install-software policies, 1 report — the real VMs' durable fixtures).

**What is verified.** For no-team and Workstations only: label, policy, report, script and profile
name sets (count + every-declared-exists + no-extra), policy and report `platform`, and four org keys
(`org_name`, three SSO fields, `windows_enabled_and_configured`, two `features`). Nothing else:
`docs/test-audit/16-gitops-verify.md` › *Coverage map* lists the gaps.

**Applied but never verified.** `qa.yml` and `vms.yml` (no verify job targets them, and the parser can't
read them — §2.6); every `server_settings`, `host_expiry`, `fleet_desktop`, `mdm`, `agent_options` key;
Workstations' `settings:`; the policy automations on VMs; every report option; the Android flag; the set of
fleets.

**The relationship with the suite.** The suite's `cleanup-setup` project runs *after* the chain and
deletes every global report and policy, every Unassigned script, profile and installable title, and
Workstations' policies, profiles, scripts and software (reports excepted) — see `playwright/CLAUDE.md` ›
cleanup. Labels, org settings, Workstations' reports and everything on QA and VMs survive. So the chain
verifies, and then the suite wipes; the next nightly re-provisions. **A new gitops item at global, Unassigned
or Workstations scope is seen by `gitops-verify` and the fleetctl checks and by nothing else.**

**The exceptions baseline.** Premium rests on `labels: false, software: false, secrets: true`
(`GITOPS_EXCEPTIONS_BASELINE`, mirrored in the restore script). `fleetctl gitops` reads them with the mode
off: a not-excepted entity whose key the YAML omits is deleted, an excepted one whose key the YAML carries is
refused (`server/service/client.go:2256-2300`). Premium therefore never declares `secrets:`.

## 2. What the audit found

Each item below is a fact the design rests on, with where it comes from.

1. **Verification runs before the wipe.** `cleanup-setup` is a dependency of the `premium` / `free`
   projects, which start only after their gitops chain (`qa-nightly.yml`, `qa-branch-run.yml`). Everything
   declared is intact when `gitops-verify` and `gitops-nightly` read it. Growing the declared surface at
   global, Unassigned or Workstations scope therefore costs the suite nothing — provided no spec *assumes*
   the item's absence or a particular value (item 10).

2. **Workstations must stay hostless and "enforcing nothing".** `exclusive/os-updates/macos-updates.spec.ts`
   asserts Workstations enforces no OS update before it starts; `ddm-conflict.spec.ts:60` asserts it holds no
   real host; `setup-experience/bootstrap-package.spec.ts` runs its lifecycle on Unassigned and Workstations;
   `cleanup.steps.ts:142-159` resets Workstations' setup experience and OS updates every run. Any
   host-affecting control declared there would be asserted absent, then reset. **Host-affecting controls need
   a fleet of their own** (§3.1), on the precedent of QA (the FMA shelf) and VMs.

3. **Free's `controls` reach the free VMs.** On free the three real VMs sit in Unassigned, and Unassigned is
   where `default.yml`'s 23 profiles land every night, in the window before `cleanup-setup` deletes them
   (among them `prevent-autologon.mobileconfig`, a `com.apple.loginwindow` payload, and the Windows firewall,
   Defender and remote-assistance profiles). This predates the plan and is flagged in §7. For the plan it
   means: **free's expansion is org settings, labels, reports, policies, scripts and host vitals — no new
   profiles, no disk encryption, no OS updates, no agent-options changes.**

4. **Omitted keys aren't reset.** fleetdm/fleet#48021 and #53899: a key the YAML drops keeps its live value.
   The min variant today proves *deletion* of entities and one *update* (`org_name`). A min variant that
   merely omits a new key proves nothing, so **every new section gets a changed value in the min variant**
   (§3.3), which also exercises the update path that #48021 lives in.

5. **Premium forces `enable_analytics: true`** (`server/service/appconfig.go:1082`, `IsAllowDisableTelemetry`).
   Premium's YAML declares `false`; the live value is `true`. A verify assertion on it would fail, correctly.
   Fix the YAML (premium `true`, free `false`) and verify it.

6. **The verify harness can't follow an expansion** (`helpers/gitops-yaml.ts`, `tests/api/gitops-verify/`):
   `expandList` reads only `path:` entries, so an inline entry (every report and policy in `vms.yml`) throws;
   it never reads `software`, `agent_options`, `settings`, `custom_host_vitals` or `paths:` globs; the labels
   spec counts every non-builtin label on the instance against `default.yml` (a fleet-scoped label would fail
   it); only `default.yml` and `workstations.yml` have verify jobs; the idempotence dry-run covers
   `<min>/default.yml` + `<min>/fleets/*.yml`, so `qa.yml` and `vms.yml` (applied from the baseline directory
   in both passes) are outside it; ten tests are `for` loops over a possibly-empty list; every GET is
   `per_page=200` with no `has_next_results` check; `GITOPS_TARGET` defaults to free regardless of `SUITE`.
   `docs/test-audit/16-gitops-verify.md` › *Quick wins* lists the last three.

7. **Premium's client now matches the server.** `fleetctl@4.93.0` is on npm, and the action installs the
   server's release when it exists. 4.93 added only `only_allow_apple_business_enrollment`,
   `notify_before_patching` and the `certificates_idp_*` integration keys (and extended attestation to
   iOS/iPadOS), so nothing in 4.93's docs is at risk of a client-side "unknown key" rejection — which is fatal:
   an unknown key fails the run unless `--allow-unknown-keys` is passed (`pkg/spec/gitops_validate.go`).

7b. **What a dry-run proves, and what omission does** (schema sweep of `pkg/spec/gitops.go`,
   `server/service/client.go`, `cmd/fleetctl/fleetctl/gitops.go`):
   - `--dry-run` validates YAML shape and sends config, profiles, scripts and software to the server, but
     **never sends policies, reports or labels** (`client.go:3806`, `:3984`, `:3408`). A green dry-run of a new
     policy, report or label proves only that it parses; the branch run's real apply is the proof.
   - Omitting a key is not neutral. `mdm.apple_business` and `volume_purchasing_program` omitted → fleetctl
     sends `[]` and **clears every token's fleet mapping**; `sso_settings` omitted → admin SSO off;
     `end_user_authentication` omitted → rejected while any fleet has EUA on; `windows_enabled_and_configured`
     omitted → Windows MDM off and pending Windows profiles cleaned up (`appconfig.go:1887`); `features`
     omitted → every `enable_*` and `historical_data.*` forced true; a fleet file's `controls` or
     `agent_options` omitted → null (clears). Every file keeps declaring what it declares today.
   - Deletions run at the end of the run, after updates; a label referenced by any profile, software, report or
     policy must still exist afterwards; **renaming a label is delete + create and resets its membership**.
   - `controls.android_enabled_and_configured` is **ignored by the server on PATCH** (`appconfig.go:1166`): it only
     feeds the dry-run's assumptions. Android MDM is turned on in the UI. Declaring it documents the assumption;
     verifying it compares live to YAML, not an apply to its effect.
   - The docs describe keys the code doesn't have: `apple_settings.managed_local_account_settings`,
     `apple_settings.end_user_local_account_type`, `linux_settings.enable_managed_local_account` and
     `setup_experience.require_all_software` (the live keys are `setup_experience.enable_managed_local_account`
     / `end_user_local_account_type` and `windows_settings.enable_managed_local_account`); `yara_rules[].path`
     is validated against a struct with only `name` and `contents`, so it probably fails as an unknown key —
     which is why the coverage branch dropped it. These are docs bugs to file (§7).

8. **The instances have more configured than the coverage branch assumed.** Live config (2026-10-08,
   `4.93.0-rc.2610071358` both): premium has Apple MDM, ABM (terms current), one VPP token, Windows MDM,
   Android MDM, SSO and the Okta EUA IdP; free has Apple, Windows and Android MDM and SSO. Neither has SMTP,
   Jira, Zendesk, Google Calendar, a certificate authority, conditional access or YARA rules. So `macos_setup`
   keys, `enable_end_user_authentication`, VPP `app_store_apps` and Android apps are *applicable* here; the
   coverage branch's README excluded them as credential-gated.

9. **`fleetctl gitops` creates a fleet without `secrets:`.** With the secrets exception on the key is optional
   (`client.go:2600`) and `NewTeam` generates a default secret (`ee/server/service/teams.go:135`). A new fleet
   file needs no secret and no hand step.

10. **Specs that depend on today's values** (agent sweep of `tests/`, `helpers/`, `setup/`):
    `free|premium/policies/policy-automations.spec.ts` assert no Jira/Zendesk integration (never declare
    `integrations`); `shared/settings/organization/custom-logo.spec.ts` skips when a logo is set (keep
    `org_logo_url*: ""`); `premium/dashboard/historical-data-collection.spec.ts` and `fleet-scoped-cards`
    need `features.historical_data` on (declare `true`/`true`; `false` **deletes history irreversibly**);
    `shared/auth/sso-login.spec.ts` needs SSO on with `idp_name` matching /okta/i; `software/library.spec.ts`
    needs the VPP token on all fleets, Android MDM on, and Bear (iOS) available; `helpers/api/hosts.ts:365`
    relies on global host expiry at 1 day; two gitops-mode specs and `reports/role-access.spec.ts` read
    "Collect default browser on macOS" on Workstations (both configs must keep declaring it, with
    `observer_can_run: true`); `labels/role-access.spec.ts` (both tiers) reads "Debian-based Linux hosts";
    `version-pinning.spec.ts` needs Postman on QA, unpinned. Nothing in the suite reads
    `webhook_settings`, `activity_expiry_settings`, `vulnerability_settings`, `custom_host_vitals`,
    `agent_options` content (beyond stripping `script_execution_timeout` on VMs/global) or any fleet's
    OS-update, disk-encryption or setup-experience state except on Unassigned, Workstations and VMs.

11. **What the fleetctl checks expect.** `cli/premium/generate-gitops.spec.ts:19-33`: the generated global
    file has no `controls`, Workstations' has `enable_disk_encryption`. `cli/nightly/generate-gitops.spec.ts`:
    on premium the generated tree has `workstations` and `unassigned`. A new fleet adds a `fleets.has()` line.
    generate-gitops still exits 1 on free with Apple MDM on (fleetdm/fleet#53965, skipped).

12. **Two CI gaps.** The apply workflows (`gitops-{premium,free}{,-min}.yml`) use concurrency groups
    `gitops-premium` / `gitops-free`, not the instance groups the orchestrator and suite share, so a *manual*
    dispatch can run during a suite and delete its per-run state. And the dry-run step downloads software
    installers (fleetdm/fleet#54535), so every package added to the premium config is downloaded twice per
    apply unless it is hash-pinned and already in storage.

13. **Stale text found on the way:** `team-host-status-webhook.spec.ts:19-22` says gitops keeps global host
    expiry off (it is on, 1 day); `helpers/api/fleets.ts:7-11` and that spec say Workstations carries a
    failing-policies webhook (it declares none); `premium-fleetqa-min/default.yml:112` describes the opposite of
    what it drops; `premium-fleetqa/README.md`'s scope table says VMs has "2 FMAs" (4, plus 4 packages and a
    report); `premium-fleetqa-min/README.md` and `CLAUDE.md:276` say the instances rest on min — between
    nights they hold min *minus* everything `cleanup-teardown` wipes (item 1).

14. **The `playwright/gitops-coverage` branch** (one commit, 11 files, `gitops/coverage/`) is a parts bin, not
    a config. It was written for a throwaway instance: `secrets:` at both scopes (refused on premium),
    Recovery Lock + BitLocker PIN + OS deadlines on one fleet (fine on a hostless fleet, §3.1), `enable_analytics:
    true` (right for premium, item 5), YARA omitted for a schema mismatch, a dry-run last passing on 4.87. Its
    per-key examples are sound and mostly current: the four webhooks, `activity_expiry_settings`, a
    label-scoped profile, a script-only package, `install_software` / `run_script` / `type: patch` policies,
    `critical` and label-scoped policies, two reports carrying every option, a manual label, a rich
    `agent_options`. §4 says which land where. Delete the branch once harvested; nothing references it.

## 3. The design

### 3.1 A gitops-only fleet carries every control that reaches a host

A new premium fleet, **Compliance** (it reads like a customer fleet: OS updates, disk encryption, Recovery
Lock, BitLocker PIN; the name is final before the first apply, since a fleet's gitops identity is its file and
a later rename orphans the old one) — declared in
`gitops/premium-fleetqa/fleets/compliance.yml` and `gitops/premium-fleetqa-min/fleets/compliance.yml`,
applied and verified in both passes, included in the idempotence dry-run.

Why a fleet, and why this one: it holds no host, so OS-update deadlines, disk encryption, Recovery Lock,
`name_template`, `setup_experience`, agent `command_line_flags` and `update_channels` reach nothing; the suite
never names it (static users have no role there, `software/role-access.spec.ts:65` checks the picker
*includes* the standing fleets, `reports/role-access.spec.ts` lists are offered/absent, not exact); the
cleanup touches Unassigned, Workstations, QA/VMs pins, VMs' `pw-*` leftovers and `pw-*` fleets — nothing
here as long as the name never starts with `pw-`. It is the same reasoning that put the FMA shelf on QA.

Rules for the file: no `secrets:` (refused — item 1.exceptions); a `software:` key always present (with
`software: false` excepted, a premium fleet file without one deletes the fleet's software); packages only
by `hash_sha256` of files already in storage (the inert `fleet-playwright-install` `.pkg` / `.msi` / `.deb`
and 7-Zip, declared on VMs — zero download) or small FMAs (the 2 GB Render box, `qa.yml`'s size rule);
`self_service` and `setup_experience` flags are harmless here (nothing to install on) and so are declared;
no `pw-*` names on anything; `version:` pins are fine here (cleanup unpins only QA and VMs) and a caret pin
is what gets declared.

Hazards it does not remove: a spec that one day *moves a host in* (none does; the header says so and the
sweep in `cleanup.steps.ts` could assert `host_count == 0`); ABM's default fleet stays Workstations (§7).

### 3.2 Free grows at global scope only

Free gets the org keys, labels, reports, policies, scripts and host vitals of §4, in `shared`-style parity
with premium where the key is free (`premium:"true"` struct tags and `license.IsPremium` checks decide,
not the docs): policy `critical`, calendar events, conditional access, every automation and label
targeting are premium (`server/fleet/policies.go:372-410`); report label targeting is premium
(`queries.go:322`); `fleet_desktop` *changes* are premium (`appconfig.go:2071`) so free declares the defaults
and verifies them; `gitops_mode_enabled` is premium; `custom_host_vitals` has no gate in `server/service`
or the REST docs — confirmed on free by dry-run during batch 1 before it is declared there.

### 3.3 Every new section has a value delta in the min variant

The baseline → min alternation is what gives `gitops-verify` teeth (item 4). For each new section the min
variant **changes a value** (an interval, a URL path, a deadline, a `minimum_version`, a boolean, a pin) rather
than dropping the key, and drops one entity where the section is a list. The verify spec reads the YAML, so
one spec covers both passes.

### 3.4 The verify harness grows with the surface

`helpers/gitops-yaml.ts` learns inline entries, `paths:` globs, `software`, `agent_options`, `settings`,
`custom_host_vitals`, fleet-scoped `labels`, and the option fields of each entity (interval, logging,
`discard_data`, `observer_can_run`, `automations_enabled`, `min_osquery_version`, `critical`, label targeting,
automations, `self_service`, `categories`, pins). `tests/api/gitops-verify/` gets one generic exact-set
helper (count + declared-exists + no-extra, with a non-empty guard and a `has_next_results` check), the
existing six specs rewritten on it, and new specs: `settings` (org and fleet), `software`, `controls`
(flags, disk encryption, OS updates, Recovery Lock, setup experience), `fleets` (the live fleet set equals the
declared fleet files plus the hand-kept list, today `Mobile`), `host-vitals`. Content checks follow the
precedent the audit asked for: script body and profile payload hashes, policy and report SQL.

The nightly CLI checks: `appliedFiles()` lists every file the tier's apply passes (premium: the min
`default.yml` and `fleets/*.yml` plus the baseline `qa.yml` and `vms.yml`); `generate-gitops.spec.ts` gains
the new fleet. Workflows: the new fleet file in both premium apply lists, verify jobs for QA, VMs and the
new fleet in both passes, the instance concurrency group on the four apply workflows.

## 4. The surface, decided

Legend: **1** / **2** / **3** = batch; **—** = not declared, with the reason. "both" = both tiers.
The coverage-branch column says whether its example is the starting point.

### org_settings (both tiers unless noted)

| key | decision | note | coverage branch |
|---|---|---|---|
| `org_info` (all four) | **1** verify | `org_logo_url*` stay `""` (custom-logo skips otherwise) | — |
| `server_settings` (all documented keys) | **1** declare + verify | premium `enable_analytics: true` (item 5); `scripts_disabled`, `live_reporting_disabled`, `ai_features_disabled` stay `false` (specs need them); min changes nothing here — a forced key can't carry the delta, `report_cap` can (0 → 500) | yes |
| `features.enable_*` | **1** verify | — | — |
| `features.historical_data` | **1** declare `true`/`true` + verify | matches live on both tiers; never `false` | — |
| `features.additional_queries` | **1** both | reaches every host as an extra benign detail query (`SELECT * FROM time`), approved (§8); `features` is overwritten when present, so both configs carry the map and min drops one entry | — |
| `features.vulnerability_exposure_historical_reporting` | **2** premium | display-only filters; min changes `cvss_min` | — |
| `fleet_desktop` (3 keys) | **1** declare defaults + verify | the section is premium (`app.go:2081`, `appconfig.go:2071`): free declares and verifies the defaults; premium min changes `transparency_url`; `sso_enabled` is reset to false when omitted | — |
| `host_expiry_settings` | **1** verify | on, 1 day; `hosts.ts:365` relies on it; no min delta | — |
| `activity_expiry_settings` (3 keys) | **1** declare + verify | live `false`/30/`true`; min window 31 | yes |
| `webhook_settings` (interval + 4 webhooks) | **1** declare + verify | all `enable_*: false`, `https://example.com/…` URLs; **no `policy_ids`** (it conflicts with a policy's `webhooks_and_tickets_enabled`, and the policy-automations specs snapshot and restore the live list); min changes a URL path | yes |
| `mdm.windows_automatic_enrollment.default_fleet` | **2** premium | points Autopilot enrollments at the new fleet (hostless), never Workstations | — |
| `org_info.org_logo_path_*` (gitops-only logo upload) | **—** | a logo set makes `custom-logo.spec.ts` skip | — |
| `features.detail_query_overrides` | **—** | rewrites the detail queries every host runs | — |
| `gitops` (`gitops_mode_enabled`, `repository_url`) | **1** premium | `false` + the live URL (the gitops-mode specs read it, never write it); same in min | yes |
| `secrets` | free: already **1** verify via `GET /spec/enroll_secret`; premium **—** | excepted on premium | — |
| `sso_settings` (6 keys) | **1** verify all six | `metadata_url` compared to the env var | — |
| `mdm.end_user_authentication` | **1** premium verify | entity_id, idp_name, metadata_url | — |
| `mdm.apple_business_manager` | **1** premium verify | org name + the three fleet mappings | — |
| `mdm.volume_purchasing_program` | **1** premium verify | location + fleets | — |
| `mdm.apple_server_url`, `only_allow_apple_business_enrollment` | **—** | saving `server_url`/`apple_server_url` re-syncs DEP (author skill); declaring the live `""`/`false` adds nothing a verify can't read anyway | — |
| `mdm.end_user_license_agreement` | **3** | needs a hosted PDF; `automatic-enrollment.spec.ts` uploads and deletes the EULA → conflict to resolve first | — |
| `yara_rules` | **3** | `.yar` fixture exists on the branch; confirm what Fleet pushes to hosts before declaring on an instance with real hosts | yes (file) |
| `vulnerability_settings.databases_path` | **—** | server-local path; meaningless on Render | yes |
| `integrations.*`, `certificate_authorities`, `smtp_settings`, `conditional_access`, `microsoft_graph_credentials`, `apple_account_provisioning`, `google_workspace` | **—** | credentials the instances don't have; two specs assert no ticket integration | — |

### top-level

| key | decision | note | coverage branch |
|---|---|---|---|
| `agent_options` (existing content) | **1** verify | `GET /config → agent_options`, `GET /fleets/{id}` | — |
| `agent_options.command_line_flags`, `update_channels` | **2** on the new fleet only | reach real hosts anywhere else (channels change TUF) | yes |
| `custom_host_vitals` | **1** both | no license check anywhere in the code; three names, min two; omitting the key deletes all vitals, so both configs carry it; an apply fails if a vital is still referenced; `global` only (errors in a fleet file) | — |
| `labels` dynamic | already | — | — |
| `labels` manual (`hosts: []`) | **1** both | lib file; min drops it | yes |
| `labels` with `platform` | **1** both | one dynamic label with `platform: linux` | — |
| `labels` `host_vitals` (`criteria`) | **2** premium | `vital` is one of `end_user_idp_group`, `end_user_idp_department` (the EUA IdP is configured on premium only) or `custom_host_vital` + `custom_host_vital_id` (Fleet-assigned, so not portable YAML; usable once the vital exists and its id is pinned per instance) | — |
| fleet-scoped `labels` | **2** on the new fleet | needs the labels spec to count per scope | — |
| `controls.scripts` via `paths:` glob | **1** both (the two Linux scripts) | harness expands the glob; a new lib file would join silently — only there | — |
| `controls.android_enabled_and_configured` | **1** free declare + verify (live `true`), premium verify | a server no-op on PATCH (item 7b): the verify is a consistency check, not proof of an apply | — |
| premium `fleets/unassigned.yml` | **2** | the layout `generate-gitops` itself emits (the nightly spec already expects `fleets.has('unassigned')`): no-team `controls`, `policies`, `software` and `webhook_settings` move there from `default.yml` (`controls` may live in one of the two, never both). Lets premium declare Unassigned software (hash-pinned, wiped by cleanup after verify) and Unassigned webhooks. First check what `software/library.spec.ts:56,76` expects on Unassigned (Bear, ChatGPT): a `software:` key replaces Unassigned's software as a batch | — |
| `controls.windows_migration_enabled`, `enable_turn_on_windows_mdm_manually`, `apple_require_hardware_attestation` | **2** premium declare live `false` + verify | no min delta: flipping any reaches the Windows VMs' enrollment or DEP | yes |
| `controls.macos_migration` | **2** premium | `enable: false`, `mode`, `webhook_url`; `integrations/mdm.spec.ts` snapshots/restores it; min changes the URL | yes |
| `controls.windows_entra_*` | **—** | Entra tenant | — |

### the new fleet (premium, batch 2 unless noted)

| key | note |
|---|---|
| `settings.features` incl. `historical_data` | `true`/`true` |
| `settings.host_expiry_settings` | on, 30 days; min 31 |
| `settings.webhook_settings`: `failing_policies_webhook`, `host_status_webhook`, `host_activities_webhook` | disabled, example URLs; min changes a path |
| `agent_options` with `command_line_flags`, `update_channels` | the only place these are declared |
| `apple_settings.enable_disk_encryption`, `enable_escrow_disk_encryption_key` | min turns escrow off |
| `windows_settings.enable_disk_encryption`, `require_bitlocker_pin`, `enable_managed_local_account` | min turns the PIN off |
| `setup_experience.enable_managed_local_account`, `end_user_local_account_type` | the keys the code has (the docs' `apple_settings.managed_local_account_settings` doesn't exist — item 7b); min flips the account type |
| `linux_settings.enable_escrow_disk_encryption_key` | — |
| `enable_recovery_lock_password` | min off |
| `macos_updates` (3 keys), `ios_updates`, `ipados_updates`, `windows_updates` | min moves one deadline and one version |
| `name_template` | `$FLEET_VAR_HOST_HARDWARE_SERIAL`-based; renames via MDM, nothing to rename |
| `apple_settings.configuration_profiles` with `labels_include_all` / `labels_include_any` / `labels_exclude_any` | the existing inert `.mobileconfig`s, scoped to gitops labels; min drops one |
| `windows_settings.configuration_profiles` with label scoping; `android_settings.configuration_profiles` | same |
| DDM `.json` declaration, `assets/` | **3** — a new payload type, approval first (author skill) |
| `scripts` via `paths:` | `.sh` + `.ps1` + `.py` |
| `setup_experience`: `enable_end_user_authentication` (the IdP is configured), `lock_end_user_info` (requires EUA on), `apple_enable_release_device_manually`, `require_all_software_macos`, `require_all_software_windows`, `macos_script` | all apply with Apple MDM on and no ADE host; min flips a boolean |
| `setup_experience.bootstrap_package` (+ `macos_manual_agent_install`, which requires one), `apple_setup_assistant` | **3** — need a signed `.pkg` URL and an ADE JSON fixture; the setup assistant needs the ABM token, which premium has |
| `apple_settings.assets[]` (DDM assets) | **3** — with the DDM declaration |
| `software.packages` by `hash_sha256` (the four inert fixtures) with `install_script`, `uninstall_script`, `post_install_script`, `pre_install_query`, `self_service`, `categories`, `labels_exclude_any`, `display_name`, `icon` | zero download. `url`/`hash`/`install_script` live only in a package `.yml`, so each gets a second `lib/…/*.compliance.package.yml` beside the VMs one, same hash, more options; `paths:` isn't supported for packages; icon is a 128 px PNG fixture |
| `software.packages` script-only (`.sh`, `.ps1`) | — |
| `software.packages` two versions of one title | **3** — needs a second inert build |
| `software.fleet_maintained_apps` (Itsycal, DB Browser) with `self_service`, `categories`, `labels_include_any`, `pre_install_query`, `post_install_script`, `display_name`, caret `version` | min changes the caret |
| `software.app_store_apps` (VPP: Bear; Android: ChatGPT) | **3** — fleetdm/fleet#54013 (an unavailable app halts the apply) and #54625; gate behind its own apply step or accept the risk |
| `policies` with `critical`, `labels_include_any` / `exclude_any`, `install_software` by `package_path`, `hash_sha256` and slug, `run_script`, `resend_configuration_profile`, `continuous_automations_enabled`, `webhooks_and_tickets_enabled` (with this fleet's `failing_policies_webhook`), `type: patch` (+ `install_software`, `patch_when_closed`; `notify_before_patching` on a second patch policy, since the two can't combine) | every automation is fleet-only (`gitops.go:2229-2300`, `global_policies.go:478-497`) and references something declared in this file; min removes one automation |
| `policies` with `calendar_events_enabled`, `conditional_access_enabled` | **—** — Google Calendar / Entra |
| `reports` with every option and `labels_include_any` | — |

### Workstations, QA, VMs, free's and premium's default.yml

| item | batch | note |
|---|---|---|
| verify QA's and VMs' content (software, policies incl. automations, the report's fields) | **1** | both passes |
| premium global: one `critical` policy, one label-scoped policy, one label-scoped report | **1** | the only premium policy keys a global policy may carry; wiped by cleanup after verify, like the rest |
| both tiers: one report with every option set non-default (`interval`, `logging: differential_ignore_removals`, `discard_data`, `observer_can_run`, `automations_enabled`, `min_osquery_version`) | **1** | runs hourly on every host like the other 30; benign SQL |
| both tiers: one policy with every base key | **1** | — |
| Workstations: anything new | **—** | stays the realistic employee fleet; its content is wiped daily anyway |

## 5. The batches

**Batch 1 — quick wins.** No new fleet, fixture, env var or approval; every change is verify-side or a
value the instance already holds. Harness v2 (§3.4) with the six specs rewritten and the audit's quick wins;
verify jobs for `qa.yml` and `vms.yml` in both passes and the idempotence check over every applied file; the
`settings`, `software`, `fleets` and `host-vitals` specs; the batch-1 rows of §4 declared on both tiers with
their min deltas; `enable_analytics` corrected; the instance concurrency group on the apply workflows; the
stale text of item 13; `docs/test-audit/16-gitops-verify.md`, its README index, `playwright/README.md`'s
preconditions, the gitops READMEs. Verified by a dry-run of both tiers' baseline and min configs against the
instances (read-only, and remembering item 7b: it proves nothing about the new policies, reports and labels),
the verify project run locally against each target, and then Andrey's branch run (`--ref`, since workflows
change), whose real apply is the proof.

**Batch 2 — the fleet.** `fleets/compliance.yml` in both directories, the `controls` verify spec and the
label-scoping, software-option, automation and fleet-settings assertions, workflows, `generate-gitops` and
`fleets` expectations, the §4 batch-2 rows at global scope. The first apply creates the fleet; a dry-run
on the playground (`--context default`, premium, 4.93 RC) first, then the branch run.

**Batch 3 — needs a decision or a fixture.** DDM declaration (new payload type), bootstrap package and ADE
JSON, a second inert package version, VPP and Android `app_store_apps`, EULA, `yara_rules`. Each is
decided with Andrey one at a time.

Each batch: one concern per commit, docs in the same commit, `playwright-test-reviewer` on the diff, PR,
branch run.

## 6. Hazards each batch holds to

- Nothing new reaches a real host: no profile, disk/OS setting or agent-options change at global or
  Unassigned scope on either tier, nothing on VMs beyond what `vms.yml` already declares, nothing on
  Workstations that §2.2 asserts absent.
- No `secrets:` on premium; no `integrations`; `org_logo_url*` stay empty; `historical_data` never `false`;
  `scripts_disabled` / `live_reporting_disabled` / `ai_features_disabled` never `true`; SSO stays on as Okta;
  host expiry stays on at 1 day; the VPP token stays on all fleets.
- Never *omit* what a file declares today: `mdm.apple_business`, `volume_purchasing_program`,
  `end_user_authentication`, `sso_settings`, `windows_enabled_and_configured`, `features`, every file's
  `agent_options`, every fleet file's `controls` (item 7b). A min variant changes values; it never drops a
  section.
- "Collect default browser on macOS" (with `observer_can_run`), "Debian-based Linux hosts", Postman on QA and
  every `vms.yml` fixture keep their names and fields in both configs. No gitops label is ever renamed
  (rename = delete + create, membership reset).
- No `pw-*` name on anything durable. No `version:` pin on QA or VMs.
- New `$VARS` need five workflow files, both `.env.*.example` files and a repo secret: prefer literals.
- Every package by `hash_sha256` of a file already in storage, or an FMA small enough for the 2 GB box.
- `custom_host_vitals` is only ever edited with its referencing labels/scripts/profiles in mind.

## 7. Pre-existing findings for Andrey (not changed by this plan)

1. Free's nightly apply delivers 23 profiles to the free real VMs (item 3), including a `com.apple.loginwindow`
   payload. They have been applied nightly since the config existed without incident, but the author skill
   lists login-window restrictions among the things to stop and ask about. Decide whether free's `controls`
   should shrink to scripts only, or the profiles be re-approved as a set.
2. ABM's default fleet for macOS/iOS/iPadOS is Workstations, which half a dozen specs require to stay
   hostless. An automated enrollment would break them. **Decided (§8): batch 2 points
   `mdm.apple_business_manager.{macos,ios,ipados}_fleet` at Compliance** once the fleet exists — ABM isn't used
   on this instance beyond being configured, and the two specs that need it (`automatic-enrollment.spec.ts`,
   `integrations/mdm.spec.ts`) need the token present, not a particular default fleet (checked during batch 2).
3. A manual dispatch of an apply workflow isn't locked out of a running suite (item 12). Batch 1 fixes it.
4. The instances don't rest on min between nights (item 13). Batch 1 corrects the two docs that say so.
5. Fleet docs/code mismatches worth filing (item 7b): the three `managed_local_account` keys and
   `setup_experience.require_all_software` that the docs list and the code lacks; `yara_rules[].path` likely
   failing key validation; `controls.android_enabled_and_configured` documented as turning Android MDM on while
   the server ignores it; `lock_end_user_info`'s documented default (`true`) versus the code's (follows EUA).
   Each is a dry-run on the playground away from confirmed.

## 9. Batch 1 — what landed (2026-10-08)

**Harness v2** (`playwright/helpers/gitops-yaml.ts`, `tests/api/gitops-verify/`, 10 specs / 30 tests, audit
area 16 rewritten): the loader reads `path:`, `paths:` globs and inline entities alike, each entity's option
fields, `org_settings` / fleet `settings`, `agent_options`, the `controls` flags, `software` (through the
package files) and `custom_host_vitals`, expands `$VAR`s like fleetctl and throws on an unset one;
`GITOPS_TARGET` must belong to `SUITE`'s tier; every list is paginated and every non-2xx throws. Two
comparisons carry the specs: `expectExactNames` (missing *and* extra, then the count) and `expectSubset`
(declared keys only). New: `settings` (org: org_info, server_settings, features, fleet_desktop, expiry,
webhooks, gitops, SSO, EUA/ABM/VPP, the controls flags, agent options, free's enroll secrets; fleet: features,
host expiry, webhooks, integrations, agent options), `software` (packages by filename then hash and options
and script bodies; Fleet-maintained apps by slug — through the title's `fleet_maintained_app_id`, not the
catalog's `software_title_id`, which Fleet also sets on a custom upload of the same app; App Store apps),
`fleets` (the standing set = both variants' fleet files ∪ Mobile), `host-vitals`, `_sanity`; label, policy,
report, script and profile specs compare every declared field, script and profile bodies included.

**Declared on both tiers** (§4's batch-1 rows): `server_settings` (premium `enable_analytics: true`),
`features.additional_queries` + `historical_data`, all of `fleet_desktop`, `activity_expiry_settings`, the
four `webhook_settings` (no `policy_ids`), premium's `gitops` block, free's `android_enabled_and_configured`,
`custom_host_vitals` (3 / min 2), the manual **Pilot hosts** label and a `platform: linux` one, an inline
policy with every base key (+ a `critical`, label-scoped one on premium), an inline report with every option
(+ a label-scoped one on premium), the Linux scripts as one `paths:` glob, the non-deprecated logo keys. Every
new section has a changed value in the min variant.

**CI**: QA and VMs verified after both premium applies (`label` input on `gitops-verify.yml` keeps the two
artifacts apart); the verify workflow passes the interpolation vars; the idempotence dry-run covers the
baseline `qa.yml` / `vms.yml` the min apply carries; the four apply workflows take the instance lock when
dispatched by hand (`caller` input). Docs: the gitops READMEs, `CLAUDE.md`'s CI facts, `ci-pipeline.md`,
`helpers/README.md`, two `npm run test:gitops-verify:premium-{qa,vms}` scripts.

**Found and fixed on the way:** `deleteAllGlobalPolicies` called `GET /global/policies`, which Fleet
answers 404, and swallowed it — the global policies were never wiped on either tier (22 survived every
cleanup; `policy-host-counts.spec.ts:9` and `pickers.spec.ts:15` describe the intended state, which is
now the real one). It calls `GET /policies` and fails loud.

**Verified:** `npm run check` clean; dry-runs of all four configs against the instances (4.92.1 client; the
local `fleetctl@4.93.0` install is blocked by an npm `before` pin on this machine, CI installs 4.93.0);
`gitops-verify` against the live VMs and QA fleets, 20/20 each; against the live min no-team config, 17 pass
and the 4 failures are the three wiped kinds plus `enable_analytics`, which the YAML now corrects. **Not yet
proven:** the script-body and profile-payload comparisons (GV-16, GV-12) against an applied instance — the
cleanup had wiped every script and profile, and a local apply was declined as a blind write to the shared
instances. The branch run is their proof; if Fleet normalizes a served payload, the comparison moves to a
checksum.

## 8. Decisions (Andrey, 2026-10-08)

1. The fleet is **Compliance**; a fifth standing fleet is fine.
2. Benign settings that reach hosts are fine: free carries `custom_host_vitals` and both tiers carry
   `features.additional_queries`.
3. `playwright/gitops-coverage` is deleted once batch 2 has harvested it.
4. ABM's default fleets move to Compliance in batch 2 (§7.2). §7.1 (free's profiles on the free VMs) is still
   open; nothing in the batches changes it.
5. Docs move with every slice: the per-key table here, `docs/test-audit/16-gitops-verify.md` and the audit
   index, the gitops READMEs, `playwright/README.md`'s preconditions, `CLAUDE.md`'s CI facts.
