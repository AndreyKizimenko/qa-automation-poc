# Settings & Integrations — test cases

> Feature area. Effective regression set curated from Fleet feature-story test
> plans (audited: deduped across former product groups; cosmetic/low-value checks
> pruned). Each case keeps its origin story #s in **Source**. See
> [`README.md`](README.md) for conventions; GitOps flows live in [`gitops.md`](gitops.md).

## Agent options & fleetd configuration

### SETTINGS-001 — Custom extension deploys only to hosts matching all configured labels

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium license active. At least two enrolled hosts; one host has all of a chosen set of labels, another is missing at least one. An agent-options configuration that targets a custom extension to that set of labels is prepared.
- **Source:** #13287

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Apply an agent-options configuration that includes an `extensions` block targeting a label-scoped extension to the set of labels. | Configuration is accepted and saved. |
| 2 | Refetch / wait for the host that has ALL listed labels. | The extension is deployed to that host and its tables/queries become available. |
| 3 | Check the host that is missing at least one of the labels. | The extension is NOT deployed to that host. |
| 4 | Apply a configuration whose extension targets a non-existent label. | Application fails with a clear error and the configuration is rejected. |
| 5 | Apply a configuration where label names differ only in case from existing labels. | The extension still deploys successfully (label matching is case-insensitive). |
| 6 | Remove the active license key (downgrade to Free) and re-check. | Label-targeted extension deployment no longer applies (feature gated to Premium). |

### SETTINGS-002 — fleetd update channels are remotely configured via agent options

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Enrolled fleetd hosts on macOS, Windows, and Linux pointed at a TUF update server that has multiple channels available. Fleet Desktop both disabled and enabled across the host set (prioritize a host without Fleet Desktop).
- **Source:** #13825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | In agent options, set the `update_channels` for the fleetd components (e.g. orbit, osqueryd, desktop) to specific channels and save. | Configuration is accepted. |
| 2 | Refetch / let each host (macOS, Windows, Linux) pick up the new agent options. | Each host switches to the version published on its configured channel for each component. |
| 3 | Verify on a host running WITHOUT Fleet Desktop. | orbit and osqueryd update to the configured channels and the host stays enrolled and reporting. |
| 4 | Verify on a host running WITH Fleet Desktop. | The desktop component also moves to its configured channel without breaking enrollment. |
| 5 | Change a channel value and re-apply. | Hosts move to the newly specified channel on the next update cycle. |

### SETTINGS-003 — Chrome extension and settings follow organizational unit (OU) overrides

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Google Admin console access with root-level Chrome device settings configured; a Chromebook available to enroll; a separate OU created with settings/extensions that differ from root.
- **Source:** #13886

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure root-level Chrome device settings and the Fleet Chrome extension at the root OU. | Root-level configuration saved in the Google Admin console. |
| 2 | Enroll a Chromebook at the root level. | The Chromebook appears in Fleet and the root-level settings/extension apply correctly. |
| 3 | Create a new OU with settings and extensions different from the root level. | OU-level configuration saved. |
| 4 | Move/enroll the Chromebook into the new OU. | The Chromebook picks up the OU-level configuration. |
| 5 | Compare applied settings/extension against root vs OU values. | The OU-level settings and extensions override the root-level values for that device. |

### SETTINGS-004 — Agent options accept the `vmodule` command line flag

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance with at least one host enrolled. `fleetctl` and a GitOps YAML setup available. API access for the config endpoint.
- **Source:** #25838

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Organization settings > Agent options, add `vmodule` under `command_line_flags`, and click Save | Agent options save successfully without a validation error |
| 2 | Add `vmodule` under `command_line_flags` in `agent-options.yml` and run `fleetctl apply -f agent-options.yml` | Agent options update successfully |
| 3 | Add `vmodule` under `agent_options` > `command_line_flags` in the GitOps YAML and run `fleetctl gitops` | The flag applies successfully |
| 4 | Send `PATCH /api/latest/fleet/config` adding `vmodule` under `command_line_flags` | The request succeeds and the flag is persisted |
| 5 | Set `vmodule=init=1` on a host, then inspect the fleetd/osquery logs | Additional osquery log output appears, confirming the flag took effect |

## MDM & server URL configuration

### SETTINGS-005 — Restrict Apple MDM traffic to a custom `apple_server_url`

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** macOS, iOS/iPadOS
- **Preconditions:** Fleet (Premium) with Apple MDM configured; ability to set `mdm.apple_server_url`; two ngrok tunnels pointing distinct public URLs at the same local Fleet instance; an Apple host available to enroll.
- **Source:** #22039, #22267

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set the `mdm.apple_server_url` config to one of the two tunnel URLs via GitOps, `fleetctl apply`, or the environment variable. | The custom Apple MDM server URL is accepted and applied. |
| 2 | Enroll an Apple (macOS/iOS/iPadOS) host into Fleet MDM. | The host enrolls successfully using the configured URL. |
| 3 | Exercise various MDM functionality on the enrolled host while monitoring traffic across both tunnel URLs. | All `/mdm/*` traffic is sent only to the configured `apple_server_url`; the second tunnel URL receives no MDM traffic. |

## Calendar integration & maintenance windows

### SETTINGS-006 — Calendar event is rescheduled when an already-scheduled slot is moved

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled and a host failing a calendar policy already has a maintenance window event on the end user's calendar.
- **Source:** #17230

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Move the existing maintenance window event to a different time on the end user's calendar. | The event reflects the moved time. |
| 2 | Trigger the calendar cron job. | Fleet detects the moved slot and the maintenance window is addressed/honored at the new time rather than duplicated. |

### SETTINGS-007 — Calendar events scale to many hosts firing on the same window

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Load-test environment with calendar integration enabled, a Google Calendar environment with many users, and up to 20,000 hosts failing the same calendar policy scheduled to fire at the same time with a webhook configured.
- **Preconditions:** A failing-policy webhook is configured.
- **Source:** #17230, #19280, #19352

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Drive 20,000 hosts to report the failing calendar policy and schedule calendar events at the same time. | Maintenance window events are created across the calendar users without errors. |
| 2 | Let the webhook fire for all 20,000 hosts at the scheduled window. | The webhook fires for every host with the correct payload. |
| 3 | Monitor other Fleet cron jobs and database access during the run. | No harm is done to other jobs or DB access; the feature works correctly at scale. |

### SETTINGS-008 — Generate an AI policy-remediation description for a calendar event

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled. AI features are enabled (`ai_features_disabled` is false). A calendar-enabled policy exists. Signed in as a global admin (repeat as a team maintainer).
- **Source:** #18187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open a calendar-enabled policy in the Fleet UI as a global admin and invoke the AI-generated description for policy remediation. | An AI-generated remediation description is produced for the policy. |
| 2 | Repeat step 1 as a team maintainer on a team policy. | The AI generation is available and works for the team maintainer role. |
| 3 | Drive a host to fail the policy and let a calendar event be created. | The created event's body uses the generated description/resolution content. |

### SETTINGS-009 — Calendar event body adapts to per-policy description and resolution content

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled with calendar-enabled policies. A host is failing the relevant policies.
- **Source:** #18187

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Drive a host to fail two calendar policies, then create the calendar event. | The event body covers both failing policies. |
| 2 | Configure one failing policy with a filled-in description and resolution, create the event. | The event body shows the provided description and resolution. |
| 3 | Configure one failing policy with an empty description (resolution filled), create the event. | The event renders correctly with the missing description handled (no broken/blank body). |
| 4 | Configure one failing policy with an empty resolution (description filled), create the event. | The event renders correctly with the missing resolution handled. |
| 5 | Configure one failing policy with both description and resolution empty, create the event. | The event still renders correctly with sensible fallback content. |

### SETTINGS-010 — Maintenance window events are scheduled on the next Tuesday

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled on a team and a calendar-enabled policy exists. A host on that team is failing the policy.
- **Source:** #19031

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With a host failing the calendar policy, trigger the calendar cron job to create maintenance window events. | A calendar event is created for the host. |
| 2 | Inspect the date of the created event on the end user's calendar. | The event is scheduled on the next Tuesday. |

### SETTINGS-011 — Existing maintenance window event updates when policy description/resolution changes

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled and a host failing a calendar policy already has a maintenance window event whose body reflects the current policy description/resolution.
- **Source:** #19280

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Change the policy description/resolution from populated to blank, then let the calendar cron job run. | The existing event's body updates to reflect the now-blank description/resolution. |
| 2 | Change the policy description/resolution from blank back to populated, then run the cron job. | The existing event's body updates to show the populated content. |
| 3 | Change the policy description/resolution to different non-empty text, then run the cron job. | The existing event's body updates to the new text. |
| 4 | Make the host go from failing 1 calendar policy to failing 2 (and back), then run the cron job. | The event body updates to reflect the change in the number of failing policies in both directions. |

### SETTINGS-012 — Deleted or past-dated maintenance window events are recreated

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Calendar integration is enabled (with `FLEET_GOOGLE_CALENDAR_PLUS_ADDRESSING`) and hosts failing calendar policies already have maintenance window events scheduled.
- **Source:** #19352

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Move all calendar events to a past time (e.g. using `move-events.go`). | On the next processing cycle, the stale past events are recreated at a valid future slot. |
| 2 | Delete all calendar events (e.g. using `delete-events.go`). | The deleted events are recreated for the still-failing hosts. |
| 3 | Repeat the move/delete actions and simultaneously trigger the calendar cron job (setting event `updated_at` >30 minutes but <1 day earlier to force a refetch). | Events are reconciled and recreated correctly without duplication or loss despite the concurrent cron run. |
| 4 | Move all calendar events to the current time. | Webhooks fire for the affected hosts within roughly the next 5 minutes. |

### SETTINGS-013 — Maintenance window creation/recreation frequency is controlled by environment variables

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** A Fleet server where the maintenance window calendar refresh frequency environment variables can be set, with calendar integration enabled.
- **Source:** #19491

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start Fleet without setting the maintenance window frequency environment variables. | The default creation/recreation (calendar refresh) frequency values are in effect. |
| 2 | Confirm the calendar refresh timing against the documented defaults. | The observed refresh cadence matches the default values. |
| 3 | Set the frequency environment variables to custom values and restart Fleet. | Fleet starts and accepts the configured values. |
| 4 | Confirm the calendar refresh timing after setting the variables. | The calendar refresh cadence reflects the new environment variable values. |

### SETTINGS-014 — Use Username (IdP) email for maintenance-window calendar scheduling

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** macOS | Windows | Linux
- **Preconditions:** Premium Fleet instance with calendar integration configured and end-user authentication enabled using Google Workspace as IdP; hosts in teams and in "No team", including some hosts with no associated email.
- **Source:** #37249

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With calendar integration and Google Workspace end-user auth enabled, trigger maintenance-window scheduling for a host that has an IdP email. | The calendar event is scheduled using the host's Username (IdP) email. |
| 2 | Repeat for macOS (with and without MDM), Linux, and Windows hosts in teams and in "No team". | Scheduling uses the IdP email across all platforms and team contexts. |
| 3 | Trigger scheduling for hosts with no associated email. | These hosts are filtered out correctly with no errors. |

## Fleets / teams rename

### SETTINGS-015 — Existing `teams` continue to work after the Fleets rename

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance with one or more pre-existing `teams` defined before the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Open Fleet and locate the previously created `teams`. | The existing `teams` are present and unchanged. |
| 2 | Exercise each existing `teams` as before the rename. | Each `teams` behaves identically to its pre-rename behavior, confirming backward compatibility. |

### SETTINGS-016 — New `fleets` provide full functionality

- **Tier:** Premium
- **Priority:** P0
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Create a new `fleets` entity. | The `fleets` entity is created successfully. |
| 2 | Use the full set of `fleets` capabilities (create, view, edit, delete). | Every `fleets` capability functions correctly end to end. |

### SETTINGS-017 — API is consistent for `fleets`

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename with API access.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Call the API endpoints covering `fleets` (and legacy `teams`). | The API responds consistently for `fleets` and maintains backward compatibility for `teams`. |

### SETTINGS-018 — Reserved names are enforced for `fleets`

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Attempt to create a `fleets` entity using a reserved name. | The reserved name is rejected according to the rename's reserved-name rules. |

### SETTINGS-019 — Logging, multipart, streaming, and activity reflect the Fleets rename

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A Premium Fleet instance on the build containing the Fleets rename with logging, multipart, streaming, and activity feeds available.
- **Source:** #39314

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Trigger activity that produces logs, multipart requests, streamed output, and activity-feed entries related to `fleets`. | Logging, multipart, streaming, and activity behavior are all correct for `fleets`. |

## Server deployment & storage configuration

### SETTINGS-020 — Authenticate to RDS MySQL and ElastiCache Redis via AWS IAM

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet deployed in AWS with reachable RDS (MySQL) and ElastiCache (Redis) instances; IAM roles configured so the Fleet host can request IAM auth tokens.
- **Source:** #1817

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Set `mysql_address` to the RDS endpoint and `mysql_region`, leaving `mysql_password` and `mysql_password_path` unset; start Fleet. | Fleet connects to MySQL using IAM authentication. |
| 2 | Additionally set `mysql_sts_assume_role_arn` (first without, then with `mysql_sts_external_id`); save some queries each time. | Queries save successfully in both assume-role scenarios. |
| 3 | Set `redis_address` to the ElastiCache endpoint with `redis_cache_name` and `redis_region`, leaving `redis_password` unset; start Fleet. | Fleet connects to Redis using IAM authentication. |
| 4 | Additionally set `redis_sts_assume_role_arn` (first without, then with `redis_sts_external_id`); run live queries each time. | Live queries run successfully in both assume-role scenarios. |
| 5 | For both MySQL and Redis, set username and password alongside the AWS config. | Basic auth is used regardless of the other AWS-specific config. |

### SETTINGS-021 — Migrate Fleet database from MySQL to MariaDB 11.4

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance on Oracle MySQL Community 8.0.32 with ~900 Linux hosts enrolled and data replicating a representative production instance; ability to migrate the DB and repoint Fleet config.
- **Source:** #31288

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Migrate the MySQL 8.0.32 database to a MariaDB 11.4 database. | Data migrates without loss. |
| 2 | Update the Fleet server config to point to MariaDB, then upgrade Fleet to the MariaDB-supporting version. | The upgrade completes successfully against MariaDB. |
| 3 | Run the full smoke-test suite against the MariaDB-backed instance. | All Fleet features work as expected. |

### SETTINGS-022 — Read Fleet server private key from AWS Secrets Manager

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance in AWS; the server private key stored in AWS Secrets Manager; IAM access for the `server_private_key_arn` options.
- **Source:** #31321

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure `server_private_key_arn` (with optional `server_private_key_sts_assume_role_arn` / `server_private_key_sts_external_id`) and start Fleet. | Fleet uses the private key fetched from Secrets Manager. |
| 2 | Confirm Fleet operates using the Secrets Manager key. | Fleet functions correctly with the externally-stored key. |
| 3 | Set both `server_private_key` and `server_private_key_arn` at the same time. | An informative error is shown stating only one can be set at a time. |

### SETTINGS-023 — Gzip-compress large API responses without breaking agent communication

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet instance with the gzip-compression flag toggleable; an enrolled host running osqueryd >= 5.21.0 / Orbit >= 1.52.0 with the agent flag on; browser devtools access.
- **Source:** #37944

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With the flag enabled, inspect an API request over 1KB (e.g. the hosts API) in browser devtools, then disable the flag and repeat. | The response is gzipped when the flag is enabled and not gzipped when disabled. |
| 2 | With the flag enabled, run a live query against the host. | osqueryd communication still works. |
| 3 | With the flag enabled, run a script on the host. | Orbit communication still works. |

### SETTINGS-024 — Software installer upload/download works with GCS IAM authentication

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet server started with `s3_software_installers_gcs_iam_auth=true`, `s3_software_installers_endpoint_url=https://storage.googleapis.com`, a configured GCS bucket, valid ADC credentials in the runtime environment, and no HMAC keys set. (Server-config only; no UI changes. Reference baseline: PR #40374, env test-gcp-gcs.dogfood.fleetdm.com.)
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Boot the Fleet server with the GCS IAM auth configuration above. | The server starts successfully. |
| 2 | Upload a `.pkg` software installer to Fleet. | The upload completes and is stored in GCS. |
| 3 | Download the same installer back from Fleet. | The download succeeds end-to-end. |
| 4 | Run a long-running upload that crosses the ADC token TTL boundary. | Token refresh occurs and the upload still completes successfully. |
| 5 | Boot with `s3_software_installers_force_s3_path_style=true` together with `gcs_iam_auth=true`, then upload and download. | Path-style addressing works for software installers. |

### SETTINGS-025 — Fleet refuses to start on invalid GCS IAM auth configuration

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Ability to boot the Fleet server with custom config flags for software installers and carves.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start the server with `s3_software_installers_gcs_iam_auth=true` combined with any of `s3_software_installers_access_key_id`, `s3_software_installers_secret_access_key`, or `s3_software_installers_sts_assume_role_arn`. | The server fails to start with a clear, actionable error. |
| 2 | Start with `s3_software_installers_gcs_iam_auth=true` but with `s3_software_installers_endpoint_url` empty or not pointing at storage.googleapis.com (e.g. https://s3.amazonaws.com). | The server fails to start with a clear, actionable error rejecting the non-GCS host. |
| 3 | Repeat the equivalent invalid combinations for `s3_carves_gcs_iam_auth` (HMAC/STS keys present, or endpoint empty/non-GCS). | The server fails to start with a clear, actionable error in each carves case. |
| 4 | Start with `gcs_iam_auth=true` but no ADC credentials present in the runtime environment. | A clean, actionable error is returned (no panic and no silent fallback to anonymous credentials). |

### SETTINGS-026 — Existing S3/HMAC and CloudFront paths still work with GCS IAM auth off

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Fleet server configurable for AWS S3 with HMAC keys and CloudFront signing for software installers and carves.
- **Source:** #44861

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Boot with `s3_software_installers_gcs_iam_auth=false` (or unset) using HMAC keys and AWS S3, then upload and download an installer. | The existing HMAC + AWS S3 path for software installers still works. |
| 2 | With the CloudFront signing path configured alongside `s3_software_installers_gcs_iam_auth=false`, exercise a download. | CloudFront signing is unaffected and continues to work. |
| 3 | Boot with `s3_carves_gcs_iam_auth=false` (or unset) using HMAC keys and AWS S3, then upload and download a carve. | The existing HMAC + AWS S3 path for carves still works. |

## Organization settings & integrations

### SETTINGS-027 — Fleet server URL validation allows HTTP and HTTPS

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Fleet instance with admin access to organization settings where the Fleet server URL is configured.
- **Source:** #27454

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Configure an HTTP Fleet server URL and save. | The HTTP URL is accepted (validation allows it). |
| 2 | Configure an HTTPS Fleet server URL and save. | The HTTPS URL is still accepted; no regression in this UI area. |

### SETTINGS-028 — Save and Edit nav move SSO and host status webhook to Integrations

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Logged in as a global admin; on the Settings area.
- **Source:** #25798

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Navigate to **Settings > Organization settings**. | The nav does not list **Single sign-on options** or **Host status webhook**. |
| 2 | Navigate to **Settings > Integrations**. | The nav lists both **Single sign-on options** and **Host status webhook**. |
| 3 | In the URL bar go directly to `/settings/organization/sso`. | The page redirects to `/settings/integrations/sso`. |
| 4 | In the URL bar go directly to `/settings/organization/host-status-webhook`. | The page redirects to `/settings/integrations/host-status-webhook`. |
| 5 | Open **Settings > Integrations > Single sign-on options**, edit a field, and save. | The SSO settings save successfully. |
| 6 | Open **Settings > Integrations > Host status webhook**, edit a field, and save. | The host status webhook settings save successfully. |

## Usage statistics

### SETTINGS-029 — Disable usage statistics via server config

- **Tier:** Both
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Ability to start a Fleet server with custom config; admin access to Settings.
- **Source:** #28220

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Start Fleet with `FLEET_LICENSE_ENABLE_ANALYTICS=false`. | Server starts with usage statistics disabled by config. |
| 2 | Go to Settings > Usage statistics. | The "Enable usage statistics" checkbox is unchecked and disabled. |
| 3 | Observe outgoing telemetry. | No usage statistics are sent. |

### SETTINGS-030 — Surface Fleet-maintained apps in usage statistics

- **Tier:** Both
- **Priority:** P2
- **Platforms:** macOS | Windows
- **Preconditions:** Fleet instance with the ability to add and remove Fleet-maintained apps on teams and to inspect usage statistics.
- **Source:** #39372

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Add macOS and Windows Fleet-maintained apps to teams. | The added apps are listed in usage statistics. |
| 2 | Remove all macOS and Windows Fleet-maintained apps. | The usage-statistics lists update to reflect the removals. |

### SETTINGS-031 — Usage statistics Save button disabled for Fleet Premium

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Logged in as admin on a Fleet Premium instance without the `allow_disable_telemetry` config set.
- **Source:** #34126

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Go to Settings > Usage statistics | The "Learn more" link is rendered inline within the paragraph (not on its own line) |
| 2 | Inspect the Save button | The Save button is disabled |

## Teams & Primo configuration

### SETTINGS-032 — Turn off teams in Fleet Premium via Primo config

- **Tier:** Premium
- **Priority:** P2
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with no teams set up; ability to toggle the `FLEET_PARTNERSHIPS_ENABLE_PRIMO` server config; admin access.
- **Source:** #28221

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Enable `FLEET_PARTNERSHIPS_ENABLE_PRIMO` and visit each top-level page. | Static headings appear instead of the teams dropdown. |
| 2 | Go to Settings > Teams. | Empty state is shown; the add-team button is disabled with a tooltip. |
| 3 | In Settings > Users, click "Add user" and edit a user. | Team-assignment radio buttons are disabled with a tooltip in both flows. |
| 4 | Disable Primo, add a team in Settings > Teams, and revisit top-level pages. | Team adds successfully and the teams dropdown reappears. |
| 5 | Re-check Settings > Users: add a user and assign an existing user to the team. | Team assignment is available again and the user saves to the team. |
| 6 | Re-enable Primo, then open the team-assigned user. | The radio pre-selects global; saving converts the user back to global. |

## Moved in (review placement)

### SETTINGS-033 — Search and filter the team dropdown by typing

- **Tier:** Premium
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** Premium Fleet instance with several teams; admin access on a page that shows the teams dropdown.
- **Source:** #28822

| # | Step | Expected result |
|---|------|-----------------|
| 1 | Click into the teams dropdown. | The current team name stays visible and focus styling matches Figma. |
| 2 | Type a known team name. | Typed text replaces the selection, options filter to matches, and the dropdown arrow hugs the text. |
| 3 | Type a long string of random characters. | The "no matches" empty state shows and text scrolls horizontally without overflowing the container. |
| 4 | Click outside the dropdown. | The selection reverts to the original team. |
| 5 | Type a known team name again and select a team from the filtered list. | The team is selected with no regressions. |

## General

### SETTINGS-034 — Release binaries and images carry valid GitHub attestation

- **Tier:** Both
- **Priority:** P1
- **Platforms:** All
- **Preconditions:** A completed Fleet/fleetd release whose build workflows produce binaries and container images with GitHub attestation enabled. `gh` CLI authenticated.
- **Source:** #23825

| # | Step | Expected result |
|---|------|-----------------|
| 1 | For each binary produced by the release workflows, run `gh attestation verify <artifact> --repo fleetdm/fleet` | Each binary passes verification with a valid attestation |
| 2 | For each container image produced by the release workflows, run `gh attestation verify oci://<image> --repo fleetdm/fleet` | Each image passes verification with a valid attestation |
| 3 | Review the workflow output to confirm every generated artifact and image is covered | No release binary or image is missing attestation |

### SETTINGS-035 — Fleet Desktop opens correctly under Wayland on Linux

- **Tier:** Both
- **Priority:** P1
- **Platforms:** Linux
- **Preconditions:** A Linux host running a Wayland default display server, enrolled to Fleet with Fleet Desktop. fleetd built from source via the local TUF test instructions.
- **Source:** #26179

| # | Step | Expected result |
|---|------|-----------------|
| 1 | On the Wayland Linux host, confirm the Fleet Desktop tray icon appears | The Fleet Desktop icon is visible in the system tray |
| 2 | Click the Fleet icon and select My device | The My device page opens in the browser |
| 3 | From the Fleet icon, select Self-service and About Fleet | Each option opens its corresponding page successfully under Wayland |

### SETTINGS-036 — Fleet Desktop auto-opens the default browser on Linux

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux workstation (Ubuntu, Kubuntu, or Fedora) enrolled to Fleet with Fleet Desktop installed. Microsoft Edge installed and set as the default browser, with Edge initially closed.
- **Source:** #26943

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With Edge closed, click the Fleet icon and select My device | Microsoft Edge automatically opens to the My device page |
| 2 | Close Edge, then select Self-service from the Fleet icon | Edge automatically opens to the Self-service page |
| 3 | Close Edge, then select About Fleet from the Fleet icon | Edge automatically opens to the About Fleet page |
| 4 | Set Google Chrome (then Firefox) as the default browser, close it, and repeat the My device / Self-service / About Fleet actions | The configured default browser (Chrome, then Firefox) opens automatically for each action, on Ubuntu, Kubuntu, and Fedora |

### SETTINGS-037 — Fleet Desktop opens Snap/Flatpak Firefox and Chrome on Linux

- **Tier:** Both
- **Priority:** P2
- **Platforms:** Linux
- **Preconditions:** A Linux host enrolled to Fleet with Fleet Desktop installed. Firefox and/or Chrome installed via Snap and via Flatpak, set as the default browser.
- **Source:** #31087

| # | Step | Expected result |
|---|------|-----------------|
| 1 | With a Snap-installed Firefox set as default and closed, click the Fleet icon and select My device | The Snap Firefox opens to the My device page |
| 2 | With a Flatpak-installed Firefox set as default and closed, repeat the My device action | The Flatpak Firefox opens to the My device page |
| 3 | Repeat steps 1-2 with Chrome installed via Snap and via Flatpak | The Snap/Flatpak Chrome opens correctly for each Fleet Desktop action |
